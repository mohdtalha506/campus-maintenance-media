import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import type { TicketDTO } from '@campus/shared';
import { mobileApi } from '../../src/api/mobileApi';
import {
  CategoryChip,
  PRIORITY_COLORS,
  PillBadge,
  STATUS_COLORS,
} from '../../src/components/UiPrimitives';
import { useMobile } from '../../src/context/MobileContext';
import { COLORS } from '../../src/theme/tokens';

export default function AssignedJobsScreen() {
  const { user } = useMobile();
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
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <FlatList
        data={jobs}
        keyExtractor={(j) => j.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadJobs} />}
        contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 28 }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="construct-outline" size={44} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No jobs assigned</Text>
              <Text style={styles.emptyText}>Pull down to refresh your dispatch queue.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const sColor = STATUS_COLORS[item.status];
          const pColor = PRIORITY_COLORS[item.priority];
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
                  <View style={{ flexDirection: 'row', gap: 6 }}>
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
                <Text style={styles.title}>{item.title}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.locRow}>
                    <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.meta}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  heroStrip: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  welcome: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  sub: { fontSize: 12, color: '#94A3B8', marginTop: 2, marginBottom: 12 },
  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.navyLight,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  statVal: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  statLbl: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 1 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 14,
    padding: 11,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 10,
  },
  errorText: { flex: 1, color: COLORS.danger, fontSize: 13 },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  accentBar: { width: 5 },
  cardBody: { flex: 1, padding: 14, gap: 8 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  ticketNum: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  empty: { padding: 48, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptyText: { color: COLORS.textMuted, fontSize: 13 },
});
