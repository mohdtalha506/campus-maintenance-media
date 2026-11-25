import type { MaintenanceCategory, TicketPriority, TicketStatus } from '@campus/shared';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
  isDark: boolean;
  navy: string;
  navyLight: string;
  heroBg: string;
  heroCard: string;
  primary: string;
  primarySoft: string;
  primaryText: string;
  primaryBorder: string;
  amber: string;
  amberSoft: string;
  amberText: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  purple: string;
  purpleSoft: string;
  info: string;
  infoSoft: string;
  canvas: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  shadowColor: string;
}

export const LIGHT_COLORS: ThemeColors = {
  isDark: false,
  navy: '#0F172A',
  navyLight: '#1E293B',
  heroBg: '#0F172A',
  heroCard: '#1E293B',
  primary: '#1D4ED8',
  primarySoft: '#DBEAFE',
  primaryText: '#1D4ED8',
  primaryBorder: '#93C5FD',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  amberText: '#92400E',
  success: '#15803D',
  successSoft: '#DCFCE7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  purple: '#6D28D9',
  purpleSoft: '#EDE9FE',
  info: '#0369A1',
  infoSoft: '#E0F2FE',
  canvas: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  text: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  shadowColor: '#0F172A',
};

export const DARK_COLORS: ThemeColors = {
  isDark: true,
  navy: '#090E1A',
  navyLight: '#162033',
  heroBg: '#090E1A',
  heroCard: '#131C2E',
  primary: '#3B82F6',
  primarySoft: '#172554',
  primaryText: '#93C5FD',
  primaryBorder: '#1D4ED8',
  amber: '#F59E0B',
  amberSoft: '#451A03',
  amberText: '#FCD34D',
  success: '#22C55E',
  successSoft: '#052E16',
  danger: '#F87171',
  dangerSoft: '#450A0A',
  purple: '#A78BFA',
  purpleSoft: '#2E1065',
  info: '#38BDF8',
  infoSoft: '#082F49',
  canvas: '#0B1120',
  surface: '#131C2E',
  surfaceMuted: '#1B263B',
  border: '#253349',
  borderStrong: '#334155',
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  shadowColor: '#000000',
};

export const COLORS = LIGHT_COLORS;

export function getThemeColors(isDark: boolean): ThemeColors {
  return isDark ? DARK_COLORS : LIGHT_COLORS;
}

export type StatusStyleMap = Record<
  TicketStatus,
  { bg: string; fg: string; accent: string; icon: string }
>;

export type PriorityStyleMap = Record<
  TicketPriority,
  { bg: string; fg: string; icon: string }
>;

export type CategoryStyleMap = Record<
  MaintenanceCategory,
  { icon: string; bg: string; fg: string }
>;

export const STATUS_STYLE: StatusStyleMap = {
  New: { bg: '#E0F2FE', fg: '#0369A1', accent: '#0284C7', icon: 'sparkles-outline' },
  Assigned: { bg: '#DBEAFE', fg: '#1D4ED8', accent: '#2563EB', icon: 'person-outline' },
  'In Progress': { bg: '#FEF3C7', fg: '#B45309', accent: '#D97706', icon: 'construct-outline' },
  'Awaiting Verification': {
    bg: '#EDE9FE',
    fg: '#6D28D9',
    accent: '#7C3AED',
    icon: 'shield-checkmark-outline',
  },
  Closed: { bg: '#DCFCE7', fg: '#15803D', accent: '#16A34A', icon: 'checkmark-circle-outline' },
  Reopened: { bg: '#FEE2E2', fg: '#B91C1C', accent: '#DC2626', icon: 'refresh-circle-outline' },
};

export const DARK_STATUS_STYLE: StatusStyleMap = {
  New: { bg: '#082F49', fg: '#7DD3FC', accent: '#38BDF8', icon: 'sparkles-outline' },
  Assigned: { bg: '#172554', fg: '#93C5FD', accent: '#3B82F6', icon: 'person-outline' },
  'In Progress': { bg: '#451A03', fg: '#FCD34D', accent: '#F59E0B', icon: 'construct-outline' },
  'Awaiting Verification': {
    bg: '#2E1065',
    fg: '#DDD6FE',
    accent: '#A78BFA',
    icon: 'shield-checkmark-outline',
  },
  Closed: { bg: '#052E16', fg: '#86EFAC', accent: '#22C55E', icon: 'checkmark-circle-outline' },
  Reopened: { bg: '#450A0A', fg: '#FCA5A5', accent: '#F87171', icon: 'refresh-circle-outline' },
};

export const PRIORITY_STYLE: PriorityStyleMap = {
  Low: { bg: '#F1F5F9', fg: '#475569', icon: 'arrow-down-outline' },
  Medium: { bg: '#E0F2FE', fg: '#0369A1', icon: 'remove-outline' },
  High: { bg: '#FEF3C7', fg: '#B45309', icon: 'arrow-up-outline' },
  Urgent: { bg: '#FEE2E2', fg: '#B91C1C', icon: 'alert-circle-outline' },
};

export const DARK_PRIORITY_STYLE: PriorityStyleMap = {
  Low: { bg: '#1E293B', fg: '#CBD5E1', icon: 'arrow-down-outline' },
  Medium: { bg: '#082F49', fg: '#7DD3FC', icon: 'remove-outline' },
  High: { bg: '#451A03', fg: '#FCD34D', icon: 'arrow-up-outline' },
  Urgent: { bg: '#450A0A', fg: '#FCA5A5', icon: 'alert-circle-outline' },
};

export const CATEGORY_STYLE: CategoryStyleMap = {
  HVAC: { icon: 'snow-outline', bg: '#E0F2FE', fg: '#0369A1' },
  Plumbing: { icon: 'water-outline', bg: '#DBEAFE', fg: '#1D4ED8' },
  Electrical: { icon: 'flash-outline', bg: '#FEF3C7', fg: '#B45309' },
  Furniture: { icon: 'cube-outline', bg: '#F3E8FF', fg: '#7E22CE' },
  Civil: { icon: 'business-outline', bg: '#E2E8F0', fg: '#334155' },
  Other: { icon: 'build-outline', bg: '#F1F5F9', fg: '#475569' },
};

export const DARK_CATEGORY_STYLE: CategoryStyleMap = {
  HVAC: { icon: 'snow-outline', bg: '#082F49', fg: '#7DD3FC' },
  Plumbing: { icon: 'water-outline', bg: '#172554', fg: '#93C5FD' },
  Electrical: { icon: 'flash-outline', bg: '#451A03', fg: '#FCD34D' },
  Furniture: { icon: 'cube-outline', bg: '#2E1065', fg: '#DDD6FE' },
  Civil: { icon: 'business-outline', bg: '#1E293B', fg: '#CBD5E1' },
  Other: { icon: 'build-outline', bg: '#1E293B', fg: '#94A3B8' },
};

export function getStatusStyle(isDark: boolean): StatusStyleMap {
  return isDark ? DARK_STATUS_STYLE : STATUS_STYLE;
}

export function getPriorityStyle(isDark: boolean): PriorityStyleMap {
  return isDark ? DARK_PRIORITY_STYLE : PRIORITY_STYLE;
}

export function getCategoryStyle(isDark: boolean): CategoryStyleMap {
  return isDark ? DARK_CATEGORY_STYLE : CATEGORY_STYLE;
}
