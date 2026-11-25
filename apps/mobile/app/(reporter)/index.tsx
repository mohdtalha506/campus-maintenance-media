import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TICKET_STATUSES, type TicketDTO, type TicketStatus } from '@campus/shared';
import { mobileApi } from '../../src/api/mobileApi';
import {
  AppButton,
  CategoryChip,
  PRIORITY_COLORS,
  PillBadge,
  STATUS_COLORS,
} from '../../src/components/UiPrimitives';
import { useMobile } from '../../src/context/MobileContext';
import { COLORS } from '../../src/theme/tokens';

export default function MyReportsScreen() {
  const { user, isOnline, aiReadyBanner, dismissAiReadyBanner } = useMobile();
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
          : 'Offline mode: submitted server tickets load when connected. Create drafts in Report Issue.'
      );
    } finally {
      setLoading(false);
    }
  }, [isOnline, search, statusFilter]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const stats = useMemo(() => {
    const active = tickets.filter((t) => t.status !== 'Closed').length;
    const closed = tickets.filter((t) => t.status === 'Closed').length;
    return { total: tickets.length, active, closed };
  }, [tickets]);

  return (
    <View style={styles.root}>
      <View style={styles.heroStrip}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.welcome}>Hello, {user?.name ?? 'Reporter'}</Text>
            <Text style={styles.welcomeSub}>Track campus issues &amp; repair progress</Text>
          </View>
          <TouchableOpacity
            style={styles.quickNewBtn}
            onPress={() => router.push('/(reporter)/new')}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.quickNewText}>New</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.total}</Text>
            <Text style={styles.statLbl}>Shown</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: '#FBBF24' }]}>{stats.active}</Text>
            <Text style={styles.statLbl}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: '#4ADE80' }]}>{stats.closed}</Text>
            <Text style={styles.statLbl}>Closed</Text>
          </View>
        </View>
      </View>

      {aiReadyBanner && (
        <TouchableOpacity
          style={styles.readyBanner}
          onPress={() => {
            dismissAiReadyBanner();
            router.push('/(reporter)/queue');
          }}
        >
          <Ionicons name="sparkles" size={16} color={COLORS.primary} />
          <Text style={styles.readyText}>{aiReadyBanner} Tap to review.</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      )}

      <View style={styles.searchBarWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search ticket #, title, room..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={loadTickets}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 14, alignItems: 'center' }}
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
          <Ionicons name="information-circle" size={18} color={COLORS.amber} />
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTickets} />}
        contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="clipboard-outline" size={42} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No reports found</Text>
              <Text style={styles.emptyText}>
                Capture a photo and voice note to create your first maintenance ticket.
              </Text>
              <AppButton
                title="Report New Issue"
                icon="camera-outline"
                onPress={() => router.push('/(reporter)/new')}
                style={{ marginTop: 12 }}
              />
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
              onPress={() => router.push(`/(reporter)/ticket/${item.id}`)}
            >
              <View style={[styles.accentBar, { backgroundColor: sColor.accent }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
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

                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>

                <View style={styles.metaRow}>
                  <View style={styles.locRow}>
                    <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.cardMeta}>
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
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  welcome: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  welcomeSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  quickNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  quickNewText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
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
  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primarySoft,
    marginHorizontal: 14,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  readyText: { flex: 1, color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  searchBarWrap: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  chipScroll: { maxHeight: 42, marginBottom: 4 },
  filterChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  filterChipTextActive: { color: '#FFFFFF' },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 8,
    padding: 11,
    backgroundColor: COLORS.amberSoft,
    borderRadius: 10,
  },
  noticeText: { flex: 1, color: '#92400E', fontSize: 13 },
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
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  ticketNum: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, lineHeight: 21 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMeta: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  empty: { padding: 36, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 6 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },
});
