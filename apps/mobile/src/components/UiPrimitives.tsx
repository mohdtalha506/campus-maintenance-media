import React, { useEffect, useMemo, useState } from 'react';
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
import { useTheme } from '../context/MobileContext';
import { PRIORITY_STYLE, STATUS_STYLE, type ThemeColors } from '../theme/tokens';

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
    <View style={[staticStyles.badge, { backgroundColor: bg }]}>
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={12}
          color={fg}
          style={{ marginRight: 4 }}
        />
      )}
      <Text style={[staticStyles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function CategoryChip({ category }: { category: MaintenanceCategory }) {
  const { categoryStyle } = useTheme();
  const cfg = categoryStyle[category];
  return <PillBadge label={category} bg={cfg.bg} fg={cfg.fg} icon={cfg.icon} />;
}

export function ThemeToggleButton({ lightOnDarkHeader = true }: { lightOnDarkHeader?: boolean }) {
  const { isDark, colors, toggleTheme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => {
        void toggleTheme();
      }}
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={[
        staticStyles.themeBtn,
        {
          backgroundColor: lightOnDarkHeader
            ? 'rgba(255, 255, 255, 0.12)'
            : colors.surfaceMuted,
          borderColor: lightOnDarkHeader
            ? 'rgba(255, 255, 255, 0.18)'
            : colors.borderStrong,
        },
      ]}
    >
      <Ionicons
        name={isDark ? 'sunny' : 'moon'}
        size={16}
        color={lightOnDarkHeader ? (isDark ? '#FBBF24' : '#E2E8F0') : colors.text}
      />
    </TouchableOpacity>
  );
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.sectionCard, style]}>
      {title && (
        <View style={styles.sectionHeader}>
          {icon && (
            <View style={styles.sectionIconWrap}>
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={16}
                color={colors.primaryText}
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
  const { colors } = useTheme();
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'success'
        ? colors.success
        : variant === 'danger'
          ? colors.danger
          : variant === 'soft'
            ? colors.primarySoft
            : colors.surfaceMuted;
  const fg =
    variant === 'secondary'
      ? colors.text
      : variant === 'soft'
        ? colors.primaryText
        : '#FFFFFF';
  const borderColor =
    variant === 'secondary'
      ? colors.borderStrong
      : variant === 'soft'
        ? colors.primaryBorder
        : 'transparent';

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        staticStyles.button,
        {
          backgroundColor: bg,
          borderColor,
          opacity: disabled || loading ? 0.55 : 1,
        },
        (variant === 'primary' || variant === 'success') && !colors.isDark
          ? staticStyles.buttonElevated
          : undefined,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={staticStyles.buttonInner}>
          {icon && (
            <Ionicons
              name={icon as keyof typeof Ionicons.glyphMap}
              size={18}
              color={fg}
              style={title ? { marginRight: 7 } : undefined}
            />
          )}
          {title ? <Text style={[staticStyles.buttonText, { color: fg }]}>{title}</Text> : null}
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

const staticStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  themeBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonElevated: {
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
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
    letterSpacing: 0.1,
  },
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: colors.isDark ? 0.28 : 0.05,
      shadowRadius: 8,
      elevation: colors.isDark ? 1 : 2,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    sectionIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 9,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 15.5,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 21,
    },
    sectionSubtitle: {
      fontSize: 12.5,
      color: colors.textMuted,
      marginTop: 1,
      lineHeight: 17,
    },
  });
}
