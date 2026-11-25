import crypto from 'node:crypto';
import mongoose, { type FilterQuery } from 'mongoose';
import {
  TICKET_STATUSES,
  type AttachmentKind,
  type DashboardSummaryDTO,
  type PaginatedTicketsResponse,
  type TicketDTO,
  type TicketDetailDTO,
  type TicketPriority,
  type TicketStatus,
  type UserSummaryDTO,
  canTransitionStatus,
} from '@campus/shared';
import { AttachmentModel, type IAttachment } from '../models/Attachment.js';
import { BuildingModel } from '../models/Building.js';
import { getNextTicketNumber } from '../models/Counter.js';
import { RoomModel } from '../models/Room.js';
import { TicketModel, type ITicket } from '../models/Ticket.js';
import { TicketEventModel } from '../models/TicketEvent.js';
import { UserModel } from '../models/User.js';
import { getStorageAdapter } from '../storage/index.js';
import { AppError } from '../utils/errors.js';
import { serializeTicket, serializeTicketDetail } from './serializers.js';

function assertObjectId(id: string, label: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'INVALID_ID', `Invalid ${label} ID.`);
  }
  return new mongoose.Types.ObjectId(id);
}

export function canUserAccessTicket(
  user: UserSummaryDTO,
  ticket: { reporterId: unknown; assigneeId: unknown }
): boolean {
  if (user.role === 'supervisor') return true;
  const reporterStr =
    typeof ticket.reporterId === 'object' && ticket.reporterId !== null && '_id' in ticket.reporterId
      ? (ticket.reporterId as { _id: { toString(): string } })._id.toString()
      : String(ticket.reporterId);
  const assigneeStr =
    ticket.assigneeId === null || ticket.assigneeId === undefined
      ? null
      : typeof ticket.assigneeId === 'object' && '_id' in ticket.assigneeId
        ? (ticket.assigneeId as { _id: { toString(): string } })._id.toString()
        : String(ticket.assigneeId);

  if (user.role === 'reporter') return reporterStr === user.id;
  if (user.role === 'technician') return assigneeStr === user.id;
  return false;
}

async function loadPopulatedTicket(ticketId: mongoose.Types.ObjectId) {
  return TicketModel.findById(ticketId)
    .populate('reporterId', 'name email role')
    .populate('buildingId', 'name code')
    .populate('roomId', 'name roomNumber floor')
    .populate('assigneeId', 'name email role')
    .lean();
}

async function loadAttachmentsMap(
  ticketIds: mongoose.Types.ObjectId[]
): Promise<Map<string, IAttachment[]>> {
  const map = new Map<string, IAttachment[]>();
  if (ticketIds.length === 0) return map;
  const docs = await AttachmentModel.find({ ticketId: { $in: ticketIds } })
    .sort({ createdAt: 1 })
    .lean();
  for (const doc of docs) {
    const key = doc.ticketId.toString();
    const list = map.get(key) ?? [];
    list.push(doc as unknown as IAttachment);
    map.set(key, list);
  }
  return map;
}

async function saveAttachmentFile(params: {
  ticketId: mongoose.Types.ObjectId;
  uploadedBy: string;
  kind: AttachmentKind;
  file: Express.Multer.File;
}): Promise<IAttachment> {
  const ext = params.file.originalname.includes('.')
    ? params.file.originalname.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') ?? 'bin'
    : 'bin';
  const storageKey = `tickets/${params.ticketId.toString()}/${params.kind}-${crypto.randomUUID()}.${ext}`;
  const storage = getStorageAdapter();
  await storage.putObject(storageKey, params.file.buffer, params.file.mimetype);

  const created = await AttachmentModel.create({
    ticketId: params.ticketId,
    uploadedBy: new mongoose.Types.ObjectId(params.uploadedBy),
    kind: params.kind,
    storageKey,
    originalName: params.file.originalname,
    mimeType: params.file.mimetype.split(';')[0]?.trim() ?? params.file.mimetype,
    sizeBytes: params.file.size,
  });
  return created;
}

async function recordTicketEvent(params: {
  ticketId: mongoose.Types.ObjectId;
  actorId: string;
  eventType:
    | 'created'
    | 'assigned'
    | 'reassigned'
    | 'priority_changed'
    | 'work_started'
    | 'repair_submitted'
    | 'closed'
    | 'reopened';
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  details?: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<void> {
  try {
    await TicketEventModel.create({
      ticketId: params.ticketId,
      actorId: new mongoose.Types.ObjectId(params.actorId),
      eventType: params.eventType,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      details: params.details ?? {},
      ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
    });
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: number }).code === 11000 &&
      params.idempotencyKey
    ) {
      return;
    }
    throw err;
  }
}

