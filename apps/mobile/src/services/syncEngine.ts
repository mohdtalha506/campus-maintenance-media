import type { AiDraftDTO, TicketDetailDTO } from '@campus/shared';
import type { LocalDraftRecord } from '../types/draft';

export interface SyncStore {
  listDraftsForReporter(reporterId: string): Promise<LocalDraftRecord[]>;
  upsertDraft(draft: LocalDraftRecord): Promise<void>;
}

export interface SyncApiClient {
  generateAiDraft(params: {
    buildingId: string;
    roomId: string;
    audioUri: string;
    audioMimeType: string;
  }): Promise<{ draft: AiDraftDTO }>;
  createTicket(params: {
    clientSubmissionId: string;
    buildingId: string;
    roomId: string;
    title: string;
    description: string;
    category: string;
    aiDraft: AiDraftDTO | null;
    photoUri: string | null;
    photoMimeType: string | null;
    audioUri: string | null;
    audioMimeType: string | null;
  }): Promise<{ ticket: TicketDetailDTO; idempotentReplay: boolean }>;
}

export interface SyncResult {
  aiCompletedLocalIds: string[];
  aiFailedLocalIds: string[];
  submittedLocalIds: string[];
  submitFailedLocalIds: string[];
}

export async function processOfflineQueues(params: {
  reporterId: string;
  store: SyncStore;
  api: SyncApiClient;
  onCleanupMedia?: (draft: LocalDraftRecord) => Promise<void>;
}): Promise<SyncResult> {
  const result: SyncResult = {
    aiCompletedLocalIds: [],
    aiFailedLocalIds: [],
    submittedLocalIds: [],
    submitFailedLocalIds: [],
  };

  const drafts = await params.store.listDraftsForReporter(params.reporterId);

  for (const draft of drafts) {
    if (draft.aiStatus === 'queued' && draft.audioUri) {
      const processing: LocalDraftRecord = {
        ...draft,
        aiStatus: 'processing',
        aiError: null,
        updatedAt: new Date().toISOString(),
      };
      await params.store.upsertDraft(processing);

      try {
        const { draft: generated } = await params.api.generateAiDraft({
          buildingId: draft.buildingId,
          roomId: draft.roomId,
          audioUri: draft.audioUri,
          audioMimeType: draft.audioMimeType ?? 'audio/m4a',
        });

        const readyDraft: LocalDraftRecord = {
          ...processing,
          aiDraft: generated,
          aiStatus: 'ready',
          aiError: null,
          title: processing.userEdited ? processing.title : generated.title,
          description: processing.userEdited ? processing.description : generated.description,
          category: processing.userEdited ? processing.category : generated.suggestedCategory,
          updatedAt: new Date().toISOString(),
        };
        await params.store.upsertDraft(readyDraft);
        result.aiCompletedLocalIds.push(draft.localId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI draft generation failed.';
        await params.store.upsertDraft({
          ...processing,
          aiStatus: 'failed',
          aiError: message,
          updatedAt: new Date().toISOString(),
        });
        result.aiFailedLocalIds.push(draft.localId);
      }
    }
  }

  const latestDrafts = await params.store.listDraftsForReporter(params.reporterId);
  for (const draft of latestDrafts) {
    if (draft.syncStatus === 'queued') {
      const uploading: LocalDraftRecord = {
        ...draft,
        syncStatus: 'uploading',
        syncError: null,
        updatedAt: new Date().toISOString(),
      };
      await params.store.upsertDraft(uploading);

      try {
        const res = await params.api.createTicket({
          clientSubmissionId: draft.clientSubmissionId,
          buildingId: draft.buildingId,
          roomId: draft.roomId,
          title: draft.title,
          description: draft.description,
          category: draft.category,
          aiDraft: draft.aiDraft,
          photoUri: draft.photoUri,
          photoMimeType: draft.photoMimeType,
          audioUri: draft.audioUri,
          audioMimeType: draft.audioMimeType,
        });

        const synced: LocalDraftRecord = {
          ...uploading,
          syncStatus: 'synced',
          syncError: null,
          serverTicketId: res.ticket.id,
          serverTicketNumber: res.ticket.ticketNumber,
          updatedAt: new Date().toISOString(),
        };
        await params.store.upsertDraft(synced);
        if (params.onCleanupMedia) {
          await params.onCleanupMedia(synced);
        }
        result.submittedLocalIds.push(draft.localId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Ticket upload failed.';
        await params.store.upsertDraft({
          ...uploading,
          syncStatus: 'error',
          syncError: message,
          updatedAt: new Date().toISOString(),
        });
        result.submitFailedLocalIds.push(draft.localId);
      }
    }
  }

  return result;
}
