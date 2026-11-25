import { useMemo } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppButton, PillBadge } from '../../src/components/UiPrimitives';
import { useMobile, useTheme } from '../../src/context/MobileContext';
import type { ThemeColors } from '../../src/theme/tokens';
import type { LocalDraftRecord } from '../../src/types/draft';

export default function DraftsAndQueueScreen() {
  const { drafts, isOnline, syncing, runSyncNow, saveDraft, removeDraft } = useMobile();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
            color={isOnline ? colors.success : colors.amber}
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
          style={{ minHeight: 38, paddingVertical: 7, paddingHorizontal: 12 }}
        />
      </View>

      <FlatList
        data={drafts}
        keyExtractor={(d) => d.localId}
        contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 28 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Queue is clear</Text>
            <Text style={styles.emptyText}>No local drafts or pending offline uploads.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const syncColors =
            item.syncStatus === 'synced'
              ? { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle' }
              : item.syncStatus === 'error'
                ? { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' }
                : { bg: colors.amberSoft, fg: colors.amberText, icon: 'time-outline' };

          const aiColors =
            item.aiStatus === 'ready'
              ? { bg: colors.primarySoft, fg: colors.primaryText, icon: 'sparkles' }
              : item.aiStatus === 'failed'
                ? { bg: colors.dangerSoft, fg: colors.danger, icon: 'warning-outline' }
                : { bg: colors.surfaceMuted, fg: colors.textSecondary, icon: 'hourglass-outline' };

          return (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                {item.photoUri ? (
                  <Image source={{ uri: item.photoUri }} style={styles.thumb} />
                ) : (
                  <View style={styles.thumbPlaceholder}>
                    <Ionicons name="document-text-outline" size={20} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.locRow}>
                    <Ionicons name="location-outline" size={13} color={colors.primaryText} />
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
                      style={{ flex: 1, minHeight: 42, paddingVertical: 10 }}
                    />
                    {(item.aiStatus === 'failed' || item.syncStatus === 'error') && (
                      <AppButton
                        title="Retry"
                        icon="refresh-outline"
                        variant="secondary"
                        onPress={() => retryDraft(item)}
                        style={{ flex: 1, minHeight: 42, paddingVertical: 10 }}
                      />
                    )}
                    <AppButton
                      title=""
                      icon="trash-outline"
                      variant="danger"
                      onPress={() => removeDraft(item)}
                      style={{ minHeight: 42, paddingVertical: 10, paddingHorizontal: 14 }}
                    />
                  </>
                ) : item.serverTicketId ? (
                  <AppButton
                    title={`View ${item.serverTicketNumber}`}
                    icon="open-outline"
                    variant="soft"
                    onPress={() => router.push(`/(reporter)/ticket/${item.serverTicketId}`)}
                    style={{ flex: 1, minHeight: 42, paddingVertical: 10 }}
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    headerBar: {
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    headerText: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary, flex: 1 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 15,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 11,
      shadowColor: colors.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: colors.isDark ? 0.25 : 0.05,
      shadowRadius: 6,
      elevation: colors.isDark ? 1 : 2,
    },
    cardTopRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    thumb: { width: 58, height: 58, borderRadius: 12 },
    thumbPlaceholder: {
      width: 58,
      height: 58,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    location: { fontSize: 12, fontWeight: '700', color: colors.primaryText },
    title: { fontSize: 15.5, fontWeight: '700', color: colors.text, lineHeight: 21 },
    badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    syncedNote: { fontSize: 13, fontWeight: '700', color: colors.success },
    errorText: { fontSize: 12.5, color: colors.danger, fontWeight: '500', lineHeight: 18 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
    empty: { padding: 48, alignItems: 'center', gap: 6 },
    emptyTitle: { fontSize: 16.5, fontWeight: '700', color: colors.text },
    emptyText: { color: colors.textMuted, fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
  });
}
