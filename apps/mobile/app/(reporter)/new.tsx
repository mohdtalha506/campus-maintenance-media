import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { mobileApi } from '../../src/api/mobileApi';
import { AppButton, AudioPlaybackButton } from '../../src/components/UiPrimitives';
import { useMobile } from '../../src/context/MobileContext';
import { persistDraftMedia } from '../../src/storage/mediaFiles';
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
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
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
    setStatusMsg(null);
  }

  async function handleGenerateAiOrQueue() {
    setError(null);
    setStatusMsg(null);
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

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Offline mode active: cached campus locations and durable local storage are ready.
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {statusMsg && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{statusMsg}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Select Building &amp; Room</Text>
        {buildings.length === 0 ? (
          <Text style={styles.muted}>
            No cached buildings yet. Sign in online once to cache campus locations.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>Building</Text>
            <View style={styles.pillGrid}>
              {buildings.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.pickPill, selectedBuildingId === b.id && styles.pickPillActive]}
                  onPress={() => setSelectedBuildingId(b.id)}
                >
                  <Text
                    style={[
                      styles.pickText,
                      selectedBuildingId === b.id && styles.pickTextActive,
                    ]}
                  >
                    {b.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Room</Text>
            <View style={styles.pillGrid}>
              {filteredRooms.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.pickPill, selectedRoomId === r.id && styles.pickPillActive]}
                  onPress={() => setSelectedRoomId(r.id)}
                >
                  <Text
                    style={[styles.pickText, selectedRoomId === r.id && styles.pickTextActive]}
                  >
                    Room {r.roomNumber} · {r.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2. Capture Issue Photo</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AppButton
            title="Take Photo"
            variant="secondary"
            onPress={() => capturePhoto(true)}
            style={{ flex: 1 }}
          />
          <AppButton
            title="Pick from Gallery"
            variant="secondary"
            onPress={() => capturePhoto(false)}
            style={{ flex: 1 }}
          />
        </View>
        {photoUri && (
          <Image source={{ uri: photoUri }} style={styles.previewImg} resizeMode="cover" />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3. Voice Note (Hindi, English, or Hinglish)</Text>
        <AppButton
          title={
            recording
              ? `Stop Recording (${recordingSeconds}s)`
              : audioUri
                ? 'Re-record Voice Note'
                : 'Start Recording'
          }
          variant={recording ? 'danger' : 'primary'}
          onPress={toggleRecording}
        />
        {audioUri && !recording && (
          <View style={{ marginTop: 10 }}>
            <AudioPlaybackButton uri={audioUri} label="Play Recorded Voice Note" />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>4. Generate Report</Text>
        <AppButton
          title={isOnline ? 'Generate AI Draft & Review' : 'Save Draft & Queue AI'}
          onPress={handleGenerateAiOrQueue}
          loading={busy}
          disabled={Boolean(recording)}
        />
        <AppButton
          title="Continue Manually (Skip AI)"
          variant="secondary"
          onPress={handleManualContinue}
          disabled={busy || Boolean(recording)}
          style={{ marginTop: 10 }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f9' },
  container: { padding: 14, gap: 14, paddingBottom: 32 },
  offlineBanner: { backgroundColor: '#fef3c7', padding: 10, borderRadius: 8 },
  offlineText: { color: '#92400e', fontSize: 13, fontWeight: '600' },
  errorBox: { backgroundColor: '#fee2e2', padding: 10, borderRadius: 8 },
  errorText: { color: '#b91c1c', fontSize: 13 },
  infoBox: { backgroundColor: '#dbeafe', padding: 10, borderRadius: 8 },
  infoText: { color: '#1e40af', fontSize: 13 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 8, marginBottom: 6 },
  muted: { color: '#64748b', fontSize: 13 },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickPill: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#ffffff',
  },
  pickPillActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  pickText: { fontSize: 13, color: '#1e293b', fontWeight: '500' },
  pickTextActive: { color: '#ffffff', fontWeight: '600' },
  previewImg: { width: '100%', height: 190, borderRadius: 8, marginTop: 12 },
});
