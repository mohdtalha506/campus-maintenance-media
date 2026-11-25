import { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MAINTENANCE_CATEGORIES, type MaintenanceCategory } from '@campus/shared';
import { mobileApi } from '../../../src/api/mobileApi';
import {
  AppButton,
  AudioPlaybackButton,
  PillBadge,
  SectionCard,
} from '../../../src/components/UiPrimitives';
import { useMobile } from '../../../src/context/MobileContext';
import { deleteDurableMedia } from '../../../src/storage/mediaFiles';
import { getDraftById } from '../../../src/storage/sqliteDb';
import { CATEGORY_STYLE, COLORS } from '../../../src/theme/tokens';
import type { LocalDraftRecord } from '../../../src/types/draft';

export default function ReviewDraftScreen() {
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const { drafts, isOnline, saveDraft } = useMobile();
  const router = useRouter();

  const [draft, setDraft] = useState<LocalDraftRecord | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MaintenanceCategory>('Other');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromState = drafts.find((d) => d.localId === localId);
    if (fromState) {
      setDraft(fromState);
      setTitle(fromState.title);
      setDescription(fromState.description);
      setCategory(fromState.category);
      return;
    }
    if (localId) {
      void getDraftById(localId).then((loaded) => {
        if (loaded) {
          setDraft(loaded);
          setTitle(loaded.title);
          setDescription(loaded.description);
          setCategory(loaded.category);
        }
      });
    }
  }, [drafts, localId]);

  if (!draft) {
    return (
      <View style={styles.empty}>
        <Text style={styles.muted}>Draft not found.</Text>
      </View>
    );
  }

  async function handleSaveEdits(): Promise<LocalDraftRecord> {
    const updated: LocalDraftRecord = {
      ...draft!,
      title,
      description,
      category,
      userEdited: true,
      updatedAt: new Date().toISOString(),
    };
    await saveDraft(updated);
    setDraft(updated);
    return updated;
  }

  async function handleRetryAi() {
    if (!draft?.audioUri) return;
    setError(null);
    setMessage(null);

    if (!isOnline) {
      const queued: LocalDraftRecord = {
        ...draft,
        aiStatus: 'queued',
        aiError: null,
        updatedAt: new Date().toISOString(),
      };
      await saveDraft(queued);
      setDraft(queued);
      setMessage('Offline: AI draft request queued. It will run automatically when reconnected.');
      return;
    }

    setBusy(true);
    try {
      const res = await mobileApi.generateAiDraft({
        buildingId: draft.buildingId,
        roomId: draft.roomId,
        audioUri: draft.audioUri,
        audioMimeType: draft.audioMimeType ?? 'audio/m4a',
      });
      const updated: LocalDraftRecord = {
        ...draft,
        aiDraft: res.draft,
        aiStatus: 'ready',
        aiError: null,
        title: res.draft.title,
        description: res.draft.description,
        category: res.draft.suggestedCategory,
        updatedAt: new Date().toISOString(),
      };
      await saveDraft(updated);
      setDraft(updated);
      setTitle(res.draft.title);
      setDescription(res.draft.description);
      setCategory(res.draft.suggestedCategory);
      setMessage('AI draft generated. Review and edit before submitting.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI draft failed.';
      setError(`${msg} You can complete the fields below manually.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitTicket() {
    setError(null);
    setMessage(null);
    if (title.trim().length < 3) {
      setError('Please enter a title (at least 3 characters).');
      return;
    }
    if (description.trim().length < 5) {
      setError('Please enter a description (at least 5 characters).');
      return;
    }

    setBusy(true);
    try {
      const saved = await handleSaveEdits();

      if (!isOnline) {
        await saveDraft({
          ...saved,
          syncStatus: 'queued',
          syncError: null,
          updatedAt: new Date().toISOString(),
        });
        router.replace('/(reporter)/queue');
        return;
      }

      const res = await mobileApi.createTicket({
        clientSubmissionId: saved.clientSubmissionId,
        buildingId: saved.buildingId,
        roomId: saved.roomId,
        title: saved.title.trim(),
        description: saved.description.trim(),
        category: saved.category,
        aiDraft: saved.aiDraft,
        photoUri: saved.photoUri,
        photoMimeType: saved.photoMimeType,
        audioUri: saved.audioUri,
        audioMimeType: saved.audioMimeType,
      });

      const synced: LocalDraftRecord = {
        ...saved,
        syncStatus: 'synced',
        syncError: null,
        serverTicketId: res.ticket.id,
        serverTicketNumber: res.ticket.ticketNumber,
        updatedAt: new Date().toISOString(),
      };
      await saveDraft(synced);
      await deleteDurableMedia(synced.photoUri);
      await deleteDurableMedia(synced.audioUri);
      router.replace(`/(reporter)/ticket/${res.ticket.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      await saveDraft({
        ...draft!,
        title,
        description,
        category,
        userEdited: true,
        syncStatus: 'error',
        syncError: msg,
        updatedAt: new Date().toISOString(),
      });
      setError(`${msg} Your edits and media are preserved locally for retry.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <View style={styles.locationBanner}>
        <View style={styles.locRow}>
          <Ionicons name="location" size={18} color="#93C5FD" />
          <Text style={styles.location}>
            {draft.buildingName} · Room {draft.roomNumber} ({draft.roomName})
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <PillBadge
            label={`AI: ${draft.aiStatus}`}
            bg={COLORS.primarySoft}
            fg={COLORS.primary}
            icon="sparkles"
          />
          {draft.aiDraft?.isMock && (
            <PillBadge
              label="Mock AI Output"
              bg={COLORS.amberSoft}
              fg={COLORS.amber}
              icon="flask-outline"
            />
          )}
        </View>
      </View>

      {draft.aiStatus === 'queued' && (
        <View style={styles.infoBox}>
          <Ionicons name="time-outline" size={18} color={COLORS.primary} />
          <Text style={styles.infoText}>
            AI draft is queued offline and will generate automatically when connectivity returns. You
            can also enter the details manually right now.
          </Text>
        </View>
      )}

      {draft.aiError && (
        <View style={styles.warnBox}>
          <Ionicons name="warning-outline" size={18} color={COLORS.amber} />
          <Text style={styles.warnText}>{draft.aiError}</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {message && (
        <View style={styles.infoBox}>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
          <Text style={styles.infoText}>{message}</Text>
        </View>
      )}

      {draft.aiDraft && (
        <SectionCard title="Voice Transcript" icon="chatbubble-ellipses-outline">
          <Text style={styles.transcript}>“{draft.aiDraft.transcript}”</Text>
        </SectionCard>
      )}

      <SectionCard title="Editable English Report" icon="create-outline">
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Short summary of the issue"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { minHeight: 96, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Describe the maintenance problem..."
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.catGrid}>
          {MAINTENANCE_CATEGORIES.map((c) => {
            const active = category === c;
            const cfg = CATEGORY_STYLE[c];
            return (
              <TouchableOpacity
                key={c}
                style={[styles.catPill, active && styles.catPillActive]}
                onPress={() => setCategory(c)}
              >
                <Ionicons
                  name={cfg.icon as keyof typeof Ionicons.glyphMap}
                  size={14}
                  color={active ? '#FFFFFF' : cfg.fg}
                />
                <Text style={[styles.catText, active && styles.catTextActive]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SectionCard>

      {(draft.photoUri || draft.audioUri) && (
        <SectionCard title="Captured Evidence" subtitle="Saved durably offline" icon="attach-outline">
          {draft.photoUri && (
            <Image source={{ uri: draft.photoUri }} style={styles.previewImg} resizeMode="cover" />
          )}
          {draft.audioUri && (
            <View style={{ marginTop: 10 }}>
              <AudioPlaybackButton uri={draft.audioUri} label="Play Voice Note" />
            </View>
          )}
        </SectionCard>
      )}

      <View style={styles.actions}>
        {draft.audioUri && (
          <AppButton
            title={isOnline ? 'Generate / Refresh AI Draft' : 'Queue AI Draft'}
            icon="sparkles-outline"
            variant="soft"
            onPress={handleRetryAi}
            disabled={busy}
          />
        )}
        <AppButton
          title="Save Draft Locally"
          icon="bookmark-outline"
          variant="secondary"
          onPress={async () => {
            await handleSaveEdits();
            setMessage('Draft saved to SQLite.');
          }}
          disabled={busy}
        />
        <AppButton
          title={isOnline ? 'Submit Ticket' : 'Queue Submission (Offline)'}
          icon={isOnline ? 'send' : 'cloud-upload-outline'}
          onPress={handleSubmitTicket}
          loading={busy}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  container: { padding: 14, gap: 12, paddingBottom: 32 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: COLORS.textMuted },
  locationBanner: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    padding: 15,
  },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  location: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: COLORS.surfaceMuted,
    color: COLORS.text,
  },
  transcript: { fontSize: 14, color: COLORS.text, fontStyle: 'italic', lineHeight: 20 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: COLORS.surfaceMuted,
  },
  catPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  catTextActive: { color: '#FFFFFF' },
  previewImg: { width: '100%', height: 200, borderRadius: 10, marginTop: 4 },
  actions: { gap: 10, marginTop: 4 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primarySoft,
    padding: 11,
    borderRadius: 10,
  },
  infoText: { flex: 1, color: COLORS.primary, fontSize: 13, fontWeight: '500' },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.amberSoft,
    padding: 11,
    borderRadius: 10,
  },
  warnText: { flex: 1, color: '#92400E', fontSize: 13 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    padding: 11,
    borderRadius: 10,
  },
  errorText: { flex: 1, color: COLORS.danger, fontSize: 13 },
});
