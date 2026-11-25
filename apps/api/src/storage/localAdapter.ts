import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { StorageAdapter } from './types.js';
import { AppError } from '../utils/errors.js';

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly rootDir: string) {}

  private resolveSafePath(key: string): string {
    const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.resolve(this.rootDir, normalized);
    const resolvedRoot = path.resolve(this.rootDir);
    if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
      throw new AppError(400, 'INVALID_STORAGE_KEY', 'Invalid storage key.');
    }
    return fullPath;
  }

  async putObject(key: string, buffer: Buffer, _contentType: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
    await fsPromises.writeFile(filePath, buffer);
  }

  async getObjectStream(key: string): Promise<Readable> {
    const filePath = this.resolveSafePath(key);
    try {
      await fsPromises.access(filePath, fs.constants.R_OK);
    } catch {
      throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media file was not found.');
    }
    return fs.createReadStream(filePath);
  }

  async deleteObject(key: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    await fsPromises.rm(filePath, { force: true });
  }
}
