import { useEffect, useMemo, useState } from 'react';
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
import { useMobile, useTheme } from '../../../src/context/MobileContext';
import { deleteDurableMedia } from '../../../src/storage/mediaFiles';
import { getDraftById } from '../../../src/storage/sqliteDb';
import type { ThemeColors } from '../../../src/theme/tokens';
import type { LocalDraftRecord } from '../../../src/types/draft';

export default function ReviewDraftScreen() {
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const { drafts, isOnline, saveDraft } = useMobile();
  const { colors, categoryStyle } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
            bg={colors.primarySoft}
            fg={colors.primaryText}
            icon="sparkles"
          />
          {draft.aiDraft?.isMock && (
            <PillBadge
              label="Mock AI Output"
              bg={colors.amberSoft}
              fg={colors.amberText}
              icon="flask-outline"
            />
          )}
        </View>
      </View>

      {draft.aiStatus === 'queued' && (
        <View style={styles.infoBox}>
          <Ionicons name="time-outline" size={18} color={colors.primaryText} />
          <Text style={styles.infoText}>
            AI draft is queued offline and will generate automatically when connectivity returns. You
            can also enter the details manually right now.
          </Text>
        </View>
      )}

      {draft.aiError && (
        <View style={styles.warnBox}>
          <Ionicons name="warning-outline" size={18} color={colors.amber} />
          <Text style={styles.warnText}>{draft.aiError}</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {message && (
        <View style={styles.infoBox}>
          <Ionicons name="checkmark-circle" size={18} color={colors.primaryText} />
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
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { minHeight: 96, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Describe the maintenance problem..."
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.catGrid}>
          {MAINTENANCE_CATEGORIES.map((c) => {
            const active = category === c;
            const cfg = categoryStyle[c];
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    container: { padding: 14, gap: 12, paddingBottom: 32 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
    muted: { color: colors.textMuted },
    locationBanner: {
      backgroundColor: colors.heroBg,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.isDark ? colors.border : 'transparent',
    },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    location: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', flex: 1, lineHeight: 21 },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: 12,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 11,
      fontSize: 15,
      backgroundColor: colors.surfaceMuted,
      color: colors.text,
    },
    transcript: { fontSize: 14.5, color: colors.text, fontStyle: 'italic', lineHeight: 21 },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    catPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      paddingHorizontal: 13,
      paddingVertical: 8,
      backgroundColor: colors.surfaceMuted,
    },
    catPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    catText: { fontSize: 13, fontWeight: '600', color: colors.text },
    catTextActive: { color: '#FFFFFF' },
    previewImg: { width: '100%', height: 200, borderRadius: 12, marginTop: 4 },
    actions: { gap: 10, marginTop: 4 },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primarySoft,
      padding: 12,
      borderRadius: 12,
    },
    infoText: { flex: 1, color: colors.primaryText, fontSize: 13, fontWeight: '500', lineHeight: 19 },
    warnBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.amberSoft,
      padding: 12,
      borderRadius: 12,
    },
    warnText: { flex: 1, color: colors.amberText, fontSize: 13, lineHeight: 19 },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.dangerSoft,
      padding: 12,
      borderRadius: 12,
    },
    errorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 19 },
  });
}
