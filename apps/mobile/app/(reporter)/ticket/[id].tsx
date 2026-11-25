import { useCallback, useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import type { TicketDetailDTO } from '@campus/shared';
import {
  getMobileAuthToken,
  mobileApi,
  resolveMobileMediaUrl,
} from '../../../src/api/mobileApi';
import {
  AudioPlaybackButton,
  CategoryChip,
  PRIORITY_COLORS,
  PillBadge,
  STATUS_COLORS,
  SectionCard,
} from '../../../src/components/UiPrimitives';
import { COLORS } from '../../../src/theme/tokens';

export default function ReporterTicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await mobileApi.getTicket(id);
      setTicket(res.ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ticket) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{loading ? 'Loading ticket...' : error ?? 'Not found.'}</Text>
      </View>
    );
  }

  const token = getMobileAuthToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
  const beforePhoto = ticket.attachments.find((a) => a.kind === 'before_photo');
  const afterPhoto = ticket.attachments.find((a) => a.kind === 'after_photo');
  const voiceNote = ticket.attachments.find((a) => a.kind === 'voice_note');
  const sColor = STATUS_COLORS[ticket.status];
  const pColor = PRIORITY_COLORS[ticket.priority];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={styles.heroCard}>
        <View style={styles.badges}>
          <Text style={styles.ticketNum}>{ticket.ticketNumber}</Text>
          <PillBadge label={ticket.status} bg={sColor.bg} fg={sColor.fg} icon={sColor.icon} />
          <PillBadge label={ticket.priority} bg={pColor.bg} fg={pColor.fg} icon={pColor.icon} />
          <CategoryChip category={ticket.category} />
        </View>
        <Text style={styles.title}>{ticket.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={15} color="#93C5FD" />
          <Text style={styles.metaLight}>
            {ticket.building.name} · Room {ticket.room.roomNumber} ({ticket.room.floor})
          </Text>
        </View>
      </View>

      <SectionCard title="Issue Details" icon="document-text-outline">
        <Text style={styles.desc}>{ticket.description}</Text>
        {ticket.assignee && (
          <View style={styles.assigneeRow}>
            <Ionicons name="person-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.assigneeText}>
              Assigned to <Text style={{ fontWeight: '700' }}>{ticket.assignee.name}</Text>
            </Text>
          </View>
        )}
        {ticket.completionNote && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
            <Text style={styles.successText}>Completion Note: {ticket.completionNote}</Text>
          </View>
        )}
        {ticket.reopenReason && (
          <View style={styles.errorBox}>
            <Ionicons name="refresh-circle" size={18} color={COLORS.danger} />
            <Text style={styles.errorText}>Reopen Reason: {ticket.reopenReason}</Text>
          </View>
        )}
      </SectionCard>

      <SectionCard title="Inspection & Repair Evidence" icon="images-outline">
        {beforePhoto && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.caption}>Before Repair</Text>
            <Image
              source={{ uri: resolveMobileMediaUrl(beforePhoto.url), headers: authHeaders }}
              style={styles.img}
              resizeMode="cover"
            />
          </View>
        )}
        {afterPhoto && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.caption}>After Repair</Text>
            <Image
              source={{ uri: resolveMobileMediaUrl(afterPhoto.url), headers: authHeaders }}
              style={styles.img}
              resizeMode="cover"
            />
          </View>
        )}
        {voiceNote && (
          <AudioPlaybackButton
            uri={resolveMobileMediaUrl(voiceNote.url)}
            headers={authHeaders}
            label="Play Original Voice Note"
          />
        )}
      </SectionCard>

      <SectionCard title="Status Timeline" icon="git-commit-outline">
        {ticket.events.map((ev, index) => (
          <View key={ev.id} style={styles.timelineItem}>
            <View
              style={[
                styles.timelineDot,
                index === ticket.events.length - 1 && { backgroundColor: COLORS.primary },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.evTitle}>
                {ev.eventType.replace(/_/g, ' ').toUpperCase()}
                {ev.toStatus ? ` → ${ev.toStatus}` : ''}
              </Text>
              <Text style={styles.evMeta}>
                {ev.actor.name} · {new Date(ev.createdAt).toLocaleString()}
              </Text>
            </View>
          </View>
        ))}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  container: { padding: 14, gap: 12, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: COLORS.textMuted },
  heroCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  badges: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  ticketNum: { fontSize: 13, fontWeight: '800', color: '#93C5FD', marginRight: 4 },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', lineHeight: 24 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaLight: { fontSize: 13, color: '#CBD5E1', fontWeight: '500' },
  desc: { fontSize: 14, color: COLORS.text, lineHeight: 21 },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  assigneeText: { fontSize: 13, color: COLORS.textSecondary },
  caption: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6 },
  img: { width: '100%', height: 210, borderRadius: 10 },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.successSoft,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  successText: { flex: 1, color: COLORS.success, fontSize: 13, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  errorText: { flex: 1, color: COLORS.danger, fontSize: 13, fontWeight: '600' },
  timelineItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
    paddingLeft: 12,
    marginLeft: 5,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: COLORS.borderStrong,
    marginLeft: -18,
    marginTop: 4,
  },
  evTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  evMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});
