import { describe, expect, it, vi } from 'vitest';
import type { LocalDraftRecord } from '../types/draft';
import { processOfflineQueues, type SyncApiClient, type SyncStore } from './syncEngine';

function makeDraft(overrides: Partial<LocalDraftRecord> = {}): LocalDraftRecord {
  const now = new Date().toISOString();
  return {
    localId: 'local-1',
    clientSubmissionId: 'client-sub-uuid-1',
    reporterId: 'rep-1',
    buildingId: 'b-1',
    buildingName: 'Academic Block',
    roomId: 'r-1',
    roomNumber: '204',
    roomName: 'Seminar Room 204',
    photoUri: 'file:///docs/campus-media/photo.jpg',
    photoMimeType: 'image/jpeg',
    audioUri: 'file:///docs/campus-media/audio.m4a',
    audioMimeType: 'audio/m4a',
    title: '',
    description: '',
    category: 'Other',
    aiDraft: null,
    aiStatus: 'queued',
    aiError: null,
    syncStatus: 'draft',
    syncError: null,
    serverTicketId: null,
    serverTicketNumber: null,
    userEdited: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMemoryStore(initial: LocalDraftRecord[]): SyncStore & { map: Map<string, LocalDraftRecord> } {
  const map = new Map(initial.map((d) => [d.localId, d]));
  return {
    map,
    async listDraftsForReporter(reporterId) {
      return [...map.values()].filter((d) => d.reporterId === reporterId);
    },
    async upsertDraft(draft) {
      map.set(draft.localId, draft);
    },
  };
}

describe('Mobile offline sync engine', () => {
  it('processes queued AI drafts when connectivity returns and marks them ready', async () => {
    const store = createMemoryStore([makeDraft({ aiStatus: 'queued' })]);
    const api: SyncApiClient = {
      generateAiDraft: vi.fn().mockResolvedValue({
        draft: {
          title: 'AC water leakage in Room 204',
          description: 'Water is dripping from the AC unit in Room 204.',
          suggestedCategory: 'HVAC',
          transcript: 'Room 204 mein AC se paani tapak raha hai.',
          model: 'gemini-3.1-flash-lite',
          generatedAt: new Date().toISOString(),
          isMock: false,
        },
      }),
      createTicket: vi.fn(),
    };

    const result = await processOfflineQueues({ reporterId: 'rep-1', store, api });
    expect(result.aiCompletedLocalIds).toEqual(['local-1']);

    const updated = store.map.get('local-1')!;
    expect(updated.aiStatus).toBe('ready');
    expect(updated.title).toBe('AC water leakage in Room 204');
    expect(updated.category).toBe('HVAC');
    expect(updated.syncStatus).toBe('draft'); // Never submits automatically
  });

  it('preserves local edits and durable media on failed submission, then retries with same clientSubmissionId', async () => {
    const store = createMemoryStore([
      makeDraft({
        aiStatus: 'ready',
        syncStatus: 'queued',
        title: 'Edited AC leak title',
        description: 'Edited description',
        category: 'HVAC',
        userEdited: true,
      }),
    ]);
    const cleanupSpy = vi.fn().mockResolvedValue(undefined);
    const createTicketMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce({
        idempotentReplay: false,
        ticket: { id: 'srv-1', ticketNumber: 'CMP-1007' },
      });

    const api: SyncApiClient = {
      generateAiDraft: vi.fn(),
      createTicket: createTicketMock as unknown as SyncApiClient['createTicket'],
    };

    // First attempt fails -> media NOT cleaned up, edits preserved
    const failRes = await processOfflineQueues({
      reporterId: 'rep-1',
      store,
      api,
      onCleanupMedia: cleanupSpy,
    });
    expect(failRes.submitFailedLocalIds).toEqual(['local-1']);
    expect(cleanupSpy).not.toHaveBeenCalled();

    const afterFail = store.map.get('local-1')!;
    expect(afterFail.syncStatus).toBe('error');
    expect(afterFail.syncError).toBe('Network timeout');
    expect(afterFail.title).toBe('Edited AC leak title');

    // Retry re-queues and succeeds using the exact same clientSubmissionId
    await store.upsertDraft({ ...afterFail, syncStatus: 'queued', syncError: null });
    const retryRes = await processOfflineQueues({
      reporterId: 'rep-1',
      store,
      api,
      onCleanupMedia: cleanupSpy,
    });
    expect(retryRes.submittedLocalIds).toEqual(['local-1']);
    expect(createTicketMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ clientSubmissionId: 'client-sub-uuid-1' })
    );
    expect(createTicketMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ clientSubmissionId: 'client-sub-uuid-1' })
    );
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(store.map.get('local-1')!.serverTicketNumber).toBe('CMP-1007');
  });
});
