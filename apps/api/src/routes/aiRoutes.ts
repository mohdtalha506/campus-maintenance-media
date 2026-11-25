import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimit.js';
import { assertValidUploadedFile, audioUpload } from '../middleware/upload.js';
import { BuildingModel } from '../models/Building.js';
import { RoomModel } from '../models/Room.js';
import { generateMaintenanceDraft } from '../services/aiService.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export const aiRouter = Router();

aiRouter.post(
  '/draft',
  requireAuth,
  requireRole('reporter', 'supervisor'),
  aiRateLimiter,
  audioUpload.single('audio'),
  asyncHandler(async (req, res) => {
    const buildingId = typeof req.body.buildingId === 'string' ? req.body.buildingId.trim() : '';
    const roomId = typeof req.body.roomId === 'string' ? req.body.roomId.trim() : '';

    if (!mongoose.Types.ObjectId.isValid(buildingId) || !mongoose.Types.ObjectId.isValid(roomId)) {
      throw new AppError(400, 'INVALID_LOCATION', 'Valid buildingId and roomId are required.');
    }

    const [building, room] = await Promise.all([
      BuildingModel.findById(buildingId).lean(),
      RoomModel.findById(roomId).lean(),
    ]);

    if (!building || !room || room.buildingId.toString() !== building._id.toString()) {
      throw new AppError(404, 'LOCATION_NOT_FOUND', 'Selected building and room were not found.');
    }

    if (req.file) {
      assertValidUploadedFile(req.file, 'audio');
    }

    const mockHintText =
      typeof req.body.mockHintText === 'string' ? req.body.mockHintText : undefined;

    const draft = await generateMaintenanceDraft({
      audioBuffer: req.file?.buffer,
      audioMimeType: req.file?.mimetype,
      buildingName: building.name,
      roomName: room.name,
      roomNumber: room.roomNumber,
      mockHintText,
    });

    res.json({ draft });
  })
);
