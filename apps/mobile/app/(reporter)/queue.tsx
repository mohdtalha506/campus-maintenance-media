import { useMemo } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  const stats = useMemo(() => {
    const pending = drafts.filter((d) => d.syncStatus !== 'synced').length;
    const synced = drafts.filter((d) => d.syncStatus === 'synced').length;
    const errors = drafts.filter((d) => d.syncStatus === 'error' || d.aiStatus === 'failed').length;
    return { total: drafts.length, pending, synced, errors };
  }, [drafts]);

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
      <View style={styles.heroStrip}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Drafts &amp; Sync Queue</Text>
            <View style={styles.connRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isOnline ? '#4ADE80' : '#FBBF24' },
                ]}
              />
              <Text style={styles.heroSub}>
                {isOnline ? 'Connected · Auto-sync active' : 'Offline · Saved safely in SQLite'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            disabled={!isOnline || syncing}
            onPress={() => {
              void runSyncNow();
            }}
            style={[
              styles.syncPillBtn,
              (!isOnline || syncing) && { opacity: 0.5 },
            ]}
          >
            <Ionicons name="sync" size={15} color="#FFFFFF" />
            <Text style={styles.syncPillText}>{syncing ? 'Syncing' : 'Sync'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.total}</Text>
            <Text style={styles.statLbl}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: '#FBBF24' }]}>{stats.pending}</Text>
            <Text style={styles.statLbl}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: '#4ADE80' }]}>{stats.synced}</Text>
            <Text style={styles.statLbl}>Synced</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={drafts}
        keyExtractor={(d) => d.localId}
        contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 28 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="checkmark-done" size={32} color={colors.success} />
            </View>
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptyText}>
              No local drafts or pending offline uploads in your queue.
            </Text>
            <AppButton
              title="Start New Inspection"
              icon="camera-outline"
              onPress={() => router.push('/(reporter)/new')}
              style={{ marginTop: 10 }}
            />
          </View>
        }
        renderItem={({ item }) => {
          const isSynced = item.syncStatus === 'synced';
          const hasError = item.syncStatus === 'error' || item.aiStatus === 'failed';
          const accentColor = isSynced
            ? colors.success
            : hasError
              ? colors.danger
              : colors.amber;

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
              <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTopMeta}>
                  <View style={styles.locPill}>
                    <Ionicons name="location" size={12} color={colors.primaryText} />
                    <Text style={styles.location} numberOfLines={1}>
                      {item.buildingName} · Rm {item.roomNumber}
                    </Text>
                  </View>

                  {isSynced && item.serverTicketNumber ? (
                    <Text style={styles.ticketBadgeText}>{item.serverTicketNumber}</Text>
                  ) : (
                    <TouchableOpacity
                      onPress={() => removeDraft(item)}
                      accessibilityLabel="Delete draft"
                      style={styles.trashBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.cardMainRow}>
                  {item.photoUri ? (
                    <Image source={{ uri: item.photoUri }} style={styles.thumb} />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <Ionicons name="document-text-outline" size={24} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={styles.title} numberOfLines={2}>
                      {item.title || 'Draft pending title — tap Review to edit'}
                    </Text>
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
                  </View>
                </View>

                {(item.aiError || item.syncError) && (
                  <View style={styles.errBanner}>
                    <Ionicons name="alert-circle" size={15} color={colors.danger} />
                    <Text style={styles.errorText}>
                      {item.syncError ? `Upload: ${item.syncError}` : `AI: ${item.aiError}`}
                    </Text>
                  </View>
                )}

                <View style={styles.actions}>
                  {!isSynced ? (
                    <>
                      <AppButton
                        title="Review & Submit"
                        icon="create-outline"
                        onPress={() => router.push(`/(reporter)/draft/${item.localId}`)}
                        style={{ flex: 1, minHeight: 42, paddingVertical: 10 }}
                      />
                      {hasError && (
                        <AppButton
                          title="Retry"
                          icon="refresh-outline"
                          variant="secondary"
                          onPress={() => retryDraft(item)}
                          style={{ minHeight: 42, paddingVertical: 10, paddingHorizontal: 14 }}
                        />
                      )}
                    </>
                  ) : item.serverTicketId ? (
                    <AppButton
                      title={`View Ticket ${item.serverTicketNumber}`}
                      icon="open-outline"
                      variant="soft"
                      onPress={() => router.push(`/(reporter)/ticket/${item.serverTicketId}`)}
                      style={{ flex: 1, minHeight: 42, paddingVertical: 10 }}
                    />
                  ) : null}
                </View>
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
    heroStrip: {
      backgroundColor: colors.heroBg,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 16,
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
    connRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
    statusDot: { width: 8, height: 8, borderRadius: 999 },
    heroSub: { fontSize: 12.5, color: '#94A3B8', fontWeight: '500' },
    syncPillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.primary,
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 999,
    },
    syncPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    statRow: { flexDirection: 'row', gap: 10 },
    statCard: {
      flex: 1,
      backgroundColor: colors.navyLight,
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
    },
    statVal: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
    statLbl: { fontSize: 11.5, color: '#94A3B8', fontWeight: '600', marginTop: 1 },
    card: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      shadowColor: colors.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: colors.isDark ? 0.25 : 0.05,
      shadowRadius: 6,
      elevation: colors.isDark ? 1 : 2,
    },
    accentBar: { width: 4.5 },
    cardBody: { flex: 1, padding: 14, gap: 12 },
    cardTopMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    locPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      flexShrink: 1,
    },
    location: { fontSize: 11.5, fontWeight: '700', color: colors.primaryText },
    ticketBadgeText: { fontSize: 12.5, fontWeight: '800', color: colors.success },
    trashBtn: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: colors.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardMainRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    thumb: { width: 68, height: 68, borderRadius: 12 },
    thumbPlaceholder: {
      width: 68,
      height: 68,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 21 },
    badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    errBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: colors.dangerSoft,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
    },
    errorText: { flex: 1, fontSize: 12.5, color: colors.danger, fontWeight: '500', lineHeight: 17 },
    actions: {
      flexDirection: 'row',
      gap: 8,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    empty: { padding: 40, alignItems: 'center', gap: 8 },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 999,
      backgroundColor: colors.successSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
    emptyText: { color: colors.textMuted, fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
  });
}
