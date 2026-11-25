import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { mobileApi } from '../../src/api/mobileApi';
import {
  AppButton,
  AudioPlaybackButton,
  SectionCard,
} from '../../src/components/UiPrimitives';
import { useMobile } from '../../src/context/MobileContext';
import { persistDraftMedia } from '../../src/storage/mediaFiles';
import { COLORS } from '../../src/theme/tokens';
import type { LocalDraftRecord } from '../../src/types/draft';

export default function NewReportScreen() {
  const { user, buildings, rooms, isOnline, saveDraft } = useMobile();
  const router = useRouter();

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBuildingId && buildings[0]) {
      setSelectedBuildingId(buildings[0].id);
    }
  }, [buildings, selectedBuildingId]);

  const filteredRooms = useMemo(
    () => rooms.filter((r) => r.buildingId === selectedBuildingId),
    [rooms, selectedBuildingId]
  );

  useEffect(() => {
    if (filteredRooms.length > 0 && !filteredRooms.some((r) => r.id === selectedRoomId)) {
      setSelectedRoomId(filteredRooms[0]!.id);
    }
  }, [filteredRooms, selectedRoomId]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  async function capturePhoto(fromCamera: boolean) {
    setError(null);
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError('Camera permission is required to capture an issue photo.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.75,
      });
      if (!res.canceled && res.assets[0]) {
        setPhotoUri(res.assets[0].uri);
        setPhotoMimeType(res.assets[0].mimeType ?? 'image/jpeg');
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Media library permission is required to select a photo.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.75,
      });
      if (!res.canceled && res.assets[0]) {
        setPhotoUri(res.assets[0].uri);
        setPhotoMimeType(res.assets[0].mimeType ?? 'image/jpeg');
      }
    }
  }

  async function toggleRecording() {
    setError(null);
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        if (uri) {
          setAudioUri(uri);
          setAudioMimeType('audio/m4a');
        }
        return;
      }

      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setError('Microphone permission is required to record a voice note.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      setRecordingSeconds(0);
      const { recording: nextRec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(nextRec);
    } catch (err) {
      setRecording(null);
      setError(err instanceof Error ? err.message : 'Audio recording failed.');
    }
  }

  async function persistNewDraftRecord(): Promise<LocalDraftRecord | null> {
    if (!user) return null;
    const building = buildings.find((b) => b.id === selectedBuildingId);
    const room = rooms.find((r) => r.id === selectedRoomId);
    if (!building || !room) {
      setError('Please select a building and room.');
      return null;
    }

    const localId = Crypto.randomUUID();
    const clientSubmissionId = Crypto.randomUUID();
    const durablePhoto = photoUri
      ? await persistDraftMedia(photoUri, localId, 'photo', 'jpg')
      : null;
    const durableAudio = audioUri
      ? await persistDraftMedia(audioUri, localId, 'audio', 'm4a')
      : null;

    const now = new Date().toISOString();
    const draft: LocalDraftRecord = {
      localId,
      clientSubmissionId,
      reporterId: user.id,
      buildingId: building.id,
      buildingName: building.name,
      roomId: room.id,
      roomNumber: room.roomNumber,
      roomName: room.name,
      photoUri: durablePhoto,
      photoMimeType: durablePhoto ? (photoMimeType ?? 'image/jpeg') : null,
      audioUri: durableAudio,
      audioMimeType: durableAudio ? (audioMimeType ?? 'audio/m4a') : null,
      title: '',
      description: '',
      category: 'Other',
      aiDraft: null,
      aiStatus: 'none',
      aiError: null,
      syncStatus: 'draft',
      syncError: null,
      serverTicketId: null,
      serverTicketNumber: null,
      userEdited: false,
      createdAt: now,
      updatedAt: now,
    };

    await saveDraft(draft);
    return draft;
  }

  function resetForm() {
    setPhotoUri(null);
    setPhotoMimeType(null);
    setAudioUri(null);
    setAudioMimeType(null);
  }

  async function handleGenerateAiOrQueue() {
    setError(null);
    if (!audioUri) {
      setError('Record a voice note first, or tap "Continue Manually".');
      return;
    }

    setBusy(true);
    try {
      const draft = await persistNewDraftRecord();
      if (!draft) return;

      if (!isOnline) {
        await saveDraft({
          ...draft,
          aiStatus: 'queued',
          aiError: null,
          updatedAt: new Date().toISOString(),
        });
        resetForm();
        router.push(`/(reporter)/draft/${draft.localId}`);
        return;
      }

      try {
        const res = await mobileApi.generateAiDraft({
          buildingId: draft.buildingId,
          roomId: draft.roomId,
          audioUri: draft.audioUri!,
          audioMimeType: draft.audioMimeType ?? 'audio/m4a',
        });

        await saveDraft({
          ...draft,
          aiDraft: res.draft,
          aiStatus: 'ready',
          aiError: null,
          title: res.draft.title,
          description: res.draft.description,
          category: res.draft.suggestedCategory,
          updatedAt: new Date().toISOString(),
        });
      } catch (aiErr) {
        const message =
          aiErr instanceof Error ? aiErr.message : 'AI service unavailable. Fill manually.';
        await saveDraft({
          ...draft,
          aiStatus: 'failed',
          aiError: message,
          updatedAt: new Date().toISOString(),
        });
      }

      resetForm();
      router.push(`/(reporter)/draft/${draft.localId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft.');
    } finally {
      setBusy(false);
    }
  }

  async function handleManualContinue() {
    setError(null);
    setBusy(true);
    try {
      const draft = await persistNewDraftRecord();
      if (!draft) return;
      resetForm();
      router.push(`/(reporter)/draft/${draft.localId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft.');
    } finally {
      setBusy(false);
    }
  }

  const completedSteps = [
    Boolean(selectedBuildingId && selectedRoomId),
    Boolean(photoUri),
    Boolean(audioUri),
  ].filter(Boolean).length;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <View style={styles.progressBarCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Inspection Checklist</Text>
          <Text style={styles.progressCount}>{completedSteps}/3 captured</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(15, (completedSteps / 3) * 100)}%` },
            ]}
          />
        </View>
      </View>

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={18} color={COLORS.amber} />
          <Text style={styles.offlineText}>
            Offline mode active: cached campus locations and durable local storage are ready.
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <SectionCard
        title="1. Campus Location"
        subtitle="Select building and room"
        icon="business-outline"
      >
        {buildings.length === 0 ? (
          <Text style={styles.muted}>
            No cached buildings yet. Sign in online once to cache campus locations.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>Building</Text>
            <View style={styles.pillGrid}>
              {buildings.map((b) => {
                const active = selectedBuildingId === b.id;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.pickPill, active && styles.pickPillActive]}
                    onPress={() => setSelectedBuildingId(b.id)}
                  >
                    <Ionicons
                      name="business"
                      size={14}
                      color={active ? '#FFFFFF' : COLORS.textSecondary}
                    />
                    <Text style={[styles.pickText, active && styles.pickTextActive]}>
                      {b.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Room</Text>
            <View style={styles.pillGrid}>
              {filteredRooms.map((r) => {
                const active = selectedRoomId === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.pickPill, active && styles.pickPillActive]}
                    onPress={() => setSelectedRoomId(r.id)}
                  >
                    <Ionicons
                      name="location"
                      size={14}
                      color={active ? '#FFFFFF' : COLORS.textSecondary}
                    />
                    <Text style={[styles.pickText, active && styles.pickTextActive]}>
                      Room {r.roomNumber} · {r.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </SectionCard>

      <SectionCard
        title="2. Issue Photo"
        subtitle="Capture clear evidence of the problem"
        icon="camera-outline"
      >
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AppButton
            title="Camera"
            icon="camera"
            variant="soft"
            onPress={() => capturePhoto(true)}
            style={{ flex: 1 }}
          />
          <AppButton
            title="Gallery"
            icon="images-outline"
            variant="secondary"
            onPress={() => capturePhoto(false)}
            style={{ flex: 1 }}
          />
        </View>
        {photoUri && (
          <View style={styles.previewWrap}>
            <Image source={{ uri: photoUri }} style={styles.previewImg} resizeMode="cover" />
            <TouchableOpacity
              style={styles.removeBadge}
              onPress={() => {
                setPhotoUri(null);
                setPhotoMimeType(null);
              }}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </SectionCard>

      <SectionCard
        title="3. Voice Note"
        subtitle="Speak in Hindi, English, or Hinglish"
        icon="mic-outline"
      >
        <View style={[styles.recorderBox, recording && styles.recorderBoxActive]}>
          <View style={styles.recorderInfo}>
            <Ionicons
              name={recording ? 'radio-button-on' : audioUri ? 'checkmark-circle' : 'mic'}
              size={22}
              color={
                recording ? COLORS.danger : audioUri ? COLORS.success : COLORS.primary
              }
            />
            <Text style={styles.recorderStatus}>
              {recording
                ? `Recording voice note... ${recordingSeconds}s`
                : audioUri
                  ? 'Voice note saved locally'
                  : 'Tap below to record a short note'}
            </Text>
          </View>
          <AppButton
            title={
              recording
                ? 'Stop Recording'
                : audioUri
                  ? 'Re-record Voice Note'
                  : 'Start Recording'
            }
            icon={recording ? 'stop-circle-outline' : 'mic-outline'}
            variant={recording ? 'danger' : 'primary'}
            onPress={toggleRecording}
          />
        </View>
        {audioUri && !recording && (
          <View style={{ marginTop: 10 }}>
            <AudioPlaybackButton uri={audioUri} label="Play Recorded Voice Note" />
          </View>
        )}
      </SectionCard>

      <SectionCard
        title="4. Create Report"
        subtitle="Let Gemini draft the English ticket or edit manually"
        icon="sparkles-outline"
      >
        <AppButton
          title={isOnline ? 'Generate AI Draft & Review' : 'Save Draft & Queue AI'}
          icon={isOnline ? 'sparkles' : 'cloud-offline-outline'}
          onPress={handleGenerateAiOrQueue}
          loading={busy}
          disabled={Boolean(recording)}
        />
        <AppButton
          title="Continue Manually (Skip AI)"
          icon="create-outline"
          variant="secondary"
          onPress={handleManualContinue}
          disabled={busy || Boolean(recording)}
          style={{ marginTop: 10 }}
        />
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  container: { padding: 14, gap: 14, paddingBottom: 32 },
  progressBarCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    padding: 13,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  progressCount: { color: '#93C5FD', fontSize: 12, fontWeight: '700' },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.navyLight,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#3B82F6',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.amberSoft,
    padding: 11,
    borderRadius: 10,
  },
  offlineText: { flex: 1, color: '#92400E', fontSize: 13, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    padding: 11,
    borderRadius: 10,
  },
  errorText: { flex: 1, color: COLORS.danger, fontSize: 13, fontWeight: '500' },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 6,
    marginBottom: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  muted: { color: COLORS.textMuted, fontSize: 13 },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: COLORS.surfaceMuted,
  },
  pickPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pickText: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  pickTextActive: { color: '#FFFFFF' },
  previewWrap: { position: 'relative', marginTop: 12 },
  previewImg: { width: '100%', height: 200, borderRadius: 10 },
  removeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recorderBox: {
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  recorderBoxActive: {
    borderColor: COLORS.danger,
    backgroundColor: '#FEF2F2',
  },
  recorderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recorderStatus: { fontSize: 13, fontWeight: '600', color: COLORS.text },
});
