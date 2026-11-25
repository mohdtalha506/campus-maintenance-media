import { describe, expect, it } from 'vitest';
import {
  aiDraftOutputSchema,
  canTransitionStatus,
  createTicketSchema,
  reopenTicketSchema,
} from './index.js';

describe('@campus/shared', () => {
  it('enforces valid ticket workflow transitions', () => {
    expect(canTransitionStatus('New', 'Assigned')).toBe(true);
    expect(canTransitionStatus('New', 'Closed')).toBe(false);
    expect(canTransitionStatus('Assigned', 'In Progress')).toBe(true);
    expect(canTransitionStatus('In Progress', 'Awaiting Verification')).toBe(true);
    expect(canTransitionStatus('Awaiting Verification', 'Closed')).toBe(true);
    expect(canTransitionStatus('Awaiting Verification', 'Reopened')).toBe(true);
    expect(canTransitionStatus('Closed', 'Reopened')).toBe(true);
    expect(canTransitionStatus('Reopened', 'Assigned')).toBe(true);
    expect(canTransitionStatus('Closed', 'In Progress')).toBe(false);
  });

  it('validates AI draft structured output', () => {
    const parsed = aiDraftOutputSchema.safeParse({
      title: 'AC water leakage in Room 204',
      description: 'Water is dripping from the air conditioning unit in Room 204.',
      suggestedCategory: 'HVAC',
      transcript: 'Room 204 mein AC se paani tapak raha hai.',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid categories and empty reopen reasons', () => {
    const badTicket = createTicketSchema.safeParse({
      clientSubmissionId: 'client-12345678',
      buildingId: 'b1',
      roomId: 'r1',
      title: 'AC leak',
      description: 'Water leaking from AC',
      category: 'UnknownCategory',
    });
    expect(badTicket.success).toBe(false);

    const badReopen = reopenTicketSchema.safeParse({
      reason: 'no',
      expectedVersion: 1,
    });
    expect(badReopen.success).toBe(false);
  });
});
