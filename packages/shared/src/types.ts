import type {
  AttachmentKind,
  MaintenanceCategory,
  TicketEventType,
  TicketPriority,
  TicketStatus,
  UserRole,
} from './constants.js';

export interface UserSummaryDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface BuildingDTO {
  id: string;
  name: string;
  code: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoomDTO {
  id: string;
  buildingId: string;
  buildingName?: string;
  name: string;
  roomNumber: string;
  floor: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentDTO {
  id: string;
  ticketId: string;
  uploadedBy: string;
  kind: AttachmentKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export interface AiDraftDTO {
  title: string;
  description: string;
  suggestedCategory: MaintenanceCategory;
  transcript: string;
  model: string;
  generatedAt: string;
  isMock: boolean;
}

export interface TicketEventDTO {
  id: string;
  ticketId: string;
  actor: {
    id: string;
    name: string;
    role: UserRole;
  };
  eventType: TicketEventType;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface TicketDTO {
  id: string;
  ticketNumber: string;
  clientSubmissionId: string;
  reporter: {
    id: string;
    name: string;
    email: string;
  };
  building: {
    id: string;
    name: string;
    code: string;
  };
  room: {
    id: string;
    name: string;
    roomNumber: string;
    floor: string;
  };
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: {
    id: string;
    name: string;
    email: string;
  } | null;
  aiDraft: AiDraftDTO | null;
  completionNote: string | null;
  reopenReason: string | null;
  version: number;
  attachments: AttachmentDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetailDTO extends TicketDTO {
  events: TicketEventDTO[];
}

export interface PaginatedTicketsResponse {
  items: TicketDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardSummaryDTO {
  counts: Record<TicketStatus, number>;
  total: number;
  recentTickets: TicketDTO[];
}

export interface LoginResponseDTO {
  user: UserSummaryDTO;
  token?: string;
}

export interface NotificationDTO {
  id: string;
  userId: string;
  ticketId: string | null;
  ticketNumber: string | null;
  title: string;
  body: string;
  eventType: TicketEventType;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResponseDTO {
  items: NotificationDTO[];
  unreadCount: number;
}
