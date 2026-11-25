import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { Audio } from 'expo-av';
import type { TicketPriority, TicketStatus } from '@campus/shared';

export const STATUS_COLORS: Record<TicketStatus, { bg: string; fg: string }> = {
  New: { bg: '#e0f2fe', fg: '#0369a1' },
  Assigned: { bg: '#dbeafe', fg: '#1d4ed8' },
  'In Progress': { bg: '#fef3c7', fg: '#b45309' },
  'Awaiting Verification': { bg: '#ede9fe', fg: '#6d28d9' },
  Closed: { bg: '#dcfce7', fg: '#15803d' },
  Reopened: { bg: '#fee2e2', fg: '#b91c1c' },
};

export const PRIORITY_COLORS: Record<TicketPriority, { bg: string; fg: string }> = {
  Low: { bg: '#f1f5f9', fg: '#475569' },
  Medium: { bg: '#e0f2fe', fg: '#0369a1' },
  High: { bg: '#fef3c7', fg: '#b45309' },
  Urgent: { bg: '#fee2e2', fg: '#b91c1c' },
};

export function PillBadge({
  label,
  bg,
  fg,
}: {
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === 'primary'
      ? '#1d4ed8'
      : variant === 'success'
        ? '#15803d'
        : variant === 'danger'
          ? '#b91c1c'
          : '#ffffff';
  const fg = variant === 'secondary' ? '#0f172a' : '#ffffff';
  const borderColor = variant === 'secondary' ? '#cbd5e1' : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor, opacity: disabled || loading ? 0.55 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function AudioPlaybackButton({
  uri,
  headers,
  label = 'Play Voice Note',
}: {
  uri: string;
  headers?: Record<string, string>;
  label?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (sound) {
        void sound.unloadAsync();
      }
    };
  }, [sound]);

  async function togglePlay() {
    try {
      if (playing && sound) {
        await sound.stopAsync();
        setPlaying(false);
        return;
      }

      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: loaded } = await Audio.Sound.createAsync(
        headers ? { uri, headers } : { uri },
        { shouldPlay: true }
      );
      setSound(loaded);
      setPlaying(true);
      loaded.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlaying(false);
        }
      });
    } catch {
      setPlaying(false);
    }
  }

  return (
    <AppButton
      title={playing ? 'Stop Playback' : label}
      variant="secondary"
      onPress={togglePlay}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
