import { useCallback, useEffect, useMemo, useState } from 'react';
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
  PillBadge,
  SectionCard,
} from '../../../src/components/UiPrimitives';
import { useTheme } from '../../../src/context/MobileContext';
import type { ThemeColors } from '../../../src/theme/tokens';

export default function ReporterTicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, statusStyle, priorityStyle } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
            <Ionicons name="person-circle-outline" size={18} color={colors.primaryText} />
            <Text style={styles.assigneeText}>
              Assigned to <Text style={{ fontWeight: '700', color: colors.text }}>{ticket.assignee.name}</Text>
            </Text>
          </View>
        )}
        {ticket.completionNote && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.successText}>Completion Note: {ticket.completionNote}</Text>
          </View>
        )}
        {ticket.reopenReason && (
          <View style={styles.errorBox}>
            <Ionicons name="refresh-circle" size={18} color={colors.danger} />
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
                index === ticket.events.length - 1 && { backgroundColor: colors.primary },
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
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaLight: { fontSize: 13, color: '#CBD5E1', fontWeight: '500' },
    desc: { fontSize: 14.5, color: colors.text, lineHeight: 22 },
    assigneeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    assigneeText: { fontSize: 13.5, color: colors.textSecondary },
    caption: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
    img: { width: '100%', height: 210, borderRadius: 12 },
    successBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.successSoft,
      padding: 12,
      borderRadius: 12,
      marginTop: 10,
    },
    successText: { flex: 1, color: colors.success, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.dangerSoft,
      padding: 12,
      borderRadius: 12,
      marginTop: 10,
    },
    errorText: { flex: 1, color: colors.danger, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
    timelineItem: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 7,
      borderLeftWidth: 2,
      borderLeftColor: colors.border,
      paddingLeft: 12,
      marginLeft: 5,
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.borderStrong,
      marginLeft: -18,
      marginTop: 4,
    },
    evTitle: { fontSize: 13.5, fontWeight: '700', color: colors.text },
    evMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  });
}
