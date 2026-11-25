import { type Request, Router } from 'express';
import mongoose from 'mongoose';
import {
  assignTicketSchema,
  closeTicketSchema,
  createTicketSchema,
  reopenTicketSchema,
  startWorkSchema,
  submitRepairSchema,
  ticketQuerySchema,
  updatePrioritySchema,
} from '@campus/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  assertValidUploadedFile,
  imageUpload,
  ticketCreationUpload,
} from '../middleware/upload.js';
import { AttachmentModel } from '../models/Attachment.js';
import { TicketModel } from '../models/Ticket.js';
import { getActiveSupervisorIds, notifyUsers } from '../services/notificationService.js';
import {
  assignTicket,
  canUserAccessTicket,
  closeTicket,
  createTicketIdempotent,
  getDashboardSummary,
  getTicketDetailForUser,
  listTicketsForUser,
  reopenTicket,
  startTicketWork,
  submitTicketRepair,
  updateTicketPriority,
} from '../services/ticketService.js';
import { createSignedMediaToken, getStorageAdapter } from '../storage/index.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export const ticketRouter = Router();

ticketRouter.get(
  '/summary',
  requireAuth,
  requireRole('supervisor'),
  asyncHandler(async (_req, res) => {
    const summary = await getDashboardSummary();
    res.json(summary);
  })
);

ticketRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = ticketQuerySchema.parse(req.query);
    const result = await listTicketsForUser(req.user!, query);
    res.json(result);
  })
);

ticketRouter.post(
  '/',
  requireAuth,
  requireRole('reporter'),
  ticketCreationUpload.fields([
    { name: 'beforePhoto', maxCount: 1 },
    { name: 'voiceNote', maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const beforePhoto = files.beforePhoto?.[0];
    const voiceNote = files.voiceNote?.[0];

    if (beforePhoto) {
      assertValidUploadedFile(beforePhoto, 'image');
    }
    if (voiceNote) {
      assertValidUploadedFile(voiceNote, 'audio');
    }

    let parsedAiDraft: unknown = null;
    if (typeof req.body.aiDraft === 'string' && req.body.aiDraft.trim().length > 0) {
      try {
        parsedAiDraft = JSON.parse(req.body.aiDraft);
      } catch {
        throw new AppError(400, 'INVALID_AI_DRAFT', 'aiDraft must be valid JSON.');
      }
    } else if (req.body.aiDraft && typeof req.body.aiDraft === 'object') {
      parsedAiDraft = req.body.aiDraft;
    }

    const body = createTicketSchema.parse({
      clientSubmissionId: req.body.clientSubmissionId,
      buildingId: req.body.buildingId,
      roomId: req.body.roomId,
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      aiDraft: parsedAiDraft,
    });

    const result = await createTicketIdempotent({
      user: req.user!,
      clientSubmissionId: body.clientSubmissionId,
      buildingId: body.buildingId,
      roomId: body.roomId,
      title: body.title,
      description: body.description,
      category: body.category,
      aiDraft: body.aiDraft ?? null,
      beforePhoto,
      voiceNote,
    });

    if (!result.idempotentReplay) {
      const supIds = await getActiveSupervisorIds();
      const t = result.ticket;
      await notifyUsers({
        userIds: supIds,
        excludeUserId: req.user!.id,
        ticketId: t.id,
        ticketNumber: t.ticketNumber,
        title: `New Issue ${t.ticketNumber}`,
        body: `${t.title} · ${t.building.name} Rm ${t.room.roomNumber}`,
        eventType: 'created',
      }).catch((error: unknown) => { console.error('Ticket notification failed:', error); });
    }

    res.status(result.idempotentReplay ? 200 : 201).json(result);
  })
);

function paramStr(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

ticketRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ticket = await getTicketDetailForUser(paramStr(req.params.id), req.user!);
    res.json({ ticket });
  })
);

ticketRouter.patch(
  '/:id/assign',
  requireAuth,
  requireRole('supervisor'),
  asyncHandler(async (req, res) => {
    const body = assignTicketSchema.parse(req.body);
    const ticket = await assignTicket({
      ticketId: paramStr(req.params.id),
      actor: req.user!,
      assigneeId: body.assigneeId,
      priority: body.priority,
      expectedVersion: body.expectedVersion,
    });

    await notifyUsers({
      userIds: [ticket.reporter.id, ...(ticket.assignee ? [ticket.assignee.id] : [])],
      excludeUserId: req.user!.id,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: `Assigned: ${ticket.ticketNumber}`,
      body: `${ticket.title} · ${ticket.building.name} Rm ${ticket.room.roomNumber}`,
      eventType: 'assigned',
    }).catch((error: unknown) => { console.error('Ticket notification failed:', error); });

    res.json({ ticket });
  })
);

ticketRouter.patch(
  '/:id/priority',
  requireAuth,
  requireRole('supervisor'),
  asyncHandler(async (req, res) => {
    const body = updatePrioritySchema.parse(req.body);
    const ticket = await updateTicketPriority({
      ticketId: paramStr(req.params.id),
      actor: req.user!,
      priority: body.priority,
      expectedVersion: body.expectedVersion,
    });
    res.json({ ticket });
  })
);

ticketRouter.post(
  '/:id/start-work',
  requireAuth,
  requireRole('technician'),
  asyncHandler(async (req, res) => {
    const body = startWorkSchema.parse(req.body);
    const ticket = await startTicketWork({
      ticketId: paramStr(req.params.id),
      actor: req.user!,
      expectedVersion: body.expectedVersion,
    });

    const supIds = await getActiveSupervisorIds();
    await notifyUsers({
      userIds: [ticket.reporter.id, ...supIds],
      excludeUserId: req.user!.id,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: `Work Started: ${ticket.ticketNumber}`,
      body: `${req.user!.name} started repair on "${ticket.title}"`,
      eventType: 'work_started',
    }).catch((error: unknown) => { console.error('Ticket notification failed:', error); });

    res.json({ ticket });
  })
);