export async function createTicketIdempotent(params: {
  user: UserSummaryDTO;
  clientSubmissionId: string;
  buildingId: string;
  roomId: string;
  title: string;
  description: string;
  category: ITicket['category'];
  aiDraft: {
    title: string;
    description: string;
    suggestedCategory: ITicket['category'];
    transcript: string;
    model: string;
    generatedAt: string;
    isMock: boolean;
  } | null;
  beforePhoto?: Express.Multer.File;
  voiceNote?: Express.Multer.File;
}): Promise<{ ticket: TicketDetailDTO; idempotentReplay: boolean }> {
  const existing = await TicketModel.findOne({
    clientSubmissionId: params.clientSubmissionId,
  });

  if (existing) {
    if (existing.reporterId.toString() !== params.user.id) {
      throw new AppError(
        409,
        'SUBMISSION_ID_CONFLICT',
        'This submission identifier already belongs to another user.'
      );
    }

    const existingAttachments = await AttachmentModel.find({ ticketId: existing._id });
    const hasBeforePhoto = existingAttachments.some((a) => a.kind === 'before_photo');
    const hasVoiceNote = existingAttachments.some((a) => a.kind === 'voice_note');

    if (params.beforePhoto && !hasBeforePhoto) {
      await saveAttachmentFile({
        ticketId: existing._id,
        uploadedBy: params.user.id,
        kind: 'before_photo',
        file: params.beforePhoto,
      });
    }
    if (params.voiceNote && !hasVoiceNote) {
      await saveAttachmentFile({
        ticketId: existing._id,
        uploadedBy: params.user.id,
        kind: 'voice_note',
        file: params.voiceNote,
      });
    }

    const detail = await getTicketDetailForUser(existing._id.toString(), params.user);
    return { ticket: detail, idempotentReplay: true };
  }

  const buildingObjectId = assertObjectId(params.buildingId, 'building');
  const roomObjectId = assertObjectId(params.roomId, 'room');

  const [building, room] = await Promise.all([
    BuildingModel.findById(buildingObjectId).lean(),
    RoomModel.findById(roomObjectId).lean(),
  ]);

  if (!building) {
    throw new AppError(404, 'BUILDING_NOT_FOUND', 'Selected building was not found.');
  }
  if (!room || room.buildingId.toString() !== building._id.toString()) {
    throw new AppError(
      400,
      'INVALID_ROOM',
      'Selected room does not exist in the selected building.'
    );
  }

  const ticketNumber = await getNextTicketNumber();

  let createdTicket: ITicket;
  try {
    createdTicket = await TicketModel.create({
      ticketNumber,
      clientSubmissionId: params.clientSubmissionId,
      reporterId: new mongoose.Types.ObjectId(params.user.id),
      buildingId: buildingObjectId,
      roomId: roomObjectId,
      title: params.title,
      description: params.description,
      category: params.category,
      priority: 'Medium',
      status: 'New',
      assigneeId: null,
      aiDraft: params.aiDraft
        ? {
            ...params.aiDraft,
            generatedAt: new Date(params.aiDraft.generatedAt),
          }
        : null,
      version: 1,
    });
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: number }).code === 11000
    ) {
      const raced = await TicketModel.findOne({
        clientSubmissionId: params.clientSubmissionId,
      });
      if (raced && raced.reporterId.toString() === params.user.id) {
        const detail = await getTicketDetailForUser(raced._id.toString(), params.user);
        return { ticket: detail, idempotentReplay: true };
      }
    }
    throw err;
  }

  if (params.beforePhoto) {
    await saveAttachmentFile({
      ticketId: createdTicket._id,
      uploadedBy: params.user.id,
      kind: 'before_photo',
      file: params.beforePhoto,
    });
  }
  if (params.voiceNote) {
    await saveAttachmentFile({
      ticketId: createdTicket._id,
      uploadedBy: params.user.id,
      kind: 'voice_note',
      file: params.voiceNote,
    });
  }

  await recordTicketEvent({
    ticketId: createdTicket._id,
    actorId: params.user.id,
    eventType: 'created',
    fromStatus: null,
    toStatus: 'New',
    details: {
      category: params.category,
      usedAiDraft: Boolean(params.aiDraft),
    },
    idempotencyKey: `created:${params.clientSubmissionId}`,
  });

  const detail = await getTicketDetailForUser(createdTicket._id.toString(), params.user);
  return { ticket: detail, idempotentReplay: false };
}

