import { useCallback, useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { TicketDetailDTO } from '@campus/shared';
import {
  getMobileAuthToken,
  mobileApi,
  resolveMobileMediaUrl,
} from '../../../src/api/mobileApi';
import {
  AppButton,
  AudioPlaybackButton,
  PRIORITY_COLORS,
  PillBadge,
  STATUS_COLORS,
} from '../../../src/components/UiPrimitives';

export default function TechnicianJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await mobileApi.getTicket(id);
      setTicket(res.ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function handleStartWork() {
    if (!ticket) return;
    setBusy(true);
    setError(null);
    try {
      const res = await mobileApi.startWork(ticket.id, ticket.version);
      setTicket(res.ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start work.');
    } finally {
      setBusy(false);
    }
  }

  if (!ticket) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{loading ? 'Loading job...' : error ?? 'Not found.'}</Text>
      </View>
    );
  }

  const token = getMobileAuthToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
  const beforePhoto = ticket.attachments.find((a) => a.kind === 'before_photo');
  const voiceNote = ticket.attachments.find((a) => a.kind === 'voice_note');
  const sColor = STATUS_COLORS[ticket.status];
  const pColor = PRIORITY_COLORS[ticket.priority];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.badges}>
          <Text style={styles.ticketNum}>{ticket.ticketNumber}</Text>
          <PillBadge label={ticket.status} bg={sColor.bg} fg={sColor.fg} />
          <PillBadge label={ticket.priority} bg={pColor.bg} fg={pColor.fg} />
        </View>
        <Text style={styles.title}>{ticket.title}</Text>
        <Text style={styles.location}>
          {ticket.building.name} · {ticket.room.name} (Room {ticket.room.roomNumber},{' '}
          {ticket.room.floor})
        </Text>
        <Text style={styles.desc}>{ticket.description}</Text>

        {ticket.reopenReason && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Reopened Reason: {ticket.reopenReason}</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Original Field Evidence</Text>
        {beforePhoto ? (
          <Image
            source={{ uri: resolveMobileMediaUrl(beforePhoto.url), headers: authHeaders }}
            style={styles.img}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.muted}>No before photo attached.</Text>
        )}
        {voiceNote && (
          <View style={{ marginTop: 10 }}>
            <AudioPlaybackButton
              uri={resolveMobileMediaUrl(voiceNote.url)}
              headers={authHeaders}
              label="Play Reporter Voice Note"
            />
          </View>
        )}
      </View>

      {ticket.status === 'Assigned' && (
        <AppButton title="Start Work" onPress={handleStartWork} loading={busy} />
      )}

      {ticket.status === 'In Progress' && (
        <AppButton
          title="Submit Repair Photo & Note"
          variant="success"
          onPress={() =>
            router.push({
              pathname: '/(technician)/repair/[id]',
              params: { id: ticket.id, version: String(ticket.version) },
            })
          }
        />
      )}
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
  location: { fontSize: 14, fontWeight: '600', color: '#334155' },
  desc: { fontSize: 14, color: '#1e293b', lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  img: { width: '100%', height: 210, borderRadius: 8 },
  errorBox: { backgroundColor: '#fee2e2', padding: 10, borderRadius: 8 },
  errorText: { color: '#b91c1c', fontSize: 13 },
});
