import * as SQLite from 'expo-sqlite';
import type { BuildingDTO, MaintenanceCategory, RoomDTO } from '@campus/shared';
import type { DraftAiStatus, DraftSyncStatus, LocalDraftRecord } from '../types/draft';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('campus_maintenance.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS cached_buildings (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          code TEXT NOT NULL,
          description TEXT NOT NULL,
          active INTEGER NOT NULL,
          updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS cached_rooms (
          id TEXT PRIMARY KEY NOT NULL,
          buildingId TEXT NOT NULL,
          name TEXT NOT NULL,
          roomNumber TEXT NOT NULL,
          floor TEXT NOT NULL,
          active INTEGER NOT NULL,
          updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS local_drafts (
          localId TEXT PRIMARY KEY NOT NULL,
          clientSubmissionId TEXT NOT NULL UNIQUE,
          reporterId TEXT NOT NULL,
          buildingId TEXT NOT NULL,
          buildingName TEXT NOT NULL,
          roomId TEXT NOT NULL,
          roomNumber TEXT NOT NULL,
          roomName TEXT NOT NULL,
          photoUri TEXT,
          photoMimeType TEXT,
          audioUri TEXT,
          audioMimeType TEXT,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          aiDraftJson TEXT,
          aiStatus TEXT NOT NULL,
          aiError TEXT,
          syncStatus TEXT NOT NULL,
          syncError TEXT,
          serverTicketId TEXT,
          serverTicketNumber TEXT,
          userEdited INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function cacheLocations(buildings: BuildingDTO[], rooms: RoomDTO[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM cached_buildings');
    await db.runAsync('DELETE FROM cached_rooms');
    for (const b of buildings) {
      await db.runAsync(
        `INSERT INTO cached_buildings (id, name, code, description, active, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [b.id, b.name, b.code, b.description, b.active ? 1 : 0, b.updatedAt]
      );
    }
    for (const r of rooms) {
      await db.runAsync(
        `INSERT INTO cached_rooms (id, buildingId, name, roomNumber, floor, active, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.buildingId, r.name, r.roomNumber, r.floor, r.active ? 1 : 0, r.updatedAt]
      );
    }
  });
}

export async function getCachedLocations(): Promise<{ buildings: BuildingDTO[]; rooms: RoomDTO[] }> {
  const db = await getDb();
  const bRows = await db.getAllAsync<{
    id: string;
    name: string;
    code: string;
    description: string;
    active: number;
    updatedAt: string;
  }>('SELECT * FROM cached_buildings WHERE active = 1 ORDER BY name ASC');

  const rRows = await db.getAllAsync<{
    id: string;
    buildingId: string;
    name: string;
    roomNumber: string;
    floor: string;
    active: number;
    updatedAt: string;
  }>('SELECT * FROM cached_rooms WHERE active = 1 ORDER BY roomNumber ASC');

  return {
    buildings: bRows.map((b) => ({
      ...b,
      active: b.active === 1,
      createdAt: b.updatedAt,
    })),
    rooms: rRows.map((r) => ({
      ...r,
      active: r.active === 1,
      createdAt: r.updatedAt,
    })),
  };
}

interface RawDraftRow {
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
  category: string;
  aiDraftJson: string | null;
  aiStatus: string;
  aiError: string | null;
  syncStatus: string;
  syncError: string | null;
  serverTicketId: string | null;
  serverTicketNumber: string | null;
  userEdited: number;
  createdAt: string;
  updatedAt: string;
}

function mapDraftRow(row: RawDraftRow): LocalDraftRecord {
  return {
    localId: row.localId,
    clientSubmissionId: row.clientSubmissionId,
    reporterId: row.reporterId,
    buildingId: row.buildingId,
    buildingName: row.buildingName,
    roomId: row.roomId,
    roomNumber: row.roomNumber,
    roomName: row.roomName,
    photoUri: row.photoUri,
    photoMimeType: row.photoMimeType,
    audioUri: row.audioUri,
    audioMimeType: row.audioMimeType,
    title: row.title,
    description: row.description,
    category: row.category as MaintenanceCategory,
    aiDraft: row.aiDraftJson ? JSON.parse(row.aiDraftJson) : null,
    aiStatus: row.aiStatus as DraftAiStatus,
    aiError: row.aiError,
    syncStatus: row.syncStatus as DraftSyncStatus,
    syncError: row.syncError,
    serverTicketId: row.serverTicketId,
    serverTicketNumber: row.serverTicketNumber,
    userEdited: row.userEdited === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function upsertDraft(draft: LocalDraftRecord): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO local_drafts (
      localId, clientSubmissionId, reporterId, buildingId, buildingName,
      roomId, roomNumber, roomName, photoUri, photoMimeType,
      audioUri, audioMimeType, title, description, category,
      aiDraftJson, aiStatus, aiError, syncStatus, syncError,
      serverTicketId, serverTicketNumber, userEdited, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(localId) DO UPDATE SET
      buildingId = excluded.buildingId,
      buildingName = excluded.buildingName,
      roomId = excluded.roomId,
      roomNumber = excluded.roomNumber,
      roomName = excluded.roomName,
      photoUri = excluded.photoUri,
      photoMimeType = excluded.photoMimeType,
      audioUri = excluded.audioUri,
      audioMimeType = excluded.audioMimeType,
      title = excluded.title,
      description = excluded.description,
      category = excluded.category,
      aiDraftJson = excluded.aiDraftJson,
      aiStatus = excluded.aiStatus,
      aiError = excluded.aiError,
      syncStatus = excluded.syncStatus,
      syncError = excluded.syncError,
      serverTicketId = excluded.serverTicketId,
      serverTicketNumber = excluded.serverTicketNumber,
      userEdited = excluded.userEdited,
      updatedAt = excluded.updatedAt`,
    [
      draft.localId,
      draft.clientSubmissionId,
      draft.reporterId,
      draft.buildingId,
      draft.buildingName,
      draft.roomId,
      draft.roomNumber,
      draft.roomName,
      draft.photoUri,
      draft.photoMimeType,
      draft.audioUri,
      draft.audioMimeType,
      draft.title,
      draft.description,
      draft.category,
      draft.aiDraft ? JSON.stringify(draft.aiDraft) : null,
      draft.aiStatus,
      draft.aiError,
      draft.syncStatus,
      draft.syncError,
      draft.serverTicketId,
      draft.serverTicketNumber,
      draft.userEdited ? 1 : 0,
      draft.createdAt,
      draft.updatedAt,
    ]
  );
}

export async function listDraftsForReporter(reporterId: string): Promise<LocalDraftRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RawDraftRow>(
    'SELECT * FROM local_drafts WHERE reporterId = ? ORDER BY updatedAt DESC',
    [reporterId]
  );
  return rows.map(mapDraftRow);
}

export async function getDraftById(localId: string): Promise<LocalDraftRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RawDraftRow>(
    'SELECT * FROM local_drafts WHERE localId = ?',
    [localId]
  );
  return row ? mapDraftRow(row) : null;
}

export async function deleteDraftById(localId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM local_drafts WHERE localId = ?', [localId]);
}
