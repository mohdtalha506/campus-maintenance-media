import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  CategoryChip,
  PillBadge,
  SectionCard,
} from '../../../src/components/UiPrimitives';
import { useTheme } from '../../../src/context/MobileContext';
import type { ThemeColors } from '../../../src/theme/tokens';

export default function TechnicianJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, statusStyle, priorityStyle } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const sColor = statusStyle[ticket.status];
  const pColor = priorityStyle[ticket.priority];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={load}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.heroCard}>
        <View style={styles.badges}>
          <Text style={styles.ticketNum}>{ticket.ticketNumber}</Text>
          <PillBadge label={ticket.status} bg={sColor.bg} fg={sColor.fg} icon={sColor.icon} />
          <PillBadge label={ticket.priority} bg={pColor.bg} fg={pColor.fg} icon={pColor.icon} />
          <CategoryChip category={ticket.category} />
        </View>
        <Text style={styles.title}>{ticket.title}</Text>
        <View style={styles.locRow}>
          <Ionicons name="location-outline" size={15} color="#93C5FD" />
          <Text style={styles.location}>
            {ticket.building.name} · {ticket.room.name} (Room {ticket.room.roomNumber},{' '}
            {ticket.room.floor})
          </Text>
        </View>
      </View>

      <SectionCard title="Issue Description" icon="document-text-outline">
        <Text style={styles.desc}>{ticket.description}</Text>
        {ticket.reopenReason && (
          <View style={[styles.errorBox, { marginTop: 10 }]}>
            <Ionicons name="refresh-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>Reopened Reason: {ticket.reopenReason}</Text>
          </View>
        )}
      </SectionCard>

      <SectionCard title="Original Field Evidence" icon="camera-outline">
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
      </SectionCard>

      {ticket.status === 'Assigned' && (
        <AppButton
          title="Start Work"
          icon="play-circle-outline"
          onPress={handleStartWork}
          loading={busy}
        />
      )}

      {ticket.status === 'In Progress' && (
        <AppButton
          title="Submit Repair Photo & Note"
          icon="checkmark-done-circle-outline"
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    container: { padding: 14, gap: 12, paddingBottom: 32 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
    muted: { color: colors.textMuted },
    heroCard: {
      backgroundColor: colors.heroBg,
      borderRadius: 16,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.isDark ? colors.border : 'transparent',
    },
    badges: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
    ticketNum: { fontSize: 13, fontWeight: '800', color: '#93C5FD', marginRight: 4 },
    title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', lineHeight: 25 },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    location: { fontSize: 13, fontWeight: '500', color: '#CBD5E1', flex: 1 },
    desc: { fontSize: 14.5, color: colors.text, lineHeight: 22 },
    img: { width: '100%', height: 210, borderRadius: 12 },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.dangerSoft,
      padding: 12,
      borderRadius: 12,
    },
    errorText: { flex: 1, color: colors.danger, fontSize: 13.5, lineHeight: 19 },
  });
}
