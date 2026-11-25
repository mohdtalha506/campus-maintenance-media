import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import type { BuildingDTO, RoomDTO, UserSummaryDTO } from '@campus/shared';
import {
  getMobileApiBaseUrl,
  mobileApi,
  setMobileApiBaseUrl,
  setMobileAuthToken,
} from '../api/mobileApi';
import { processOfflineQueues } from '../services/syncEngine';
import { deleteDurableMedia } from '../storage/mediaFiles';
import {
  clearSecureSession,
  loadApiBaseUrlOverride,
  loadSecureSession,
  saveApiBaseUrlOverride,
  saveSecureSession,
} from '../storage/secureSession';
import {
  cacheLocations,
  deleteDraftById,
  getCachedLocations,
  listDraftsForReporter,
  upsertDraft,
} from '../storage/sqliteDb';
import type { LocalDraftRecord } from '../types/draft';

interface MobileContextValue {
  user: UserSummaryDTO | null;
  authLoading: boolean;
  isOnline: boolean;
  syncing: boolean;
  apiBaseUrl: string;
  buildings: BuildingDTO[];
  rooms: RoomDTO[];
  drafts: LocalDraftRecord[];
  aiReadyBanner: string | null;
  dismissAiReadyBanner: () => void;
  updateApiBaseUrl: (url: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<UserSummaryDTO>;
  signOut: () => Promise<void>;
  refreshLocations: () => Promise<void>;
  refreshDrafts: () => Promise<void>;
  saveDraft: (draft: LocalDraftRecord) => Promise<void>;
  removeDraft: (draft: LocalDraftRecord) => Promise<void>;
  runSyncNow: () => Promise<void>;
}

const MobileContext = createContext<MobileContextValue | null>(null);

export function MobileProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummaryDTO | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [apiBaseUrl, setApiBaseUrlState] = useState(getMobileApiBaseUrl());
  const [buildings, setBuildings] = useState<BuildingDTO[]>([]);
  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [drafts, setDrafts] = useState<LocalDraftRecord[]>([]);
  const [aiReadyBanner, setAiReadyBanner] = useState<string | null>(null);

  const syncLockRef = useRef(false);
  const wasOnlineRef = useRef(true);

  const refreshDraftsForUser = useCallback(async (reporterId: string) => {
    const list = await listDraftsForReporter(reporterId);
    setDrafts(list);
  }, []);

  const refreshLocations = useCallback(async () => {
    try {
      const cached = await getCachedLocations();
      if (cached.buildings.length > 0) {
        setBuildings(cached.buildings);
        setRooms(cached.rooms);
      }
    } catch {
      // ignore initial empty cache
    }

    try {
      const res = await mobileApi.getLocations();
      setBuildings(res.buildings);
      setRooms(res.rooms);
      await cacheLocations(res.buildings, res.rooms);
    } catch {
      // Offline or unauthenticated: cached SQLite locations stay active
    }
  }, []);

  const runSyncForUser = useCallback(
    async (currentUser: UserSummaryDTO | null) => {
      if (!currentUser || currentUser.role !== 'reporter' || syncLockRef.current) {
        return;
      }
      syncLockRef.current = true;
      setSyncing(true);
      try {
        const result = await processOfflineQueues({
          reporterId: currentUser.id,
          store: {
            listDraftsForReporter,
            upsertDraft,
          },
          api: mobileApi,
          onCleanupMedia: async (syncedDraft) => {
            await deleteDurableMedia(syncedDraft.photoUri);
            await deleteDurableMedia(syncedDraft.audioUri);
          },
        });

        await refreshDraftsForUser(currentUser.id);
        if (result.aiCompletedLocalIds.length > 0) {
          setAiReadyBanner(
            `${result.aiCompletedLocalIds.length} queued AI draft(s) ready for review.`
          );
        }
      } finally {
        syncLockRef.current = false;
        setSyncing(false);
      }
    },
    [refreshDraftsForUser]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const override = await loadApiBaseUrlOverride();
      if (override) {
        setMobileApiBaseUrl(override);
        if (mounted) setApiBaseUrlState(getMobileApiBaseUrl());
      }

      const session = await loadSecureSession();
      if (session && mounted) {
        setMobileAuthToken(session.token);
        setUser(session.user);
        await refreshLocations();
        if (session.user.role === 'reporter') {
          await refreshDraftsForUser(session.user.id);
        }
      }

      const netState = await NetInfo.fetch();
      const onlineNow = Boolean(netState.isConnected && netState.isInternetReachable !== false);
      if (mounted) {
        setIsOnline(onlineNow);
        wasOnlineRef.current = onlineNow;
        setAuthLoading(false);
      }
      if (onlineNow && session) {
        void runSyncForUser(session.user);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [refreshDraftsForUser, refreshLocations, runSyncForUser]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const onlineNow = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(onlineNow);
      if (onlineNow && !wasOnlineRef.current && user) {
        void refreshLocations();
        void runSyncForUser(user);
      }
      wasOnlineRef.current = onlineNow;
    });
    return () => unsubscribe();
  }, [refreshLocations, runSyncForUser, user]);

  const updateApiBaseUrl = useCallback(async (url: string) => {
    await saveApiBaseUrlOverride(url);
    setMobileApiBaseUrl(url);
    setApiBaseUrlState(getMobileApiBaseUrl());
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await mobileApi.login(email, password);
      if (!res.token) {
        throw new Error('Server did not return mobile session token.');
      }
      setMobileAuthToken(res.token);
      await saveSecureSession({ token: res.token, user: res.user });
      setUser(res.user);
      await refreshLocations();
      if (res.user.role === 'reporter') {
        await refreshDraftsForUser(res.user.id);
        void runSyncForUser(res.user);
      }
      return res.user;
    },
    [refreshDraftsForUser, refreshLocations, runSyncForUser]
  );

  const signOut = useCallback(async () => {
    setMobileAuthToken(null);
    await clearSecureSession();
    setUser(null);
    setDrafts([]);
  }, []);

  const refreshDrafts = useCallback(async () => {
    if (!user || user.role !== 'reporter') return;
    await refreshDraftsForUser(user.id);
  }, [refreshDraftsForUser, user]);

  const saveDraft = useCallback(
    async (draft: LocalDraftRecord) => {
      await upsertDraft(draft);
      if (user) {
        await refreshDraftsForUser(user.id);
      }
    },
    [refreshDraftsForUser, user]
  );

  const removeDraft = useCallback(
    async (draft: LocalDraftRecord) => {
      await deleteDurableMedia(draft.photoUri);
      await deleteDurableMedia(draft.audioUri);
      await deleteDraftById(draft.localId);
      if (user) {
        await refreshDraftsForUser(user.id);
      }
    },
    [refreshDraftsForUser, user]
  );

  const runSyncNow = useCallback(async () => {
    await refreshLocations();
    await runSyncForUser(user);
  }, [refreshLocations, runSyncForUser, user]);

  return (
    <MobileContext.Provider
      value={{
        user,
        authLoading,
        isOnline,
        syncing,
        apiBaseUrl,
        buildings,
        rooms,
        drafts,
        aiReadyBanner,
        dismissAiReadyBanner: () => setAiReadyBanner(null),
        updateApiBaseUrl,
        signIn,
        signOut,
        refreshLocations,
        refreshDrafts,
        saveDraft,
        removeDraft,
        runSyncNow,
      }}
    >
      {children}
    </MobileContext.Provider>
  );
}

export function useMobile(): MobileContextValue {
  const ctx = useContext(MobileContext);
  if (!ctx) throw new Error('useMobile must be used inside MobileProvider');
  return ctx;
}
