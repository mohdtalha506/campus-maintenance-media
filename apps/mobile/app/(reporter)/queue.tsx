import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton, PillBadge } from '../../src/components/UiPrimitives';
import { useMobile } from '../../src/context/MobileContext';
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
        <Text style={styles.headerText}>
          {isOnline ? 'Connected — auto-sync active' : 'Offline — changes queued safely in SQLite'}
        </Text>
        <AppButton
          title={syncing ? 'Syncing...' : 'Sync Now'}
          variant="secondary"
          onPress={runSyncNow}
          disabled={!isOnline || syncing}
          style={{ paddingVertical: 7, paddingHorizontal: 12 }}
        />
      </View>

      <FlatList
        data={drafts}
        keyExtractor={(d) => d.localId}
        contentContainerStyle={{ padding: 14, gap: 12 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No local drafts or queued uploads.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const syncColors =
            item.syncStatus === 'synced'
              ? { bg: '#dcfce7', fg: '#15803d' }
              : item.syncStatus === 'error'
                ? { bg: '#fee2e2', fg: '#b91c1c' }
                : { bg: '#fef3c7', fg: '#b45309' };

          const aiColors =
            item.aiStatus === 'ready'
              ? { bg: '#dbeafe', fg: '#1d4ed8' }
              : item.aiStatus === 'failed'
                ? { bg: '#fee2e2', fg: '#b91c1c' }
                : { bg: '#f1f5f9', fg: '#475569' };

          return (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.location}>
                  {item.buildingName} · Room {item.roomNumber}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <PillBadge label={`AI: ${item.aiStatus}`} bg={aiColors.bg} fg={aiColors.fg} />
                  <PillBadge
                    label={`Upload: ${item.syncStatus}`}
                    bg={syncColors.bg}
                    fg={syncColors.fg}
                  />
                </View>
              </View>

              <Text style={styles.title}>
                {item.title || '(Draft pending title — tap Review to edit)'}
              </Text>

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
                      onPress={() => router.push(`/(reporter)/draft/${item.localId}`)}
                      style={{ flex: 1, paddingVertical: 9 }}
                    />
                    {(item.aiStatus === 'failed' || item.syncStatus === 'error') && (
                      <AppButton
                        title="Retry"
                        variant="secondary"
                        onPress={() => retryDraft(item)}
                        style={{ flex: 1, paddingVertical: 9 }}
                      />
                    )}
                    <AppButton
                      title="Delete"
                      variant="danger"
                      onPress={() => removeDraft(item)}
                      style={{ paddingVertical: 9, paddingHorizontal: 12 }}
                    />
                  </>
                ) : item.serverTicketId ? (
                  <AppButton
                    title={`View ${item.serverTicketNumber}`}
                    variant="secondary"
                    onPress={() => router.push(`/(reporter)/ticket/${item.serverTicketId}`)}
                    style={{ flex: 1, paddingVertical: 9 }}
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
  root: { flex: 1, backgroundColor: '#f4f6f9' },
  headerBar: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerText: { fontSize: 12, fontWeight: '600', color: '#475569', flex: 1 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  location: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  title: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  syncedNote: { fontSize: 13, fontWeight: '600', color: '#15803d' },
  errorText: { fontSize: 12, color: '#b91c1c' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 14 },
});
