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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MAINTENANCE_CATEGORIES, type MaintenanceCategory } from '@campus/shared';
import { mobileApi } from '../../../src/api/mobileApi';
import { AppButton, AudioPlaybackButton, PillBadge } from '../../../src/components/UiPrimitives';
import { useMobile } from '../../../src/context/MobileContext';
import { deleteDurableMedia } from '../../../src/storage/mediaFiles';
import { getDraftById } from '../../../src/storage/sqliteDb';
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
      <View style={styles.card}>
        <Text style={styles.location}>
          {draft.buildingName} · Room {draft.roomNumber} ({draft.roomName})
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <PillBadge label={`AI: ${draft.aiStatus}`} bg="#dbeafe" fg="#1d4ed8" />
          {draft.aiDraft?.isMock && (
            <PillBadge label="Mock AI Output" bg="#fef3c7" fg="#b45309" />
          )}
        </View>
      </View>

      {draft.aiStatus === 'queued' && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            AI draft is queued offline and will generate automatically when connectivity returns. You
            can also enter the details manually right now.
          </Text>
        </View>
      )}

      {draft.aiError && (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>{draft.aiError}</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {message && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{message}</Text>
        </View>
      )}

      {draft.aiDraft && (
        <View style={styles.card}>
          <Text style={styles.label}>Original Language Transcript</Text>
          <Text style={styles.transcript}>{draft.aiDraft.transcript}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Title (Editable English Report)</Text>
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
          {MAINTENANCE_CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.catPill, category === c && styles.catPillActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.catText, category === c && styles.catTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {(draft.photoUri || draft.audioUri) && (
        <View style={styles.card}>
          <Text style={styles.label}>Captured Evidence (Saved Durably Offline)</Text>
          {draft.photoUri && (
            <Image source={{ uri: draft.photoUri }} style={styles.previewImg} resizeMode="cover" />
          )}
          {draft.audioUri && (
            <View style={{ marginTop: 10 }}>
              <AudioPlaybackButton uri={draft.audioUri} label="Play Voice Note" />
            </View>
          )}
        </View>
      )}

      <View style={styles.actions}>
        {draft.audioUri && (
          <AppButton
            title={isOnline ? 'Generate / Refresh AI Draft' : 'Queue AI Draft'}
            variant="secondary"
            onPress={handleRetryAi}
            disabled={busy}
          />
        )}
        <AppButton
          title="Save Draft Locally"
          variant="secondary"
          onPress={async () => {
            await handleSaveEdits();
            setMessage('Draft saved to SQLite.');
          }}
          disabled={busy}
        />
        <AppButton
          title={isOnline ? 'Submit Ticket' : 'Queue Submission (Offline)'}
          onPress={handleSubmitTicket}
          loading={busy}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f9' },
  container: { padding: 14, gap: 12, paddingBottom: 32 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#64748b' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  location: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#ffffff',
  },
  transcript: { fontSize: 14, color: '#1e293b', fontStyle: 'italic' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catPill: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catPillActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  catText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  catTextActive: { color: '#ffffff' },
  previewImg: { width: '100%', height: 190, borderRadius: 8, marginTop: 6 },
  actions: { gap: 10 },
  infoBox: { backgroundColor: '#dbeafe', padding: 10, borderRadius: 8 },
  infoText: { color: '#1e40af', fontSize: 13 },
  warnBox: { backgroundColor: '#fef3c7', padding: 10, borderRadius: 8 },
  warnText: { color: '#92400e', fontSize: 13 },
  errorBox: { backgroundColor: '#fee2e2', padding: 10, borderRadius: 8 },
  errorText: { color: '#b91c1c', fontSize: 13 },
});
