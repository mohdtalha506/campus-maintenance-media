import bcrypt from 'bcryptjs';
import { AttachmentModel } from '../models/Attachment.js';
import { BuildingModel } from '../models/Building.js';
import { CounterModel, getNextTicketNumber } from '../models/Counter.js';
import { RoomModel } from '../models/Room.js';
import { TicketModel } from '../models/Ticket.js';
import { TicketEventModel } from '../models/TicketEvent.js';
import { UserModel } from '../models/User.js';
import { getStorageAdapter } from '../storage/index.js';
import { createSamplePng, createSampleWav } from './sampleMedia.js';

export const DEMO_CREDENTIALS = {
  reporter: { email: 'reporter@campus.edu', password: 'Password123!' },
  supervisor: { email: 'supervisor@campus.edu', password: 'Password123!' },
  technician1: { email: 'tech1@campus.edu', password: 'Password123!' },
  technician2: { email: 'tech2@campus.edu', password: 'Password123!' },
} as const;

export async function seedDatabase(options: { reset?: boolean } = {}): Promise<void> {
  if (options.reset) {
    await Promise.all([
      UserModel.deleteMany({}),
      BuildingModel.deleteMany({}),
      RoomModel.deleteMany({}),
      TicketModel.deleteMany({}),
      AttachmentModel.deleteMany({}),
      TicketEventModel.deleteMany({}),
      CounterModel.deleteMany({}),
    ]);
  }

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const [reporter, supervisor, tech1, tech2] = await Promise.all([
    UserModel.findOneAndUpdate(
      { email: DEMO_CREDENTIALS.reporter.email },
      {
        $setOnInsert: {
          name: 'Asha Verma',
          email: DEMO_CREDENTIALS.reporter.email,
          passwordHash,
          role: 'reporter',
          active: true,
        },
      },
      { upsert: true, new: true }
    ),
    UserModel.findOneAndUpdate(
      { email: DEMO_CREDENTIALS.supervisor.email },
      {
        $setOnInsert: {
          name: 'Vikram Nair',
          email: DEMO_CREDENTIALS.supervisor.email,
          passwordHash,
          role: 'supervisor',
          active: true,
        },
      },
      { upsert: true, new: true }
    ),
    UserModel.findOneAndUpdate(
      { email: DEMO_CREDENTIALS.technician1.email },
      {
        $setOnInsert: {
          name: 'Rohan Das',
          email: DEMO_CREDENTIALS.technician1.email,
          passwordHash,
          role: 'technician',
          active: true,
        },
      },
      { upsert: true, new: true }
    ),
    UserModel.findOneAndUpdate(
      { email: DEMO_CREDENTIALS.technician2.email },
      {
        $setOnInsert: {
          name: 'Meera Kulkarni',
          email: DEMO_CREDENTIALS.technician2.email,
          passwordHash,
          role: 'technician',
          active: true,
        },
      },
      { upsert: true, new: true }
    ),
  ]);

  const [academicBlock, labsBlock, hostelBlock] = await Promise.all([
    BuildingModel.findOneAndUpdate(
      { code: 'AB' },
      {
        $setOnInsert: {
          name: 'Academic Block',
          code: 'AB',
          description: 'Main lecture halls, seminar rooms, and faculty offices',
          active: true,
        },
      },
      { upsert: true, new: true }
    ),
    BuildingModel.findOneAndUpdate(
      { code: 'LAB' },
      {
        $setOnInsert: {
          name: 'Labs',
          code: 'LAB',
          description: 'Engineering, physics, and computer laboratories',
          active: true,
        },
      },
      { upsert: true, new: true }
    ),
    BuildingModel.findOneAndUpdate(
      { code: 'HST' },
      {
        $setOnInsert: {
          name: 'Hostel',
          code: 'HST',
          description: 'Student residential hostel block',
          active: true,
        },
      },
      { upsert: true, new: true }
    ),
  ]);

  const roomsData = [
    { buildingId: academicBlock._id, name: 'Lecture Hall 101', roomNumber: '101', floor: '1st Floor' },
    { buildingId: academicBlock._id, name: 'Seminar Room 204', roomNumber: '204', floor: '2nd Floor' },
    { buildingId: academicBlock._id, name: 'Auditorium Annex 305', roomNumber: '305', floor: '3rd Floor' },
    { buildingId: labsBlock._id, name: 'Physics Lab 1', roomNumber: 'L-102', floor: '1st Floor' },
    { buildingId: labsBlock._id, name: 'Computer Lab B', roomNumber: 'L-205', floor: '2nd Floor' },
    { buildingId: hostelBlock._id, name: 'Hostel Room 112', roomNumber: 'H-112', floor: '1st Floor' },
    { buildingId: hostelBlock._id, name: 'Common Study Hall', roomNumber: 'H-001', floor: 'Ground' },
  ];

  const rooms = await Promise.all(
    roomsData.map((r) =>
      RoomModel.findOneAndUpdate(
        { buildingId: r.buildingId, roomNumber: r.roomNumber },
        { $setOnInsert: { ...r, active: true } },
        { upsert: true, new: true }
      )
    )
  );

  const existingTickets = await TicketModel.countDocuments({});
  if (existingTickets > 0) {
    return;
  }

  await CounterModel.findOneAndUpdate(
    { _id: 'ticketNumber' },
    { $setOnInsert: { seq: 1000 } },
    { upsert: true }
  );

  const storage = getStorageAdapter();
  const sampleWav = createSampleWav(1);

  const room101 = rooms[0]!;
  const room305 = rooms[2]!;
  const physicsLab = rooms[3]!;
  const compLab = rooms[4]!;
  const hostel112 = rooms[5]!;
  const hostelCommon = rooms[6]!;

  const sampleTickets = [
    {
      clientSubmissionId: 'seed-ticket-001',
      buildingId: labsBlock._id,
      roomId: compLab._id,
      title: 'Flickering LED ceiling panels in Computer Lab B',
      description: 'Two overhead LED panels near row 3 are flickering intermittently during lab sessions.',
      category: 'Electrical' as const,
      priority: 'High' as const,
      status: 'New' as const,
      assigneeId: null,
      aiDraft: {
        title: 'Flickering LED ceiling panels in Computer Lab B',
        description: 'Two overhead LED panels near row 3 are flickering intermittently.',
        suggestedCategory: 'Electrical' as const,
        transcript: 'Computer Lab B mein upar ki do LED lights baar baar blink kar rahi hain.',
        model: 'mock-ai-v1',
        generatedAt: new Date(Date.now() - 3600_000 * 6),
        isMock: true,
      },
      beforeColor: [180, 83, 9] as [number, number, number],
      afterColor: null,
      completionNote: null,
      reopenReason: null,
    },
    {
      clientSubmissionId: 'seed-ticket-002',
      buildingId: hostelBlock._id,
      roomId: hostel112._id,
      title: 'Washbasin tap leaking continuously in Hostel Room 112',
      description: 'The cold water tap in the washroom does not shut off completely and drips continuously.',
      category: 'Plumbing' as const,
      priority: 'Medium' as const,
      status: 'Assigned' as const,
      assigneeId: tech1._id,
      aiDraft: null,
      beforeColor: [3, 105, 161] as [number, number, number],
      afterColor: null,
      completionNote: null,
      reopenReason: null,
    },
    {
      clientSubmissionId: 'seed-ticket-003',
      buildingId: academicBlock._id,
      roomId: room101._id,
      title: 'Broken hinges on Lecture Hall 101 podium cabinet',
      description: 'The AV podium cabinet door hinge has come loose and needs re-fastening.',
      category: 'Furniture' as const,
      priority: 'Low' as const,
      status: 'In Progress' as const,
      assigneeId: tech2._id,
      aiDraft: null,
      beforeColor: [120, 53, 15] as [number, number, number],
      afterColor: null,
      completionNote: null,
      reopenReason: null,
    },
    {
      clientSubmissionId: 'seed-ticket-004',
      buildingId: labsBlock._id,
      roomId: physicsLab._id,
      title: 'Split AC drain pipe condensation leak in Physics Lab 1',
      description: 'Condensation water is dripping from the indoor AC outlet near the west workbench.',
      category: 'HVAC' as const,
      priority: 'Urgent' as const,
      status: 'Awaiting Verification' as const,
      assigneeId: tech1._id,
      aiDraft: {
        title: 'Split AC drain pipe condensation leak in Physics Lab 1',
        description: 'Water is dripping from the indoor AC outlet near the west workbench.',
        suggestedCategory: 'HVAC' as const,
        transcript: 'Physics Lab 1 ke west side AC se paani tapak raha hai.',
        model: 'mock-ai-v1',
        generatedAt: new Date(Date.now() - 3600_000 * 14),
        isMock: true,
      },
      beforeColor: [185, 28, 28] as [number, number, number],
      afterColor: [21, 128, 61] as [number, number, number],
      completionNote: 'Cleared clogged condensate drain line and re-insulated elbow joint. Tested for 20 minutes with zero drips.',
      reopenReason: null,
    },
    {
      clientSubmissionId: 'seed-ticket-005',
      buildingId: hostelBlock._id,
      roomId: hostelCommon._id,
      title: 'Main glass door closer alignment issue in Common Study Hall',
      description: 'The hydraulic door closer slams shut quickly and needs tension adjustment.',
      category: 'Civil' as const,
      priority: 'Medium' as const,
      status: 'Closed' as const,
      assigneeId: tech2._id,
      aiDraft: null,
      beforeColor: [71, 85, 105] as [number, number, number],
      afterColor: [15, 118, 110] as [number, number, number],
      completionNote: 'Adjusted hydraulic closer valve speed and tightened top bracket bolts.',
      reopenReason: null,
    },
    {
      clientSubmissionId: 'seed-ticket-006',
      buildingId: academicBlock._id,
      roomId: room305._id,
      title: 'Wall power socket spark mark near projector rack in Room 305',
      description: 'One 16A wall outlet shows scorch marks and needs inspection and replacement.',
      category: 'Electrical' as const,
      priority: 'High' as const,
      status: 'Reopened' as const,
      assigneeId: tech1._id,
      aiDraft: null,
      beforeColor: [153, 27, 27] as [number, number, number],
      afterColor: [100, 116, 139] as [number, number, number],
      completionNote: 'Replaced faceplate and tightened terminal screws.',
      reopenReason: 'Supervisor check found socket still loose under load; replace full 16A module.',
    },
  ];

  for (const item of sampleTickets) {
    const ticketNumber = await getNextTicketNumber();
    const ticket = await TicketModel.create({
      ticketNumber,
      clientSubmissionId: item.clientSubmissionId,
      reporterId: reporter._id,
      buildingId: item.buildingId,
      roomId: item.roomId,
      title: item.title,
      description: item.description,
      category: item.category,
      priority: item.priority,
      status: item.status,
      assigneeId: item.assigneeId,
      aiDraft: item.aiDraft,
      completionNote: item.completionNote,
      reopenReason: item.reopenReason,
      version: item.status === 'New' ? 1 : 2,
    });

    const beforeKey = `tickets/${ticket._id.toString()}/before-seed.png`;
    const beforeBuf = createSamplePng(360, 240, item.beforeColor, [251, 191, 36]);
    await storage.putObject(beforeKey, beforeBuf, 'image/png');
    await AttachmentModel.create({
      ticketId: ticket._id,
      uploadedBy: reporter._id,
      kind: 'before_photo',
      storageKey: beforeKey,
      originalName: 'before-issue.png',
      mimeType: 'image/png',
      sizeBytes: beforeBuf.length,
    });

    const voiceKey = `tickets/${ticket._id.toString()}/voice-seed.wav`;
    await storage.putObject(voiceKey, sampleWav, 'audio/wav');
    await AttachmentModel.create({
      ticketId: ticket._id,
      uploadedBy: reporter._id,
      kind: 'voice_note',
      storageKey: voiceKey,
      originalName: 'voice-note.wav',
      mimeType: 'audio/wav',
      sizeBytes: sampleWav.length,
    });

    if (item.afterColor && item.assigneeId) {
      const afterKey = `tickets/${ticket._id.toString()}/after-seed.png`;
      const afterBuf = createSamplePng(360, 240, item.afterColor, [134, 239, 172]);
      await storage.putObject(afterKey, afterBuf, 'image/png');
      await AttachmentModel.create({
        ticketId: ticket._id,
        uploadedBy: item.assigneeId,
        kind: 'after_photo',
        storageKey: afterKey,
        originalName: 'after-repair.png',
        mimeType: 'image/png',
        sizeBytes: afterBuf.length,
      });
    }

    await TicketEventModel.create({
      ticketId: ticket._id,
      actorId: reporter._id,
      eventType: 'created',
      fromStatus: null,
      toStatus: 'New',
      details: { category: item.category, usedAiDraft: Boolean(item.aiDraft) },
      idempotencyKey: `created:${item.clientSubmissionId}`,
    });

    if (item.assigneeId) {
      await TicketEventModel.create({
        ticketId: ticket._id,
        actorId: supervisor._id,
        eventType: 'assigned',
        fromStatus: 'New',
        toStatus: 'Assigned',
        details: { assigneeId: item.assigneeId.toString() },
      });
    }

    if (
      item.status === 'In Progress' ||
      item.status === 'Awaiting Verification' ||
      item.status === 'Closed' ||
      item.status === 'Reopened'
    ) {
      await TicketEventModel.create({
        ticketId: ticket._id,
        actorId: item.assigneeId!,
        eventType: 'work_started',
        fromStatus: 'Assigned',
        toStatus: 'In Progress',
      });
    }

    if (
      item.status === 'Awaiting Verification' ||
      item.status === 'Closed' ||
      item.status === 'Reopened'
    ) {
      await TicketEventModel.create({
        ticketId: ticket._id,
        actorId: item.assigneeId!,
        eventType: 'repair_submitted',
        fromStatus: 'In Progress',
        toStatus: 'Awaiting Verification',
        details: { completionNote: item.completionNote },
      });
    }

    if (item.status === 'Closed') {
      await TicketEventModel.create({
        ticketId: ticket._id,
        actorId: supervisor._id,
        eventType: 'closed',
        fromStatus: 'Awaiting Verification',
        toStatus: 'Closed',
        details: { verificationNote: 'Verified repair photo and tested.' },
      });
    }

    if (item.status === 'Reopened') {
      await TicketEventModel.create({
        ticketId: ticket._id,
        actorId: supervisor._id,
        eventType: 'reopened',
        fromStatus: 'Awaiting Verification',
        toStatus: 'Reopened',
        details: { reason: item.reopenReason },
      });
    }
  }
}

export async function seedDatabaseIfEmpty(): Promise<void> {
  const userCount = await UserModel.countDocuments({});
  if (userCount === 0) {
    await seedDatabase({ reset: false });
  }
}
