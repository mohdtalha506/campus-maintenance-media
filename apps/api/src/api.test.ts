import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './db/connect.js';
import { createSamplePng, createSampleWav } from './db/sampleMedia.js';
import { DEMO_CREDENTIALS, seedDatabase } from './db/seedData.js';
import { BuildingModel } from './models/Building.js';
import { RoomModel } from './models/Room.js';
import { TicketEventModel } from './models/TicketEvent.js';
import { TicketModel } from './models/Ticket.js';
import { LocalStorageAdapter } from './storage/localAdapter.js';
import { setStorageAdapterForTests } from './storage/index.js';

let mongod: MongoMemoryServer;
let tempUploadDir: string;
const app = createApp();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDatabase(mongod.getUri());
  tempUploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cmc-api-test-'));
  setStorageAdapterForTests(new LocalStorageAdapter(tempUploadDir));
});

afterAll(async () => {
  vi.restoreAllMocks();
  setStorageAdapterForTests(null);
  await disconnectDatabase();
  await mongod.stop();
  await fs.rm(tempUploadDir, { recursive: true, force: true });
});

beforeEach(async () => {
  vi.restoreAllMocks();
  env.aiMode = 'mock';
  env.geminiApiKey = '';
  await seedDatabase({ reset: true });
});

async function loginAs(
  creds: { email: string; password: string },
  clientType: 'web' | 'mobile' = 'mobile'
) {
  const req = request(app).post('/api/auth/login');
  if (clientType === 'mobile') {
    req.set('X-Client-Type', 'mobile');
  }
  const res = await req.send(creds);
  expect(res.status).toBe(200);
  return {
    token: res.body.token as string | undefined,
    cookies: res.headers['set-cookie'],
    user: res.body.user as { id: string; role: string; name: string },
  };
}

