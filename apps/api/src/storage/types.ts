import type { Readable } from 'node:stream';

export interface StorageAdapter {
  putObject(key: string, buffer: Buffer, contentType: string): Promise<void>;
  getObjectStream(key: string): Promise<Readable>;
  getSignedReadUrl?(key: string, expiresInSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}
