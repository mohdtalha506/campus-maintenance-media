import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { TICKET_STATUSES, type TicketDTO, type TicketStatus } from '@campus/shared';
import { mobileApi } from '../../src/api/mobileApi';
import {
  PRIORITY_COLORS,
  PillBadge,
  STATUS_COLORS,
} from '../../src/components/UiPrimitives';
import { useMobile } from '../../src/context/MobileContext';

export default function MyReportsScreen() {
  const { isOnline, aiReadyBanner, dismissAiReadyBanner } = useMobile();
  const router = useRouter();

  const [tickets, setTickets] = useState<TicketDTO[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await mobileApi.listTickets({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        limit: 50,
      });
      setTickets(res.items);
    } catch (err) {
      setError(
        isOnline
          ? err instanceof Error
            ? err.message
            : 'Could not load submitted reports.'
          : 'Offline mode: submitted server tickets load when connected. Create drafts in New Report.'
      );
    } finally {
      setLoading(false);
    }
  }, [isOnline, search, statusFilter]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  return (
    <View style={styles.root}>
      {aiReadyBanner && (
        <TouchableOpacity style={styles.readyBanner} onPress={() => {
          dismissAiReadyBanner();
          router.push('/(reporter)/queue');
        }}>
          <Text style={styles.readyText}>{aiReadyBanner} Tap to review.</Text>
        </TouchableOpacity>
      )}

      <View style={styles.searchBarWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search ticket #, title, description..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={loadTickets}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }}
      >
        <TouchableOpacity
          style={[styles.filterChip, !statusFilter && styles.filterChipActive]}
          onPress={() => setStatusFilter('')}
        >
          <Text style={[styles.filterChipText, !statusFilter && styles.filterChipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {TICKET_STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text
              style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {error && (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTickets} />}
        contentContainerStyle={{ padding: 14, gap: 10 }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No submitted tickets found.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const sColor = STATUS_COLORS[item.status];
          const pColor = PRIORITY_COLORS[item.priority];
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(reporter)/ticket/${item.id}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.ticketNum}>{item.ticketNumber}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <PillBadge label={item.priority} bg={pColor.bg} fg={pColor.fg} />
                  <PillBadge label={item.status} bg={sColor.bg} fg={sColor.fg} />
                </View>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
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
  readyBanner: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  readyText: { color: '#1e40af', fontWeight: '600', fontSize: 13 },
  searchBarWrap: { padding: 14, paddingBottom: 8 },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  chipScroll: { maxHeight: 44, marginBottom: 4 },
  filterChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'center',
  },
  filterChipActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  filterChipTextActive: { color: '#ffffff' },
  noticeBox: {
    marginHorizontal: 14,
    marginTop: 6,
    padding: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  noticeText: { color: '#92400e', fontSize: 13 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketNum: { fontSize: 13, fontWeight: '700', color: '#1d4ed8' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  cardMeta: { fontSize: 13, color: '#64748b' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 14 },
});