export async function listTicketsForUser(
  user: UserSummaryDTO,
  query: {
    search?: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: string;
    buildingId?: string;
    assigneeId?: string;
    page: number;
    limit: number;
  }
): Promise<PaginatedTicketsResponse> {
  const filter: FilterQuery<ITicket> = {};

  if (user.role === 'reporter') {
    filter.reporterId = new mongoose.Types.ObjectId(user.id);
  } else if (user.role === 'technician') {
    filter.assigneeId = new mongoose.Types.ObjectId(user.id);
  }

  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.category) filter.category = query.category;
  if (query.buildingId) {
    filter.buildingId = assertObjectId(query.buildingId, 'building');
  }
  if (query.assigneeId && user.role === 'supervisor') {
    filter.assigneeId = assertObjectId(query.assigneeId, 'assignee');
  }

  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [{ title: regex }, { description: regex }, { ticketNumber: regex }];
  }

  const skip = (query.page - 1) * query.limit;
  const [total, docs] = await Promise.all([
    TicketModel.countDocuments(filter),
    TicketModel.find(filter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate('reporterId', 'name email role')
      .populate('buildingId', 'name code')
      .populate('roomId', 'name roomNumber floor')
      .populate('assigneeId', 'name email role')
      .lean(),
  ]);

  const ids = docs.map((d) => d._id as mongoose.Types.ObjectId);
  const attachmentsMap = await loadAttachmentsMap(ids);
  const items: TicketDTO[] = docs.map((d) =>
    serializeTicket(d, attachmentsMap.get(d._id.toString()) ?? [])
  );

  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getTicketDetailForUser(
  ticketId: string,
  user: UserSummaryDTO
): Promise<TicketDetailDTO> {
  const id = assertObjectId(ticketId, 'ticket');
  const ticketDoc = await loadPopulatedTicket(id);
  if (!ticketDoc) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket was not found.');
  }

  if (!canUserAccessTicket(user, ticketDoc)) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this ticket.');
  }

  const [attachments, events] = await Promise.all([
    AttachmentModel.find({ ticketId: id }).sort({ createdAt: 1 }).lean(),
    TicketEventModel.find({ ticketId: id })
      .sort({ createdAt: 1 })
      .populate('actorId', 'name role')
      .lean(),
  ]);

  return serializeTicketDetail(
    ticketDoc,
    attachments as unknown as IAttachment[],
    events
  );
}

export async function getDashboardSummary(): Promise<DashboardSummaryDTO> {
  const [grouped, recentDocs] = await Promise.all([
    TicketModel.aggregate<{ _id: TicketStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    TicketModel.find({})
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate('reporterId', 'name email role')
      .populate('buildingId', 'name code')
      .populate('roomId', 'name roomNumber floor')
      .populate('assigneeId', 'name email role')
      .lean(),
  ]);

  const counts = Object.fromEntries(
    TICKET_STATUSES.map((s) => [s, 0])
  ) as Record<TicketStatus, number>;

  let total = 0;
  for (const row of grouped) {
    if (row._id in counts) {
      counts[row._id] = row.count;
      total += row.count;
    }
  }

  const attachmentsMap = await loadAttachmentsMap(
    recentDocs.map((d) => d._id as mongoose.Types.ObjectId)
  );

  return {
    counts,
    total,
    recentTickets: recentDocs.map((d) =>
      serializeTicket(d, attachmentsMap.get(d._id.toString()) ?? [])
    ),
  };
}

function throwVersionOrTransitionError(
  current: ITicket | null,
  expectedStatus: TicketStatus | TicketStatus[],
  targetStatus?: TicketStatus
): never {
  if (!current) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket was not found.');
  }
  const allowed = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (!allowed.includes(current.status)) {
    throw new AppError(
      409,
      'INVALID_TRANSITION',
      targetStatus
        ? `Cannot transition ticket from '${current.status}' to '${targetStatus}'.`
        : `Action is not allowed while ticket is in '${current.status}' status.`
    );
  }
  throw new AppError(
    409,
    'CONCURRENT_UPDATE',
    'This ticket was updated by another user. Refresh and try again.'
  );
}

