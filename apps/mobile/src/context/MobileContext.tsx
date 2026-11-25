import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import type { BuildingDTO, NotificationDTO, RoomDTO, UserSummaryDTO } from '@campus/shared';
import {
  registerForPushNotificationsAsync,
  syncAppIconBadgeCount,
} from '../services/notificationService';
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
  loadThemeMode,
  saveApiBaseUrlOverride,
  saveSecureSession,
  saveThemeMode,
} from '../storage/secureSession';
import {
  cacheLocations,
  deleteDraftById,
  getCachedLocations,
  listDraftsForReporter,
  upsertDraft,
} from '../storage/sqliteDb';
import {
  getCategoryStyle,
  getPriorityStyle,
  getStatusStyle,
  getThemeColors,
  type CategoryStyleMap,
  type PriorityStyleMap,
  type StatusStyleMap,
  type ThemeColors,
  type ThemeMode,
} from '../theme/tokens';
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
  notifications: NotificationDTO[];
  unreadCount: number;
  pushStatusMessage: string | null;
  aiReadyBanner: string | null;
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  statusStyle: StatusStyleMap;
  priorityStyle: PriorityStyleMap;
  categoryStyle: CategoryStyleMap;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
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
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [user, setUser] = useState<UserSummaryDTO | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [apiBaseUrl, setApiBaseUrlState] = useState(getMobileApiBaseUrl());
  const [buildings, setBuildings] = useState<BuildingDTO[]>([]);
  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [drafts, setDrafts] = useState<LocalDraftRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);
  const [aiReadyBanner, setAiReadyBanner] = useState<string | null>(null);

  const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
  const colors = useMemo(() => getThemeColors(isDark), [isDark]);
  const statusStyle = useMemo(() => getStatusStyle(isDark), [isDark]);
  const priorityStyle = useMemo(() => getPriorityStyle(isDark), [isDark]);
  const categoryStyle = useMemo(() => getCategoryStyle(isDark), [isDark]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await saveThemeMode(mode);
  }, []);

  const toggleTheme = useCallback(async () => {
    const next: ThemeMode = isDark ? 'light' : 'dark';
    setThemeModeState(next);
    await saveThemeMode(next);
  }, [isDark]);

  const syncLockRef = useRef(false);
  const wasOnlineRef = useRef(true);
  const pushTokenRef = useRef<string | null>(null);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await mobileApi.listNotifications();
      setNotifications(res.items);
      setUnreadCount(res.unreadCount);
      await syncAppIconBadgeCount(res.unreadCount);
    } catch {
      // ignore offline or unauthenticated
    }
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      const res = await mobileApi.markNotificationRead(id);
      setUnreadCount(res.unreadCount);
      await syncAppIconBadgeCount(res.unreadCount);
    } catch {
      // ignore offline
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await syncAppIconBadgeCount(0);
    try {
      await mobileApi.markAllNotificationsRead();
    } catch {
      // ignore offline
    }
  }, []);

  const registerDevicePushToken = useCallback(async () => {
    const result = await registerForPushNotificationsAsync();
    setPushStatusMessage(result.message);
    if (!result.token) return;
    pushTokenRef.current = result.token;
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    try {
      await mobileApi.registerPushToken(result.token, platform);
    } catch (err) {
      setPushStatusMessage(
        err instanceof Error ? `Server sync failed: ${err.message}` : 'Server sync failed.'
      );
    }
  }, []);

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
      const savedTheme = await loadThemeMode();
      if (savedTheme && mounted) {
        setThemeModeState(savedTheme);
      }

      const override = await loadApiBaseUrlOverride();
      const isProdBuild = typeof __DEV__ === 'undefined' || !__DEV__;
      if (override && isProdBuild && override.includes('10.0.2.2')) {
        await saveApiBaseUrlOverride('');
      } else if (override) {
        setMobileApiBaseUrl(override);
        if (mounted) setApiBaseUrlState(getMobileApiBaseUrl());
      }

      const session = await loadSecureSession();
      if (session && mounted) {
        setMobileAuthToken(session.token);
        setUser(session.user);
        try {
          const cached = await getCachedLocations();
          if (cached.buildings.length > 0 && mounted) {
            setBuildings(cached.buildings);
            setRooms(cached.rooms);
          }
        } catch {
          // ignore empty initial cache
        }
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
        void refreshLocations();
        void refreshNotifications();
        void registerDevicePushToken();
        void runSyncForUser(session.user);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    refreshDraftsForUser,
    refreshLocations,
    refreshNotifications,
    registerDevicePushToken,
    runSyncForUser,
  ]);

  useEffect(() => {
    if (!user) return;
    const sub = Notifications.addNotificationReceivedListener(() => {
      void refreshNotifications();
    });
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshNotifications();
        void registerDevicePushToken();
      }
    });
    return () => {
      sub.remove();
      appStateSub.remove();
    };
  }, [refreshNotifications, registerDevicePushToken, user]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const onlineNow = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(onlineNow);
      if (onlineNow && !wasOnlineRef.current && user) {
        void refreshLocations();
        void registerDevicePushToken();
        void runSyncForUser(user);
      }
      wasOnlineRef.current = onlineNow;
    });
    return () => unsubscribe();
  }, [refreshLocations, registerDevicePushToken, runSyncForUser, user]);

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
      void refreshNotifications();
      void registerDevicePushToken();
      if (res.user.role === 'reporter') {
        await refreshDraftsForUser(res.user.id);
        void runSyncForUser(res.user);
      }
      return res.user;
    },
    [
      refreshDraftsForUser,
      refreshLocations,
      refreshNotifications,
      registerDevicePushToken,
      runSyncForUser,
    ]
  );

  const signOut = useCallback(async () => {
    if (pushTokenRef.current) {
      try {
        await mobileApi.unregisterPushToken(pushTokenRef.current);
      } catch {
        // ignore network errors on logout
      }
      pushTokenRef.current = null;
    }
    setMobileAuthToken(null);
    await clearSecureSession();
    setUser(null);
    setDrafts([]);
    setNotifications([]);
    setUnreadCount(0);
    await syncAppIconBadgeCount(0);
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
  }, [refreshLocations, registerDevicePushToken, runSyncForUser, user]);

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
        notifications,
        unreadCount,
        pushStatusMessage,
        aiReadyBanner,
        themeMode,
        isDark,
        colors,
        statusStyle,
        priorityStyle,
        categoryStyle,
        setThemeMode,
        toggleTheme,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
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

export function useTheme() {
  const {
    themeMode,
    isDark,
    colors,
    statusStyle,
    priorityStyle,
    categoryStyle,
    setThemeMode,
    toggleTheme,
  } = useMobile();
  return {
    themeMode,
    isDark,
    colors,
    statusStyle,
    priorityStyle,
    categoryStyle,
    setThemeMode,
    toggleTheme,
  };
}
