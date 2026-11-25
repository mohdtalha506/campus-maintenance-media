import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppButton, PillBadge } from '../../src/components/UiPrimitives';
import { useMobile } from '../../src/context/MobileContext';
import { COLORS } from '../../src/theme/tokens';
import type { LocalDraftRecord } from '../../src/types/draft';

export default function DraftsAndQueueScreen() {
  const { drafts, isOnline, syncing, runSyncNow, saveDraft, removeDraft } = useMobile();
  const router = useRouter();

  async function retryDraft(draft: LocalDraftRecord) {
    const updated: LocalDraftRecord = {
      ...draft,
      ...(draft.aiStatus === 'failed' && draft.audioUri ? { aiStatus: 'queued', aiError: null } : {}),
      ...(draft.syncStatus === 'error' ? { syncStatus: 'queued', syncError: null } : {}),
      updatedAt: new Date().toISOString(),
    };
    await saveDraft(updated);
    if (isOnline) {
      await runSyncNow();
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Ionicons
            name={isOnline ? 'cloud-done' : 'cloud-offline'}
            size={18}
            color={isOnline ? COLORS.success : COLORS.amber}
          />
          <Text style={styles.headerText}>
            {isOnline ? 'Connected — auto-sync active' : 'Offline — saved safely in SQLite'}
          </Text>
        </View>
        <AppButton
          title={syncing ? 'Syncing...' : 'Sync Now'}
          icon="sync-outline"
          variant="soft"
          onPress={runSyncNow}
          disabled={!isOnline || syncing}
          style={{ paddingVertical: 8, paddingHorizontal: 12 }}
        />
      </View>

      <FlatList
        data={drafts}
        keyExtractor={(d) => d.localId}
        contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 28 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={44} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Queue is clear</Text>
            <Text style={styles.emptyText}>No local drafts or pending offline uploads.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const syncColors =
            item.syncStatus === 'synced'
              ? { bg: COLORS.successSoft, fg: COLORS.success, icon: 'checkmark-circle' }
              : item.syncStatus === 'error'
                ? { bg: COLORS.dangerSoft, fg: COLORS.danger, icon: 'alert-circle' }
                : { bg: COLORS.amberSoft, fg: COLORS.amber, icon: 'time-outline' };

          const aiColors =
            item.aiStatus === 'ready'
              ? { bg: COLORS.primarySoft, fg: COLORS.primary, icon: 'sparkles' }
              : item.aiStatus === 'failed'
                ? { bg: COLORS.dangerSoft, fg: COLORS.danger, icon: 'warning-outline' }
                : { bg: '#F1F5F9', fg: COLORS.textSecondary, icon: 'hourglass-outline' };

          return (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                {item.photoUri ? (
                  <Image source={{ uri: item.photoUri }} style={styles.thumb} />
                ) : (
                  <View style={styles.thumbPlaceholder}>
                    <Ionicons name="document-text-outline" size={20} color={COLORS.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.locRow}>
                    <Ionicons name="location-outline" size={13} color={COLORS.primary} />
                    <Text style={styles.location}>
                      {item.buildingName} · Room {item.roomNumber}
                    </Text>
                  </View>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.title || 'Draft pending title — tap Review to edit'}
                  </Text>
                </View>
              </View>

              <View style={styles.badgeRow}>
                <PillBadge
                  label={`AI: ${item.aiStatus}`}
                  bg={aiColors.bg}
                  fg={aiColors.fg}
                  icon={aiColors.icon}
                />
                <PillBadge
                  label={`Upload: ${item.syncStatus}`}
                  bg={syncColors.bg}
                  fg={syncColors.fg}
                  icon={syncColors.icon}
                />
              </View>

              {item.serverTicketNumber && (
                <Text style={styles.syncedNote}>Submitted as {item.serverTicketNumber}</Text>
              )}

              {item.aiError && <Text style={styles.errorText}>AI: {item.aiError}</Text>}
              {item.syncError && <Text style={styles.errorText}>Upload: {item.syncError}</Text>}

              <View style={styles.actions}>
                {item.syncStatus !== 'synced' ? (
                  <>
                    <AppButton
                      title="Review"
                      icon="create-outline"
                      onPress={() => router.push(`/(reporter)/draft/${item.localId}`)}
                      style={{ flex: 1, paddingVertical: 10 }}
                    />
                    {(item.aiStatus === 'failed' || item.syncStatus === 'error') && (
                      <AppButton
                        title="Retry"
                        icon="refresh-outline"
                        variant="secondary"
                        onPress={() => retryDraft(item)}
                        style={{ flex: 1, paddingVertical: 10 }}
                      />
                    )}
                    <AppButton
                      title=""
                      icon="trash-outline"
                      variant="danger"
                      onPress={() => removeDraft(item)}
                      style={{ paddingVertical: 10, paddingHorizontal: 14 }}
                    />
                  </>
                ) : item.serverTicketId ? (
                  <AppButton
                    title={`View ${item.serverTicketNumber}`}
                    icon="open-outline"
                    variant="soft"
                    onPress={() => router.push(`/(reporter)/ticket/${item.serverTicketId}`)}
                    style={{ flex: 1, paddingVertical: 10 }}
                  />
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  headerBar: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  headerText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, flex: 1 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  syncedNote: { fontSize: 13, fontWeight: '700', color: COLORS.success },
  errorText: { fontSize: 12, color: COLORS.danger, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  empty: { padding: 48, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },
});