export async function assignTicket(params: {
  ticketId: string;
  actor: UserSummaryDTO;
  assigneeId: string;
  priority?: TicketPriority;
  expectedVersion: number;
}): Promise<TicketDetailDTO> {
  const id = assertObjectId(params.ticketId, 'ticket');
  const assigneeObjectId = assertObjectId(params.assigneeId, 'technician');

  const technician = await UserModel.findById(assigneeObjectId).lean();
  if (!technician || !technician.active || technician.role !== 'technician') {
    throw new AppError(
      400,
      'INVALID_TECHNICIAN',
      'Selected assignee must be an active technician.'
    );
  }

  const current = await TicketModel.findById(id);
  if (!current) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket was not found.');
  }

  if (!canTransitionStatus(current.status, 'Assigned')) {
    throw new AppError(
      409,
      'INVALID_TRANSITION',
      `Cannot assign ticket while status is '${current.status}'.`
    );
  }

  const previousAssigneeId = current.assigneeId?.toString() ?? null;
  const previousPriority = current.priority;
  const previousStatus = current.status;

  const updateFields: Record<string, unknown> = {
    assigneeId: assigneeObjectId,
    status: 'Assigned',
  };
  if (params.priority) {
    updateFields.priority = params.priority;
  }

  const updated = await TicketModel.findOneAndUpdate(
    {
      _id: id,
      version: params.expectedVersion,
      status: { $in: ['New', 'Assigned', 'Reopened'] },
    },
    {
      $set: updateFields,
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!updated) {
    throwVersionOrTransitionError(
      await TicketModel.findById(id),
      ['New', 'Assigned', 'Reopened'],
      'Assigned'
    );
  }

  const isReassign = Boolean(previousAssigneeId);
  await recordTicketEvent({
    ticketId: id,
    actorId: params.actor.id,
    eventType: isReassign ? 'reassigned' : 'assigned',
    fromStatus: previousStatus,
    toStatus: 'Assigned',
    details: {
      assigneeId: technician._id.toString(),
      assigneeName: technician.name,
      previousAssigneeId,
    },
  });

  if (params.priority && params.priority !== previousPriority) {
    await recordTicketEvent({
      ticketId: id,
      actorId: params.actor.id,
      eventType: 'priority_changed',
      fromStatus: 'Assigned',
      toStatus: 'Assigned',
      details: {
        fromPriority: previousPriority,
        toPriority: params.priority,
      },
    });
  }

  return getTicketDetailForUser(id.toString(), params.actor);
}

export async function updateTicketPriority(params: {
  ticketId: string;
  actor: UserSummaryDTO;
  priority: TicketPriority;
  expectedVersion: number;
}): Promise<TicketDetailDTO> {
  const id = assertObjectId(params.ticketId, 'ticket');
  const current = await TicketModel.findById(id);
  if (!current) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket was not found.');
  }

  const previousPriority = current.priority;
  const updated = await TicketModel.findOneAndUpdate(
    { _id: id, version: params.expectedVersion },
    { $set: { priority: params.priority }, $inc: { version: 1 } },
    { new: true }
  );

  if (!updated) {
    throw new AppError(
      409,
      'CONCURRENT_UPDATE',
      'This ticket was updated by another user. Refresh and try again.'
    );
  }

  if (previousPriority !== params.priority) {
    await recordTicketEvent({
      ticketId: id,
      actorId: params.actor.id,
      eventType: 'priority_changed',
      fromStatus: updated.status,
      toStatus: updated.status,
      details: {
        fromPriority: previousPriority,
        toPriority: params.priority,
      },
    });
  }

  return getTicketDetailForUser(id.toString(), params.actor);
}

export async function startTicketWork(params: {
  ticketId: string;
  actor: UserSummaryDTO;
  expectedVersion: number;
}): Promise<TicketDetailDTO> {
  const id = assertObjectId(params.ticketId, 'ticket');
  const current = await TicketModel.findById(id);
  if (!current) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket was not found.');
  }

  if (current.assigneeId?.toString() !== params.actor.id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only the technician assigned to this ticket can start work.'
    );
  }

  if (!canTransitionStatus(current.status, 'In Progress')) {
    throw new AppError(
      409,
      'INVALID_TRANSITION',
      `Cannot start work while ticket status is '${current.status}'.`
    );
  }

  const updated = await TicketModel.findOneAndUpdate(
    {
      _id: id,
      assigneeId: new mongoose.Types.ObjectId(params.actor.id),
      version: params.expectedVersion,
      status: 'Assigned',
    },
    {
      $set: { status: 'In Progress' },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!updated) {
    throwVersionOrTransitionError(
      await TicketModel.findById(id),
      'Assigned',
      'In Progress'
    );
  }

  await recordTicketEvent({
    ticketId: id,
    actorId: params.actor.id,
    eventType: 'work_started',
    fromStatus: 'Assigned',
    toStatus: 'In Progress',
  });

  return getTicketDetailForUser(id.toString(), params.actor);
}

