import type { MaintenanceCategory, TicketPriority, TicketStatus } from '@campus/shared';

export const COLORS = {
  navy: '#0F172A',
  navyLight: '#1E293B',
  primary: '#1D4ED8',
  primarySoft: '#DBEAFE',
  primaryBorder: '#93C5FD',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  success: '#15803D',
  successSoft: '#DCFCE7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  purple: '#6D28D9',
  purpleSoft: '#EDE9FE',
  info: '#0369A1',
  infoSoft: '#E0F2FE',
  canvas: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
};

export const STATUS_STYLE: Record<
  TicketStatus,
  { bg: string; fg: string; accent: string; icon: string }
> = {
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

export const PRIORITY_STYLE: Record<
  TicketPriority,
  { bg: string; fg: string; icon: string }
> = {
  Low: { bg: '#F1F5F9', fg: '#475569', icon: 'arrow-down-outline' },
  Medium: { bg: '#E0F2FE', fg: '#0369A1', icon: 'remove-outline' },
  High: { bg: '#FEF3C7', fg: '#B45309', icon: 'arrow-up-outline' },
  Urgent: { bg: '#FEE2E2', fg: '#B91C1C', icon: 'alert-circle-outline' },
};

export const CATEGORY_STYLE: Record<
  MaintenanceCategory,
  { icon: string; bg: string; fg: string }
> = {
  HVAC: { icon: 'snow-outline', bg: '#E0F2FE', fg: '#0369A1' },
  Plumbing: { icon: 'water-outline', bg: '#DBEAFE', fg: '#1D4ED8' },
  Electrical: { icon: 'flash-outline', bg: '#FEF3C7', fg: '#B45309' },
  Furniture: { icon: 'cube-outline', bg: '#F3E8FF', fg: '#7E22CE' },
  Civil: { icon: 'business-outline', bg: '#E2E8F0', fg: '#334155' },
  Other: { icon: 'build-outline', bg: '#F1F5F9', fg: '#475569' },
};
