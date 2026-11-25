import type { TicketPriority, TicketStatus } from '@campus/shared';

const STATUS_CLASS: Record<TicketStatus, string> = {
  New: 'status-new',
  Assigned: 'status-assigned',
  'In Progress': 'status-in-progress',
  'Awaiting Verification': 'status-awaiting-verification',
  Closed: 'status-closed',
  Reopened: 'status-reopened',
};

const PRIORITY_CLASS: Record<TicketPriority, string> = {
  Low: 'priority-low',
  Medium: 'priority-medium',
  High: 'priority-high',
  Urgent: 'priority-urgent',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge ${STATUS_CLASS[status]}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <span className={`badge ${PRIORITY_CLASS[priority]}`}>{priority}</span>;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
