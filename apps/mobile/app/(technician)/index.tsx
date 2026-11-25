import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import type { TicketDTO } from '@campus/shared';
import { mobileApi } from '../../src/api/mobileApi';
import {
  CategoryChip,
  PillBadge,
} from '../../src/components/UiPrimitives';
import { useMobile, useTheme } from '../../src/context/MobileContext';
import type { ThemeColors } from '../../src/theme/tokens';

export default function AssignedJobsScreen() {
  const { user } = useMobile();
  const { colors, statusStyle, priorityStyle } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [jobs, setJobs] = useState<TicketDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await mobileApi.listTickets({ limit: 50 });
      setJobs(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assigned jobs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useFocusEffect(
    useCallback(() => {
      void loadJobs();
    }, [loadJobs])
  );

  const counts = useMemo(() => {
    return {
      assigned: jobs.filter((j) => j.status === 'Assigned').length,
      inProgress: jobs.filter((j) => j.status === 'In Progress').length,
      awaiting: jobs.filter((j) => j.status === 'Awaiting Verification').length,
    };
  }, [jobs]);

  return (
    <View style={styles.root}>
      <View style={styles.heroStrip}>
        <Text style={styles.welcome}>{user?.name ?? 'Technician'}</Text>
        <Text style={styles.sub}>Field Dispatch Queue</Text>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{counts.assigned}</Text>
            <Text style={styles.statLbl}>Assigned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: '#FBBF24' }]}>{counts.inProgress}</Text>
            <Text style={styles.statLbl}>In Progress</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: '#C4B5FD' }]}>{counts.awaiting}</Text>
            <Text style={styles.statLbl}>Awaiting Check</Text>
          </View>
        </View>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <FlatList
        data={jobs}
        keyExtractor={(j) => j.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadJobs}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 28 }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="construct-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No jobs assigned</Text>
              <Text style={styles.emptyText}>Pull down to refresh your dispatch queue.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const sColor = statusStyle[item.status];
          const pColor = priorityStyle[item.priority];
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.card}
              onPress={() => router.push(`/(technician)/job/${item.id}`)}
            >
              <View style={[styles.accentBar, { backgroundColor: sColor.accent }]} />
              <View style={styles.cardBody}>
                <View style={styles.topRow}>
                  <Text style={styles.ticketNum}>{item.ticketNumber}</Text>
                  <View style={styles.pillRow}>
                    <PillBadge
                      label={item.priority}
                      bg={pColor.bg}
                      fg={pColor.fg}
                      icon={pColor.icon}
                    />
                    <PillBadge
                      label={item.status}
                      bg={sColor.bg}
                      fg={sColor.fg}
                      icon={sColor.icon}
                    />
                  </View>
                </View>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.metaRow}>
                  <View style={styles.locRow}>
                    <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.meta} numberOfLines={1}>
                      {item.building.name} · Room {item.room.roomNumber}
                    </Text>
                  </View>
                  <CategoryChip category={item.category} />
                </View>
              </View>
            </TouchableOpacity>
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
      paddingTop: 8,
      paddingBottom: 16,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    },
    welcome: { fontSize: 17.5, fontWeight: '800', color: '#FFFFFF' },
    sub: { fontSize: 12.5, color: '#94A3B8', marginTop: 2, marginBottom: 12 },
    statRow: { flexDirection: 'row', gap: 10 },
    statCard: {
      flex: 1,
      backgroundColor: colors.navyLight,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
    },
    statVal: { fontSize: 19, fontWeight: '800', color: '#FFFFFF' },
    statLbl: { fontSize: 11.5, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      margin: 14,
      padding: 12,
      backgroundColor: colors.dangerSoft,
      borderRadius: 12,
    },
    errorText: { flex: 1, color: colors.danger, fontSize: 13.5, lineHeight: 19 },
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
    cardBody: { flex: 1, padding: 15, gap: 10 },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    ticketNum: { fontSize: 13, fontWeight: '800', color: colors.primaryText, letterSpacing: 0.2 },
    title: { fontSize: 15.5, fontWeight: '700', color: colors.text, lineHeight: 22 },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: 140 },
    meta: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '600', flexShrink: 1 },
    empty: { padding: 48, alignItems: 'center', gap: 6 },
    emptyTitle: { fontSize: 16.5, fontWeight: '700', color: colors.text },
    emptyText: { color: colors.textMuted, fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
  });
}
