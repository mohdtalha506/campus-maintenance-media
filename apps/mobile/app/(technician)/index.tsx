import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { TicketDTO } from '@campus/shared';
import { mobileApi } from '../../src/api/mobileApi';
import { PRIORITY_COLORS, PillBadge, STATUS_COLORS } from '../../src/components/UiPrimitives';

export default function AssignedJobsScreen() {
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

  return (
    <View style={styles.root}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <FlatList
        data={jobs}
        keyExtractor={(j) => j.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadJobs} />}
        contentContainerStyle={{ padding: 14, gap: 10 }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No maintenance jobs currently assigned to you.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const sColor = STATUS_COLORS[item.status];
          const pColor = PRIORITY_COLORS[item.priority];
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(technician)/job/${item.id}`)}
            >
              <View style={styles.topRow}>
                <Text style={styles.ticketNum}>{item.ticketNumber}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <PillBadge label={item.priority} bg={pColor.bg} fg={pColor.fg} />
                  <PillBadge label={item.status} bg={sColor.bg} fg={sColor.fg} />
                </View>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {item.building.name} · Room {item.room.roomNumber} · {item.category}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f9' },
  errorBox: { margin: 14, padding: 10, backgroundColor: '#fee2e2', borderRadius: 8 },
  errorText: { color: '#b91c1c', fontSize: 13 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 5,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketNum: { fontSize: 13, fontWeight: '700', color: '#1d4ed8' },
  title: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  meta: { fontSize: 13, color: '#64748b' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 14 },
});
