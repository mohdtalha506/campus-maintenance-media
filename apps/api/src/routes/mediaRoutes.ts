import { Router } from 'express';
import { getStorageAdapter, verifySignedMediaToken } from '../storage/index.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export const mediaRouter = Router();

mediaRouter.get(
  '/signed',
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      throw new AppError(401, 'MISSING_MEDIA_TOKEN', 'Signed media token is required.');
    }

    let payload;
    try {
      payload = verifySignedMediaToken(token);
    } catch {
      throw new AppError(401, 'INVALID_MEDIA_TOKEN', 'Signed media URL is invalid or expired.');
    }

    const storage = getStorageAdapter();
    const stream = await storage.getObjectStream(payload.storageKey);
    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=60');
    stream.pipe(res);
  })
);