describe('Campus Maintenance Copilot API', () => {
  it('enforces role permissions and attachment authorization', async () => {
    const reporter = await loginAs(DEMO_CREDENTIALS.reporter, 'mobile');
    const supervisor = await loginAs(DEMO_CREDENTIALS.supervisor, 'web');
    const tech1 = await loginAs(DEMO_CREDENTIALS.technician1, 'mobile');
    const tech2 = await loginAs(DEMO_CREDENTIALS.technician2, 'mobile');

    const academic = await BuildingModel.findOne({ code: 'AB' }).lean();
    const room204 = await RoomModel.findOne({ buildingId: academic!._id, roomNumber: '204' }).lean();
    const samplePng = createSamplePng();
    const sampleWav = createSampleWav();

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${reporter.token}`)
      .field('clientSubmissionId', 'perm-test-sub-0001')
      .field('buildingId', academic!._id.toString())
      .field('roomId', room204!._id.toString())
      .field('title', 'AC leakage in Room 204')
      .field('description', 'Water dripping from AC unit in Room 204.')
      .field('category', 'HVAC')
      .attach('beforePhoto', samplePng, { filename: 'before.png', contentType: 'image/png' })
      .attach('voiceNote', sampleWav, { filename: 'voice.wav', contentType: 'audio/wav' });

    expect(createRes.status).toBe(201);
    const ticket = createRes.body.ticket;
    const beforeAtt = ticket.attachments.find((a: { kind: string }) => a.kind === 'before_photo');
    expect(beforeAtt).toBeTruthy();

    // Reporter cannot assign or view dashboard summary
    const forbidAssign = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ assigneeId: tech1.user.id, expectedVersion: ticket.version });
    expect(forbidAssign.status).toBe(403);

    const forbidSummary = await request(app)
      .get('/api/tickets/summary')
      .set('Authorization', `Bearer ${reporter.token}`);
    expect(forbidSummary.status).toBe(403);

    // Unassigned technician (tech2) cannot view ticket or download its attachment
    const tech2Ticket = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${tech2.token}`);
    expect(tech2Ticket.status).toBe(403);

    const tech2Att = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${beforeAtt.id}/content`)
      .set('Authorization', `Bearer ${tech2.token}`);
    expect(tech2Att.status).toBe(403);

    // Cross-ticket attachment mismatch returns 404
    const otherTicket = await TicketModel.findOne({ clientSubmissionId: 'seed-ticket-001' }).lean();
    const mismatchRes = await request(app)
      .get(`/api/tickets/${otherTicket!._id.toString()}/attachments/${beforeAtt.id}/content`)
      .set('Cookie', supervisor.cookies!);
    expect(mismatchRes.status).toBe(404);

    // Supervisor can download attachment and get signed URL
    const supAtt = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${beforeAtt.id}/content`)
      .set('Cookie', supervisor.cookies!);
    expect(supAtt.status).toBe(200);
    expect(supAtt.headers['content-type']).toContain('image/png');

    const signedRes = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments/${beforeAtt.id}/signed-url`)
      .set('Cookie', supervisor.cookies!);
    expect(signedRes.status).toBe(200);
    const signedFetch = await request(app).get(signedRes.body.url);
    expect(signedFetch.status).toBe(200);
  });

  it('prevents duplicate tickets on idempotent retries and blocks invalid transitions / stale versions', async () => {
    const reporter = await loginAs(DEMO_CREDENTIALS.reporter, 'mobile');
    const supervisor = await loginAs(DEMO_CREDENTIALS.supervisor, 'web');
    const tech1 = await loginAs(DEMO_CREDENTIALS.technician1, 'mobile');
    const tech2 = await loginAs(DEMO_CREDENTIALS.technician2, 'mobile');

    const academic = await BuildingModel.findOne({ code: 'AB' }).lean();
    const room204 = await RoomModel.findOne({ buildingId: academic!._id, roomNumber: '204' }).lean();

    const first = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${reporter.token}`)
      .field('clientSubmissionId', 'retry-safe-id-9999')
      .field('buildingId', academic!._id.toString())
      .field('roomId', room204!._id.toString())
      .field('title', 'Room 204 AC leak')
      .field('description', 'AC dripping water near podium.')
      .field('category', 'HVAC');

    expect(first.status).toBe(201);
    expect(first.body.idempotentReplay).toBe(false);

    const retry = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${reporter.token}`)
      .field('clientSubmissionId', 'retry-safe-id-9999')
      .field('buildingId', academic!._id.toString())
      .field('roomId', room204!._id.toString())
      .field('title', 'Room 204 AC leak')
      .field('description', 'AC dripping water near podium.')
      .field('category', 'HVAC');

    expect(retry.status).toBe(200);
    expect(retry.body.idempotentReplay).toBe(true);
    expect(retry.body.ticket.id).toBe(first.body.ticket.id);

    const events = await TicketEventModel.find({ ticketId: first.body.ticket.id });
    expect(events).toHaveLength(1);

    // Invalid transition: cannot close New ticket
    const invalidClose = await request(app)
      .post(`/api/tickets/${first.body.ticket.id}/close`)
      .set('Cookie', supervisor.cookies!)
      .send({ expectedVersion: 1 });
    expect(invalidClose.status).toBe(409);

    // Assign to tech1
    const assigned = await request(app)
      .patch(`/api/tickets/${first.body.ticket.id}/assign`)
      .set('Cookie', supervisor.cookies!)
      .send({ assigneeId: tech1.user.id, priority: 'Urgent', expectedVersion: 1 });
    expect(assigned.status).toBe(200);
    expect(assigned.body.ticket.version).toBe(2);

    // Concurrent update with stale expectedVersion 1 fails with 409
    const staleUpdate = await request(app)
      .patch(`/api/tickets/${first.body.ticket.id}/priority`)
      .set('Cookie', supervisor.cookies!)
      .send({ priority: 'Low', expectedVersion: 1 });
    expect(staleUpdate.status).toBe(409);

    // Wrong technician cannot start work
    const wrongTech = await request(app)
      .post(`/api/tickets/${first.body.ticket.id}/start-work`)
      .set('Authorization', `Bearer ${tech2.token}`)
      .send({ expectedVersion: 2 });
    expect(wrongTech.status).toBe(403);
  });

  it('handles Gemini live failures cleanly without silent mock substitution, and parses valid Gemini structured output', async () => {
    const reporter = await loginAs(DEMO_CREDENTIALS.reporter, 'mobile');
    const academic = await BuildingModel.findOne({ code: 'AB' }).lean();
    const room204 = await RoomModel.findOne({ buildingId: academic!._id, roomNumber: '204' }).lean();
    const wav = createSampleWav();

    // Missing GEMINI_API_KEY in live mode -> 503 AI_UNAVAILABLE
    env.aiMode = 'live';
    env.geminiApiKey = '';
    const missingKeyRes = await request(app)
      .post('/api/ai/draft')
      .set('Authorization', `Bearer ${reporter.token}`)
      .field('buildingId', academic!._id.toString())
      .field('roomId', room204!._id.toString())
      .attach('audio', wav, { filename: 'note.wav', contentType: 'audio/wav' });
    expect(missingKeyRes.status).toBe(503);
    expect(missingKeyRes.body.error.code).toBe('AI_UNAVAILABLE');

    // Mocked Gemini API returning 429 quota exhausted
    env.geminiApiKey = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'quota' }), { status: 429 }))
    );
    const quotaRes = await request(app)
      .post('/api/ai/draft')
      .set('Authorization', `Bearer ${reporter.token}`)
      .field('buildingId', academic!._id.toString())
      .field('roomId', room204!._id.toString())
      .attach('audio', wav, { filename: 'note.wav', contentType: 'audio/wav' });
    expect(quotaRes.status).toBe(429);
    expect(quotaRes.body.error.code).toBe('AI_RATE_LIMITED');

    // Mocked Gemini API returning structured JSON
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        title: 'AC leaking water in Room 204',
                        description: 'Water is dripping from the AC unit inside Room 204.',
                        suggestedCategory: 'HVAC',
                        transcript: 'Room 204 mein AC se paani tapak raha hai.',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const liveRes = await request(app)
      .post('/api/ai/draft')
      .set('Authorization', `Bearer ${reporter.token}`)
      .field('buildingId', academic!._id.toString())
      .field('roomId', room204!._id.toString())
      .attach('audio', wav, { filename: 'note.wav', contentType: 'audio/wav' });
    expect(liveRes.status).toBe(200);
    expect(liveRes.body.draft.suggestedCategory).toBe('HVAC');
    expect(liveRes.body.draft.isMock).toBe(false);
    expect(liveRes.body.draft.transcript).toBe('Room 204 mein AC se paani tapak raha hai.');
  });

  it('completes the full end-to-end portfolio workflow from report to reopen and close', async () => {
    const reporter = await loginAs(DEMO_CREDENTIALS.reporter, 'mobile');
    const supervisor = await loginAs(DEMO_CREDENTIALS.supervisor, 'web');
    const tech1 = await loginAs(DEMO_CREDENTIALS.technician1, 'mobile');

    const locRes = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${reporter.token}`);
    expect(locRes.status).toBe(200);
    const academic = locRes.body.buildings.find((b: { name: string }) => b.name === 'Academic Block');
    const room204 = locRes.body.rooms.find(
      (r: { buildingId: string; roomNumber: string }) =>
        r.buildingId === academic.id && r.roomNumber === '204'
    );
    expect(academic).toBeTruthy();
    expect(room204).toBeTruthy();

    const wav = createSampleWav();
    const beforePng = createSamplePng(200, 150, [180, 30, 30]);
    const afterPng = createSamplePng(200, 150, [20, 130, 60]);

    // 1. Mock AI draft
    env.aiMode = 'mock';
    const aiRes = await request(app)
      .post('/api/ai/draft')
      .set('Authorization', `Bearer ${reporter.token}`)
      .field('buildingId', academic.id)
      .field('roomId', room204.id)
      .field('mockHintText', 'Room 204 mein AC se paani tapak raha hai.')
      .attach('audio', wav, { filename: 'note.wav', contentType: 'audio/wav' });
    expect(aiRes.status).toBe(200);
    expect(aiRes.body.draft.suggestedCategory).toBe('HVAC');
    expect(aiRes.body.draft.isMock).toBe(true);

    // 2. Reporter submits ticket after reviewing/editing
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${reporter.token}`)
      .field('clientSubmissionId', 'demo-flow-room-204')
      .field('buildingId', academic.id)
      .field('roomId', room204.id)
      .field('title', 'AC water leakage in Seminar Room 204')
      .field('description', aiRes.body.draft.description)
      .field('category', aiRes.body.draft.suggestedCategory)
      .field('aiDraft', JSON.stringify(aiRes.body.draft))
      .attach('beforePhoto', beforePng, { filename: 'before.png', contentType: 'image/png' })
      .attach('voiceNote', wav, { filename: 'voice.wav', contentType: 'audio/wav' });
    expect(createRes.status).toBe(201);
    let ticket = createRes.body.ticket;
    expect(ticket.status).toBe('New');

    // 3. Supervisor assigns technician & sets High priority
    const assignRes = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Cookie', supervisor.cookies!)
      .send({ assigneeId: tech1.user.id, priority: 'High', expectedVersion: ticket.version });
    expect(assignRes.status).toBe(200);
    ticket = assignRes.body.ticket;
    expect(ticket.status).toBe('Assigned');
    expect(ticket.priority).toBe('High');

    // 4. Technician starts work
    const startRes = await request(app)
      .post(`/api/tickets/${ticket.id}/start-work`)
      .set('Authorization', `Bearer ${tech1.token}`)
      .send({ expectedVersion: ticket.version });
    expect(startRes.status).toBe(200);
    ticket = startRes.body.ticket;
    expect(ticket.status).toBe('In Progress');

    // 5. Technician submits repair without photo -> 400
    const missingPhotoRes = await request(app)
      .post(`/api/tickets/${ticket.id}/submit-repair`)
      .set('Authorization', `Bearer ${tech1.token}`)
      .field('completionNote', 'Cleaned drain pipe')
      .field('expectedVersion', String(ticket.version));
    expect(missingPhotoRes.status).toBe(400);

    // 6. Technician submits repair with afterPhoto
    const repairRes = await request(app)
      .post(`/api/tickets/${ticket.id}/submit-repair`)
      .set('Authorization', `Bearer ${tech1.token}`)
      .field('completionNote', 'Cleared AC drain line and tested cooling.')
      .field('expectedVersion', String(ticket.version))
      .attach('afterPhoto', afterPng, { filename: 'after.png', contentType: 'image/png' });
    expect(repairRes.status).toBe(200);
    ticket = repairRes.body.ticket;
    expect(ticket.status).toBe('Awaiting Verification');

    // 7. Supervisor verifies & closes ticket
    const closeRes = await request(app)
      .post(`/api/tickets/${ticket.id}/close`)
      .set('Cookie', supervisor.cookies!)
      .send({ verificationNote: 'Verified dry floor in Room 204.', expectedVersion: ticket.version });
    expect(closeRes.status).toBe(200);
    ticket = closeRes.body.ticket;
    expect(ticket.status).toBe('Closed');

    // 8. Reporter sees final Closed status & timeline
    const reporterView = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${reporter.token}`);
    expect(reporterView.status).toBe(200);
    expect(reporterView.body.ticket.status).toBe('Closed');
    expect(reporterView.body.ticket.attachments).toHaveLength(3);
    expect(reporterView.body.ticket.events.map((e: { eventType: string }) => e.eventType)).toEqual([
      'created',
      'assigned',
      'priority_changed',
      'work_started',
      'repair_submitted',
      'closed',
    ]);
  });
});
