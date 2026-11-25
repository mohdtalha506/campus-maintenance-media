import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { LocalStorageAdapter } from './localAdapter.js';
import { S3StorageAdapter } from './s3Adapter.js';
import type { StorageAdapter } from './types.js';

let cachedAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (cachedAdapter) return cachedAdapter;
  if (env.storageDriver === 's3') {
    cachedAdapter = new S3StorageAdapter(env.s3);
  } else {
    cachedAdapter = new LocalStorageAdapter(env.uploadDir);
  }
  return cachedAdapter;
}

export function setStorageAdapterForTests(adapter: StorageAdapter | null): void {
  cachedAdapter = adapter;
}

export interface SignedMediaTokenPayload {
  attachmentId: string;
  ticketId: string;
  storageKey: string;
  mimeType: string;
}

export function createSignedMediaToken(
  payload: SignedMediaTokenPayload,
  expiresInSeconds = 300
): string {
  return jwt.sign(payload, env.mediaSigningSecret, {
    expiresIn: expiresInSeconds,
  });
}

export function verifySignedMediaToken(token: string): SignedMediaTokenPayload {
  return jwt.verify(token, env.mediaSigningSecret) as SignedMediaTokenPayload;
}