export async function submitTicketRepair(params: {
  ticketId: string;
  actor: UserSummaryDTO;
  completionNote: string;
  expectedVersion: number;
  afterPhoto: Express.Multer.File;
}): Promise<TicketDetailDTO> {
  const id = assertObjectId(params.ticketId, 'ticket');
  const current = await TicketModel.findById(id);
  if (!current) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket was not found.');
  }

  if (current.assigneeId?.toString() !== params.actor.id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only the technician assigned to this ticket can submit repair evidence.'
    );
  }

  if (!canTransitionStatus(current.status, 'Awaiting Verification')) {
    throw new AppError(
      409,
      'INVALID_TRANSITION',
      `Cannot submit repair while ticket status is '${current.status}'.`
    );
  }

  const updated = await TicketModel.findOneAndUpdate(
    {
      _id: id,
      assigneeId: new mongoose.Types.ObjectId(params.actor.id),
      version: params.expectedVersion,
      status: 'In Progress',
    },
    {
      $set: {
        status: 'Awaiting Verification',
        completionNote: params.completionNote,
      },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!updated) {
    throwVersionOrTransitionError(
      await TicketModel.findById(id),
      'In Progress',
      'Awaiting Verification'
    );
  }

  await saveAttachmentFile({
    ticketId: id,
    uploadedBy: params.actor.id,
    kind: 'after_photo',
    file: params.afterPhoto,
  });

  await recordTicketEvent({
    ticketId: id,
    actorId: params.actor.id,
    eventType: 'repair_submitted',
    fromStatus: 'In Progress',
    toStatus: 'Awaiting Verification',
    details: { completionNote: params.completionNote },
  });

  return getTicketDetailForUser(id.toString(), params.actor);
}

export async function closeTicket(params: {
  ticketId: string;
  actor: UserSummaryDTO;
  verificationNote?: string;
  expectedVersion: number;
}): Promise<TicketDetailDTO> {
  const id = assertObjectId(params.ticketId, 'ticket');
  const current = await TicketModel.findById(id);
  if (!current) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket was not found.');
  }

  if (!canTransitionStatus(current.status, 'Closed')) {
    throw new AppError(
      409,
      'INVALID_TRANSITION',
      `Cannot close ticket while status is '${current.status}'.`
    );
  }

  const updated = await TicketModel.findOneAndUpdate(
    {
      _id: id,
      version: params.expectedVersion,
      status: 'Awaiting Verification',
    },
    {
      $set: { status: 'Closed' },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!updated) {
    throwVersionOrTransitionError(
      await TicketModel.findById(id),
      'Awaiting Verification',
      'Closed'
    );
  }

  await recordTicketEvent({
    ticketId: id,
    actorId: params.actor.id,
    eventType: 'closed',
    fromStatus: 'Awaiting Verification',
    toStatus: 'Closed',
    details: params.verificationNote ? { verificationNote: params.verificationNote } : {},
  });

  return getTicketDetailForUser(id.toString(), params.actor);
}

export async function reopenTicket(params: {
  ticketId: string;
  actor: UserSummaryDTO;
  reason: string;
  expectedVersion: number;
}): Promise<TicketDetailDTO> {
  const id = assertObjectId(params.ticketId, 'ticket');
  const current = await TicketModel.findById(id);
  if (!current) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket was not found.');
  }

  if (!canTransitionStatus(current.status, 'Reopened')) {
    throw new AppError(
      409,
      'INVALID_TRANSITION',
      `Cannot reopen ticket while status is '${current.status}'.`
    );
  }

  const fromStatus = current.status;
  const updated = await TicketModel.findOneAndUpdate(
    {
      _id: id,
      version: params.expectedVersion,
      status: { $in: ['Awaiting Verification', 'Closed'] },
    },
    {
      $set: {
        status: 'Reopened',
        reopenReason: params.reason,
      },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!updated) {
    throwVersionOrTransitionError(
      await TicketModel.findById(id),
      ['Awaiting Verification', 'Closed'],
      'Reopened'
    );
  }

  await recordTicketEvent({
    ticketId: id,
    actorId: params.actor.id,
    eventType: 'reopened',
    fromStatus,
    toStatus: 'Reopened',
    details: { reason: params.reason },
  });

  return getTicketDetailForUser(id.toString(), params.actor);
}
