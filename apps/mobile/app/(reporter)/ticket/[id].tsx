import { useCallback, useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { TicketDetailDTO } from '@campus/shared';
import {
  getMobileAuthToken,
  mobileApi,
  resolveMobileMediaUrl,
} from '../../../src/api/mobileApi';
import {
  AudioPlaybackButton,
  PRIORITY_COLORS,
  PillBadge,
  STATUS_COLORS,
} from '../../../src/components/UiPrimitives';

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
      <View style={styles.card}>
        <View style={styles.badges}>
          <Text style={styles.ticketNum}>{ticket.ticketNumber}</Text>
          <PillBadge label={ticket.status} bg={sColor.bg} fg={sColor.fg} />
          <PillBadge label={ticket.priority} bg={pColor.bg} fg={pColor.fg} />
        </View>
        <Text style={styles.title}>{ticket.title}</Text>
        <Text style={styles.meta}>
          {ticket.building.name} · Room {ticket.room.roomNumber} · {ticket.category}
        </Text>
        <Text style={styles.desc}>{ticket.description}</Text>

        {ticket.assignee && (
          <Text style={styles.meta}>Assigned Technician: {ticket.assignee.name}</Text>
        )}
        {ticket.completionNote && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              Completion Note: {ticket.completionNote}
            </Text>
          </View>
        )}
        {ticket.reopenReason && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Reopen Reason: {ticket.reopenReason}</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Evidence</Text>
        {beforePhoto && (
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.caption}>Before Repair</Text>
            <Image
              source={{ uri: resolveMobileMediaUrl(beforePhoto.url), headers: authHeaders }}
              style={styles.img}
              resizeMode="cover"
            />
          </View>
        )}
        {afterPhoto && (
          <View style={{ marginBottom: 10 }}>
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
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Status Timeline</Text>
        {ticket.events.map((ev) => (
          <View key={ev.id} style={styles.timelineItem}>
            <Text style={styles.evTitle}>
              {ev.eventType.replace(/_/g, ' ').toUpperCase()}
              {ev.toStatus ? ` → ${ev.toStatus}` : ''}
            </Text>
            <Text style={styles.evMeta}>
              {ev.actor.name} · {new Date(ev.createdAt).toLocaleString()}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f9' },
  container: { padding: 14, gap: 12, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#64748b' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  badges: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  ticketNum: { fontSize: 13, fontWeight: '700', color: '#1d4ed8' },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 13, color: '#475569' },
  desc: { fontSize: 14, color: '#1e293b', lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  caption: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 },
  img: { width: '100%', height: 200, borderRadius: 8 },
  successBox: { backgroundColor: '#dcfce7', padding: 10, borderRadius: 8 },
  successText: { color: '#15803d', fontSize: 13 },
  errorBox: { backgroundColor: '#fee2e2', padding: 10, borderRadius: 8 },
  errorText: { color: '#b91c1c', fontSize: 13 },
  timelineItem: {
    borderLeftWidth: 2,
    borderLeftColor: '#cbd5e1',
    paddingLeft: 10,
    paddingVertical: 4,
  },
  evTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  evMeta: { fontSize: 12, color: '#64748b' },
});
