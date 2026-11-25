import multer from 'multer';
import {
  ALLOWED_AUDIO_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_AUDIO_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
} from '@campus/shared';
import { AppError } from '../utils/errors.js';

const allowedImages = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);
const allowedAudio = new Set<string>(ALLOWED_AUDIO_MIME_TYPES);

export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF';
  }
  if (mimeType === 'audio/ogg') {
    return buffer.subarray(0, 4).toString('ascii') === 'OggS';
  }
  if (mimeType === 'audio/webm') {
    return (
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    );
  }
  if (
    mimeType === 'audio/m4a' ||
    mimeType === 'audio/x-m4a' ||
    mimeType === 'audio/mp4' ||
    mimeType === 'audio/3gpp'
  ) {
    return buffer.length >= 8 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  if (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') {
    const isId3 = buffer.subarray(0, 3).toString('ascii') === 'ID3';
    const isFrameSync = buffer[0] === 0xff && ((buffer[1] ?? 0) & 0xe0) === 0xe0;
    return isId3 || isFrameSync;
  }
  if (mimeType === 'audio/aac') {
    return buffer[0] === 0xff && ((buffer[1] ?? 0) & 0xf0) === 0xf0;
  }

  return false;
}

export function assertValidUploadedFile(
  file: Express.Multer.File,
  kind: 'image' | 'audio'
): void {
  const normalizedMime = file.mimetype.split(';')[0]?.trim().toLowerCase() ?? '';
  if (kind === 'image') {
    if (!allowedImages.has(normalizedMime)) {
      throw new AppError(400, 'INVALID_FILE_TYPE', `Unsupported image type: ${file.mimetype}`);
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new AppError(413, 'FILE_TOO_LARGE', 'Image exceeds maximum size of 10 MB.');
    }
  } else {
    if (!allowedAudio.has(normalizedMime)) {
      throw new AppError(400, 'INVALID_FILE_TYPE', `Unsupported audio type: ${file.mimetype}`);
    }
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      throw new AppError(413, 'FILE_TOO_LARGE', 'Audio recording exceeds maximum size of 15 MB.');
    }
  }

  if (!validateMagicBytes(file.buffer, normalizedMime)) {
    throw new AppError(
      400,
      'INVALID_FILE_CONTENT',
      `File content does not match declared ${kind} MIME type.`
    );
  }
}

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
});

export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_SIZE_BYTES, files: 1 },
});

export const ticketCreationUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AUDIO_SIZE_BYTES,
    files: 2,
  },
});
