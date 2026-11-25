import type { AiDraftDTO, MaintenanceCategory } from '@campus/shared';

export type DraftAiStatus = 'none' | 'queued' | 'processing' | 'ready' | 'failed';
export type DraftSyncStatus = 'draft' | 'queued' | 'uploading' | 'synced' | 'error';

export interface LocalDraftRecord {
  localId: string;
  clientSubmissionId: string;
  reporterId: string;
  buildingId: string;
  buildingName: string;
  roomId: string;
  roomNumber: string;
  roomName: string;
  photoUri: string | null;
  photoMimeType: string | null;
  audioUri: string | null;
  audioMimeType: string | null;
  title: string;
  description: string;
  category: MaintenanceCategory;
  aiDraft: AiDraftDTO | null;
  aiStatus: DraftAiStatus;
  aiError: string | null;
  syncStatus: DraftSyncStatus;
  syncError: string | null;
  serverTicketId: string | null;
  serverTicketNumber: string | null;
  userEdited: boolean;
  createdAt: string;
  updatedAt: string;
}
