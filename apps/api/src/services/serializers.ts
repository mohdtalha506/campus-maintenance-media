import type {
  AttachmentDTO,
  BuildingDTO,
  RoomDTO,
  TicketDTO,
  TicketDetailDTO,
  TicketEventDTO,
  UserRole,
} from '@campus/shared';
import type { IAttachment } from '../models/Attachment.js';
import type { IBuilding } from '../models/Building.js';
import type { IRoom } from '../models/Room.js';
import type { ITicket } from '../models/Ticket.js';
import type { ITicketEvent } from '../models/TicketEvent.js';

export function serializeBuilding(doc: IBuilding | (Record<string, unknown> & { _id: unknown })): BuildingDTO {
  const b = doc as IBuilding;
  return {
    id: b._id.toString(),
    name: b.name,
    code: b.code,
    description: b.description ?? '',
    active: b.active,
    createdAt: new Date(b.createdAt).toISOString(),
    updatedAt: new Date(b.updatedAt).toISOString(),
  };
}

export function serializeRoom(
  doc: IRoom | (Record<string, unknown> & { _id: unknown }),
  buildingName?: string
): RoomDTO {
  const r = doc as IRoom & { buildingId: { _id?: unknown; name?: string } | unknown };
  const rawBuilding = r.buildingId as { _id?: { toString(): string }; name?: string } | { toString(): string };
  const buildingId =
    typeof rawBuilding === 'object' && rawBuilding !== null && '_id' in rawBuilding && rawBuilding._id
      ? rawBuilding._id.toString()
      : (rawBuilding as { toString(): string }).toString();
  const resolvedBuildingName =
    buildingName ??
    (typeof rawBuilding === 'object' && rawBuilding !== null && 'name' in rawBuilding
      ? rawBuilding.name
      : undefined);

  return {
    id: r._id.toString(),
    buildingId,
    ...(resolvedBuildingName ? { buildingName: resolvedBuildingName } : {}),
    name: r.name,
    roomNumber: r.roomNumber,
    floor: r.floor ?? 'Ground',
    active: r.active,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  };
}

export function serializeAttachment(doc: IAttachment): AttachmentDTO {
  const ticketId = doc.ticketId.toString();
  const id = doc._id.toString();
  return {
    id,
    ticketId,
    uploadedBy: doc.uploadedBy.toString(),
    kind: doc.kind,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    url: `/api/tickets/${ticketId}/attachments/${id}/content`,
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

interface PopulatedUserRef {
  _id: { toString(): string };
  name: string;
  email: string;
  role?: UserRole;
}

interface PopulatedBuildingRef {
  _id: { toString(): string };
  name: string;
  code: string;
}

interface PopulatedRoomRef {
  _id: { toString(): string };
  name: string;
  roomNumber: string;
  floor: string;
}

export function serializeTicket(
  doc: ITicket | Record<string, unknown>,
  attachments: IAttachment[] = []
): TicketDTO {
  const t = doc as unknown as ITicket & {
    reporterId: PopulatedUserRef;
    buildingId: PopulatedBuildingRef;
    roomId: PopulatedRoomRef;
    assigneeId: PopulatedUserRef | null;
  };

  return {
    id: t._id.toString(),
    ticketNumber: t.ticketNumber,
    clientSubmissionId: t.clientSubmissionId,
    reporter: {
      id: t.reporterId._id.toString(),
      name: t.reporterId.name,
      email: t.reporterId.email,
    },
    building: {
      id: t.buildingId._id.toString(),
      name: t.buildingId.name,
      code: t.buildingId.code,
    },
    room: {
      id: t.roomId._id.toString(),
      name: t.roomId.name,
      roomNumber: t.roomId.roomNumber,
      floor: t.roomId.floor,
    },
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    assignee: t.assigneeId
      ? {
          id: t.assigneeId._id.toString(),
          name: t.assigneeId.name,
          email: t.assigneeId.email,
        }
      : null,
    aiDraft: t.aiDraft
      ? {
          title: t.aiDraft.title,
          description: t.aiDraft.description,
          suggestedCategory: t.aiDraft.suggestedCategory,
          transcript: t.aiDraft.transcript,
          model: t.aiDraft.model,
          generatedAt: new Date(t.aiDraft.generatedAt).toISOString(),
          isMock: t.aiDraft.isMock,
        }
      : null,
    completionNote: t.completionNote ?? null,
    reopenReason: t.reopenReason ?? null,
    version: t.version,
    attachments: attachments.map(serializeAttachment),
    createdAt: new Date(t.createdAt).toISOString(),
    updatedAt: new Date(t.updatedAt).toISOString(),
  };
}

export function serializeTicketEvent(doc: ITicketEvent | Record<string, unknown>): TicketEventDTO {
  const e = doc as unknown as ITicketEvent & {
    actorId: PopulatedUserRef;
  };
  return {
    id: e._id.toString(),
    ticketId: e.ticketId.toString(),
    actor: {
      id: e.actorId._id.toString(),
      name: e.actorId.name,
      role: e.actorId.role ?? 'reporter',
    },
    eventType: e.eventType,
    fromStatus: e.fromStatus ?? null,
    toStatus: e.toStatus ?? null,
    details: (e.details as Record<string, unknown>) ?? {},
    createdAt: new Date(e.createdAt).toISOString(),
  };
}

export function serializeTicketDetail(
  doc: ITicket | Record<string, unknown>,
  attachments: IAttachment[],
  events: Array<ITicketEvent | Record<string, unknown>>
): TicketDetailDTO {
  return {
    ...serializeTicket(doc, attachments),
    events: events.map(serializeTicketEvent),
  };
}