ticketRouter.post(
  '/:id/submit-repair',
  requireAuth,
  requireRole('technician'),
  imageUpload.single('afterPhoto'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'PHOTO_REQUIRED', 'An after-repair photo is required.');
    }
    assertValidUploadedFile(req.file, 'image');

    const body = submitRepairSchema.parse({
      completionNote: req.body.completionNote,
      expectedVersion: Number(req.body.expectedVersion),
    });

    const ticket = await submitTicketRepair({
      ticketId: paramStr(req.params.id),
      actor: req.user!,
      completionNote: body.completionNote,
      expectedVersion: body.expectedVersion,
      afterPhoto: req.file,
    });

    const supIds = await getActiveSupervisorIds();
    await notifyUsers({
      userIds: [ticket.reporter.id, ...supIds],
      excludeUserId: req.user!.id,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: `Repair Ready: ${ticket.ticketNumber}`,
      body: `${req.user!.name} submitted repair proof for verification`,
      eventType: 'repair_submitted',
    }).catch((error: unknown) => { console.error('Ticket notification failed:', error); });

    res.json({ ticket });
  })
);

ticketRouter.post(
  '/:id/close',
  requireAuth,
  requireRole('supervisor'),
  asyncHandler(async (req, res) => {
    const body = closeTicketSchema.parse(req.body);
    const ticket = await closeTicket({
      ticketId: paramStr(req.params.id),
      actor: req.user!,
      verificationNote: body.verificationNote,
      expectedVersion: body.expectedVersion,
    });

    await notifyUsers({
      userIds: [ticket.reporter.id, ...(ticket.assignee ? [ticket.assignee.id] : [])],
      excludeUserId: req.user!.id,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: `Closed: ${ticket.ticketNumber}`,
      body: `"${ticket.title}" has been verified and closed`,
      eventType: 'closed',
    }).catch((error: unknown) => { console.error('Ticket notification failed:', error); });

    res.json({ ticket });
  })
);

ticketRouter.post(
  '/:id/reopen',
  requireAuth,
  requireRole('supervisor'),
  asyncHandler(async (req, res) => {
    const body = reopenTicketSchema.parse(req.body);
    const ticket = await reopenTicket({
      ticketId: paramStr(req.params.id),
      actor: req.user!,
      reason: body.reason,
      expectedVersion: body.expectedVersion,
    });

    await notifyUsers({
      userIds: [ticket.reporter.id, ...(ticket.assignee ? [ticket.assignee.id] : [])],
      excludeUserId: req.user!.id,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: `Reopened: ${ticket.ticketNumber}`,
      body: `Reason: ${body.reason}`,
      eventType: 'reopened',
    }).catch((error: unknown) => { console.error('Ticket notification failed:', error); });

    res.json({ ticket });
  })
);

async function loadAuthorizedAttachment(req: Request) {
  const ticketId = paramStr(req.params.ticketId);
  const attachmentId = paramStr(req.params.attachmentId);

  if (
    !mongoose.Types.ObjectId.isValid(ticketId) ||
    !mongoose.Types.ObjectId.isValid(attachmentId)
  ) {
    throw new AppError(400, 'INVALID_ID', 'Invalid ticket or attachment ID.');
  }

  const [ticket, attachment] = await Promise.all([
    TicketModel.findById(ticketId).lean(),
    AttachmentModel.findOne({ _id: attachmentId, ticketId }).lean(),
  ]);

  if (!ticket) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket was not found.');
  }
  if (!canUserAccessTicket(req.user!, ticket)) {
    throw new AppError(403, 'FORBIDDEN', 'You are not authorized to access this attachment.');
  }
  if (!attachment) {
    throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment does not belong to this ticket.');
  }

  return attachment;
}

ticketRouter.get(
  '/:ticketId/attachments/:attachmentId/content',
  requireAuth,
  asyncHandler(async (req, res) => {
    const attachment = await loadAuthorizedAttachment(req);
    const storage = getStorageAdapter();
    const stream = await storage.getObjectStream(attachment.storageKey);

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${attachment.originalName.replace(/"/g, '')}"`
    );

    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(404).json({
          error: { code: 'MEDIA_NOT_FOUND', message: 'Attachment file not found.' },
        });
      } else {
        res.destroy(err);
      }
    });

    stream.pipe(res);
  })
);

ticketRouter.get(
  '/:ticketId/attachments/:attachmentId/signed-url',
  requireAuth,
  asyncHandler(async (req, res) => {
    const attachment = await loadAuthorizedAttachment(req);
    const storage = getStorageAdapter();
    const expiresInSeconds = 300;

    if (storage.getSignedReadUrl) {
      const url = await storage.getSignedReadUrl(attachment.storageKey, expiresInSeconds);
      res.json({ url, expiresInSeconds });
      return;
    }

    const token = createSignedMediaToken(
      {
        attachmentId: attachment._id.toString(),
        ticketId: attachment.ticketId.toString(),
        storageKey: attachment.storageKey,
        mimeType: attachment.mimeType,
      },
      expiresInSeconds
    );
    res.json({
      url: `/api/media/signed?token=${encodeURIComponent(token)}`,
      expiresInSeconds,
    });
  })
);
