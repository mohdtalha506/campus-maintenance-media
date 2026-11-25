import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import type { MaintenanceCategory } from '@campus/shared';
import {
  CATEGORY_STYLE,
  COLORS,
  PRIORITY_STYLE,
  STATUS_STYLE,
} from '../theme/tokens';

export const STATUS_COLORS = STATUS_STYLE;
export const PRIORITY_COLORS = PRIORITY_STYLE;

export function PillBadge({
  label,
  bg,
  fg,
  icon,
}: {
  label: string;
  bg: string;
  fg: string;
  icon?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={12}
          color={fg}
          style={{ marginRight: 4 }}
        />
      )}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function CategoryChip({ category }: { category: MaintenanceCategory }) {
  const cfg = CATEGORY_STYLE[category];
  return <PillBadge label={category} bg={cfg.bg} fg={cfg.fg} icon={cfg.icon} />;
}

export function SectionCard({
  title,
  subtitle,
  icon,
  children,
  style,
}: {
  title?: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.sectionCard, style]}>
      {title && (
        <View style={styles.sectionHeader}>
          {icon && (
            <View style={styles.sectionIconWrap}>
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={16}
                color={COLORS.primary}
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
          </View>
        </View>
      )}
      {children}
    </View>
  );
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'soft';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === 'primary'
      ? COLORS.primary
      : variant === 'success'
        ? COLORS.success
        : variant === 'danger'
          ? COLORS.danger
          : variant === 'soft'
            ? COLORS.primarySoft
            : COLORS.surface;
  const fg =
    variant === 'secondary'
      ? COLORS.text
      : variant === 'soft'
        ? COLORS.primary
        : '#FFFFFF';
  const borderColor = variant === 'secondary' ? COLORS.borderStrong : 'transparent';

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor, opacity: disabled || loading ? 0.55 : 1 },
        variant === 'primary' || variant === 'success' ? styles.buttonElevated : undefined,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={styles.buttonInner}>
          {icon && (
            <Ionicons
              name={icon as keyof typeof Ionicons.glyphMap}
              size={18}
              color={fg}
              style={{ marginRight: 7 }}
            />
          )}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </View>
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
      title={playing ? 'Stop Voice Playback' : label}
      icon={playing ? 'stop-circle-outline' : 'volume-high-outline'}
      variant={playing ? 'danger' : 'soft'}
      onPress={togglePlay}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  button: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonElevated: {
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
