export const USER_ROLES = ['reporter', 'supervisor', 'technician'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TICKET_STATUSES = [
  'New',
  'Assigned',
  'In Progress',
  'Awaiting Verification',
  'Closed',
  'Reopened',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const MAINTENANCE_CATEGORIES = [
  'HVAC',
  'Plumbing',
  'Electrical',
  'Furniture',
  'Civil',
  'Other',
] as const;
export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number];

export const ATTACHMENT_KINDS = ['before_photo', 'voice_note', 'after_photo'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const TICKET_EVENT_TYPES = [
  'created',
  'assigned',
  'reassigned',
  'priority_changed',
  'work_started',
  'repair_submitted',
  'closed',
  'reopened',
] as const;
export type TicketEventType = (typeof TICKET_EVENT_TYPES)[number];

export const ALLOWED_STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  New: ['Assigned'],
  Assigned: ['In Progress', 'Assigned'],
  'In Progress': ['Awaiting Verification', 'Assigned'],
  'Awaiting Verification': ['Closed', 'Reopened'],
  Closed: ['Reopened'],
  Reopened: ['Assigned'],
};

export function canTransitionStatus(from: TicketStatus, to: TicketStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/aac',
  'audio/3gpp',
  'audio/ogg',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AUDIO_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
