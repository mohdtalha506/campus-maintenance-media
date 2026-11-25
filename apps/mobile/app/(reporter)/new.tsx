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
import { useMobile, useTheme } from '../../src/context/MobileContext';
import { persistDraftMedia } from '../../src/storage/mediaFiles';
import type { ThemeColors } from '../../src/theme/tokens';
import type { LocalDraftRecord } from '../../src/types/draft';

function formatTimer(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function NewReportScreen() {
  const { user, buildings, rooms, isOnline, saveDraft } = useMobile();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const hasLocation = Boolean(selectedBuildingId && selectedRoomId);
  const hasPhoto = Boolean(photoUri);
  const hasAudio = Boolean(audioUri);
  const completedSteps = [hasLocation, hasPhoto, hasAudio].filter(Boolean).length;

  return (
    <View style={styles.root}>
      <View style={styles.heroStrip}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Field Inspection</Text>
            <Text style={styles.heroSub}>Capture location, photo &amp; voice note</Text>
          </View>
          <View style={styles.stepCountPill}>
            <Text style={styles.stepCountText}>{completedSteps}/3 Ready</Text>
          </View>
        </View>

        <View style={styles.stepperRow}>
          {[
            { label: 'Location', done: hasLocation, icon: 'business-outline' },
            { label: 'Photo', done: hasPhoto, icon: 'camera-outline' },
            { label: 'Voice', done: hasAudio, icon: 'mic-outline' },
          ].map((step) => (
            <View
              key={step.label}
              style={[styles.stepChip, step.done && styles.stepChipDone]}
            >
              <Ionicons
                name={
                  (step.done ? 'checkmark-circle' : step.icon) as keyof typeof Ionicons.glyphMap
                }
                size={14}
                color={step.done ? '#4ADE80' : '#94A3B8'}
              />
              <Text style={[styles.stepChipText, step.done && styles.stepChipTextDone]}>
                {step.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={18} color={colors.amber} />
            <Text style={styles.offlineText}>
              Offline mode: cached locations &amp; local SQLite queue are active.
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <SectionCard
          title="Campus Location"
          subtitle="Choose building and room"
          icon="location-outline"
        >
          {buildings.length === 0 ? (
            <Text style={styles.muted}>
              No cached buildings yet. Sign in online once to cache campus locations.
            </Text>
          ) : (
            <>
              <Text style={styles.label}>Building</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScrollRow}
              >
                {buildings.map((b) => {
                  const active = selectedBuildingId === b.id;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      activeOpacity={0.8}
                      style={[styles.buildingChip, active && styles.buildingChipActive]}
                      onPress={() => setSelectedBuildingId(b.id)}
                    >
                      <Ionicons
                        name={active ? 'business' : 'business-outline'}
                        size={15}
                        color={active ? '#FFFFFF' : colors.primaryText}
                      />
                      <Text style={[styles.buildingChipText, active && styles.buildingChipTextActive]}>
                        {b.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.label, { marginTop: 14 }]}>Room</Text>
              <View style={styles.roomGrid}>
                {filteredRooms.map((r) => {
                  const active = selectedRoomId === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      activeOpacity={0.82}
                      style={[styles.roomCard, active && styles.roomCardActive]}
                      onPress={() => setSelectedRoomId(r.id)}
                    >
                      <View style={styles.roomCardTop}>
                        <Text style={[styles.roomNumber, active && styles.roomNumberActive]}>
                          Room {r.roomNumber}
                        </Text>
                        {active && (
                          <Ionicons name="checkmark-circle" size={16} color={colors.primaryText} />
                        )}
                      </View>
                      <Text style={styles.roomName} numberOfLines={1}>
                        {r.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </SectionCard>

        <SectionCard
          title="Issue Photo"
          subtitle="Clear visual evidence helps technicians prepare"
          icon="camera-outline"
        >
          {photoUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: photoUri }} style={styles.previewImg} resizeMode="cover" />
              <View style={styles.previewOverlayBar}>
                <View style={styles.previewTag}>
                  <Ionicons name="checkmark-circle" size={15} color="#4ADE80" />
                  <Text style={styles.previewTagText}>Photo attached</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.overlayActionBtn}
                    onPress={() => capturePhoto(true)}
                  >
                    <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.overlayActionText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.overlayActionBtn, styles.overlayDangerBtn]}
                    onPress={() => {
                      setPhotoUri(null);
                      setPhotoMimeType(null);
                    }}
                  >
                    <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.dropzone}>
              <View style={styles.dropzoneIconWrap}>
                <Ionicons name="camera" size={26} color={colors.primaryText} />
              </View>
              <Text style={styles.dropzoneTitle}>Add Issue Photo</Text>
              <Text style={styles.dropzoneSub}>
                Snap a picture on site or choose from your gallery
              </Text>
              <View style={styles.dropzoneBtnRow}>
                <AppButton
                  title="Camera"
                  icon="camera"
                  variant="primary"
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
            </View>
          )}
        </SectionCard>

        <SectionCard
          title="Voice Note"
          subtitle="Speak naturally in Hindi, English, or Hinglish"
          icon="mic-outline"
        >
          <View style={[styles.studioCard, recording && styles.studioCardRecording]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={toggleRecording}
              style={[
                styles.micCircle,
                recording
                  ? styles.micCircleActive
                  : audioUri
                    ? styles.micCircleReady
                    : undefined,
              ]}
            >
              <Ionicons
                name={recording ? 'stop' : audioUri ? 'mic' : 'mic-outline'}
                size={26}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.studioTitleRow}>
                <Text style={styles.studioTitle}>
                  {recording
                    ? 'Recording live...'
                    : audioUri
                      ? 'Voice note captured'
                      : 'Tap mic to record'}
                </Text>
                {(recording || recordingSeconds > 0) && (
                  <View style={[styles.timerBadge, recording && styles.timerBadgeLive]}>
                    <Text style={[styles.timerText, recording && { color: '#FFFFFF' }]}>
                      {formatTimer(recordingSeconds)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.studioSub}>
                {recording
                  ? 'Tap the red stop button when finished'
                  : audioUri
                    ? 'Tap mic again to re-record, or play below'
                    : 'Describe the room issue in your own words'}
              </Text>
            </View>
          </View>

          {audioUri && !recording && (
            <View style={{ marginTop: 12 }}>
              <AudioPlaybackButton uri={audioUri} label="Play Recorded Voice Note" />
            </View>
          )}
        </SectionCard>

        <View style={styles.ctaCard}>
          <View style={styles.ctaHeader}>
            <View style={styles.aiIconBadge}>
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>AI Copilot Draft</Text>
              <Text style={styles.ctaSub}>
                Auto-translates voice note into an English maintenance ticket
              </Text>
            </View>
          </View>

          <AppButton
            title={isOnline ? 'Generate AI Draft & Review' : 'Save Draft & Queue AI'}
            icon={isOnline ? 'sparkles' : 'cloud-offline-outline'}
            onPress={handleGenerateAiOrQueue}
            loading={busy}
            disabled={Boolean(recording)}
          />

          <TouchableOpacity
            onPress={handleManualContinue}
            disabled={busy || Boolean(recording)}
            style={styles.manualLinkBtn}
          >
            <Ionicons name="create-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.manualLinkText}>Skip AI and fill details manually</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    heroStrip: {
      backgroundColor: colors.heroBg,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 14,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      gap: 12,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    heroTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
    heroSub: { fontSize: 12.5, color: '#94A3B8', marginTop: 2 },
    stepCountPill: {
      backgroundColor: colors.navyLight,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 999,
    },
    stepCountText: { color: '#93C5FD', fontSize: 12, fontWeight: '700' },
    stepperRow: { flexDirection: 'row', gap: 8 },
    stepChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.navyLight,
      borderRadius: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
    },
    stepChipDone: {
      borderColor: 'rgba(74, 222, 128, 0.35)',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
    },
    stepChipText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
    stepChipTextDone: { color: '#DCFCE7' },
    container: { padding: 14, gap: 14, paddingBottom: 34 },
    offlineBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.amberSoft,
      padding: 12,
      borderRadius: 12,
    },
    offlineText: { flex: 1, color: colors.amberText, fontSize: 13, fontWeight: '600', lineHeight: 19 },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.dangerSoft,
      padding: 12,
      borderRadius: 12,
    },
    errorText: { flex: 1, color: colors.danger, fontSize: 13.5, fontWeight: '500', lineHeight: 19 },
    label: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    muted: { color: colors.textMuted, fontSize: 13.5 },
    hScrollRow: { gap: 8, paddingVertical: 2 },
    buildingChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    buildingChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    buildingChipText: { fontSize: 13.5, fontWeight: '700', color: colors.text },
    buildingChipTextActive: { color: '#FFFFFF' },
    roomGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    roomCard: {
      width: '48.5%',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 11,
      gap: 3,
    },
    roomCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    roomCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    roomNumber: { fontSize: 13.5, fontWeight: '800', color: colors.text },
    roomNumberActive: { color: colors.primaryText },
    roomName: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
    dropzone: {
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.borderStrong,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      padding: 18,
      alignItems: 'center',
      gap: 6,
    },
    dropzoneIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    dropzoneTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    dropzoneSub: { fontSize: 12.5, color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
    dropzoneBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
    previewWrap: { position: 'relative', borderRadius: 14, overflow: 'hidden' },
    previewImg: { width: '100%', height: 215, borderRadius: 14 },
    previewOverlayBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.78)',
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    previewTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    previewTagText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
    overlayActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    overlayDangerBtn: { backgroundColor: 'rgba(220, 38, 38, 0.85)' },
    overlayActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    studioCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
    },
    studioCardRecording: {
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
    },
    micCircle: {
      width: 56,
      height: 56,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#1D4ED8',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 4,
    },
    micCircleActive: { backgroundColor: colors.danger },
    micCircleReady: { backgroundColor: colors.success },
    studioTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    studioTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    studioSub: { fontSize: 12.5, color: colors.textMuted, lineHeight: 17 },
    timerBadge: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    timerBadgeLive: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    timerText: { fontSize: 12, fontWeight: '800', color: colors.text },
    ctaCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      gap: 12,
      shadowColor: colors.shadowColor,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: colors.isDark ? 0.28 : 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    ctaHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    aiIconBadge: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaTitle: { fontSize: 15.5, fontWeight: '800', color: colors.text },
    ctaSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 1, lineHeight: 17 },
    manualLinkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
    },
    manualLinkText: { fontSize: 13.5, fontWeight: '600', color: colors.textSecondary },
  });
}
