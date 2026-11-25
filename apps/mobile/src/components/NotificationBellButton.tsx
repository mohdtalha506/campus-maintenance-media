import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMobile, useTheme } from '../context/MobileContext';
import type { ThemeColors } from '../theme/tokens';

export function NotificationBellButton() {
  const {
    user,
    notifications,
    unreadCount,
    pushStatusMessage,
    markNotificationRead,
    markAllNotificationsRead,
  } = useMobile();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.bellBtn}
        accessibilityLabel="Notifications"
      >
        <Ionicons name="notifications-outline" size={19} color="#E2E8F0" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <Ionicons name="notifications" size={18} color={colors.primaryText} />
                <Text style={styles.sheetTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadPill}>
                    <Text style={styles.unreadPillText}>{unreadCount} new</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      void markAllNotificationsRead();
                    }}
                  >
                    <Text style={styles.markAllText}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {pushStatusMessage && (
              <View style={styles.statusStrip}>
                <Ionicons name="radio-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.statusStripText}>{pushStatusMessage}</Text>
              </View>
            )}

            <FlatList
              data={notifications}
              keyExtractor={(n) => n.id}
              contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 28 }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="notifications-off-outline" size={38} color={colors.textMuted} />
                  <Text style={styles.emptyText}>No notifications yet</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.82}
                  style={[styles.notifCard, !item.read && styles.notifCardUnread]}
                  onPress={() => {
                    void markNotificationRead(item.id);
                    setOpen(false);
                    if (item.ticketId) {
                      if (user?.role === 'technician') {
                        router.push(`/(technician)/job/${item.ticketId}`);
                      } else {
                        router.push(`/(reporter)/ticket/${item.ticketId}`);
                      }
                    }
                  }}
                >
                  <View style={styles.notifTop}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    {!item.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notifBody}>{item.body}</Text>
                  <Text style={styles.notifTime}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bellBtn: {
      width: 34,
      height: 34,
      borderRadius: 999,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 17,
      height: 17,
      borderRadius: 999,
      backgroundColor: '#EF4444',
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: '#0F172A',
    },
    badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.canvas,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: '78%',
      minHeight: 280,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sheetTitle: { fontSize: 16.5, fontWeight: '800', color: colors.text },
    unreadPill: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    unreadPillText: { fontSize: 11.5, fontWeight: '700', color: colors.primaryText },
    markAllText: { fontSize: 12.5, fontWeight: '700', color: colors.primaryText },
    closeBtn: { padding: 4 },
    statusStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.surfaceMuted,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    statusStripText: { fontSize: 11.5, color: colors.textSecondary, flex: 1 },
    empty: { padding: 40, alignItems: 'center', gap: 8 },
    emptyText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
    notifCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 13,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    notifCardUnread: {
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primarySoft,
    },
    notifTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    notifTitle: { fontSize: 14, fontWeight: '800', color: colors.text, flex: 1 },
    unreadDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.primary },
    notifBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    notifTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  });
}
