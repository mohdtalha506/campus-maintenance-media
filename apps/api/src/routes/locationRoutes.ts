import { Router } from 'express';
import mongoose from 'mongoose';
import {
  createBuildingSchema,
  createRoomSchema,
  updateBuildingSchema,
  updateRoomSchema,
} from '@campus/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { BuildingModel } from '../models/Building.js';
import { RoomModel } from '../models/Room.js';
import { serializeBuilding, serializeRoom } from '../services/serializers.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export const locationRouter = Router();

locationRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const includeInactive =
      req.query.includeInactive === 'true' && req.user?.role === 'supervisor';

    const buildingFilter = includeInactive ? {} : { active: true };
    const roomFilter = includeInactive ? {} : { active: true };

    const [buildings, rooms] = await Promise.all([
      BuildingModel.find(buildingFilter).sort({ name: 1 }).lean(),
      RoomModel.find(roomFilter)
        .populate('buildingId', 'name')
        .sort({ roomNumber: 1 })
        .lean(),
    ]);

    res.json({
      buildings: buildings.map((b) => serializeBuilding(b)),
      rooms: rooms.map((r) => serializeRoom(r)),
    });
  })
);

locationRouter.post(
  '/buildings',
  requireAuth,
  requireRole('supervisor'),
  asyncHandler(async (req, res) => {
    const body = createBuildingSchema.parse(req.body);
    const created = await BuildingModel.create(body);
    res.status(201).json({ building: serializeBuilding(created) });
  })
);

locationRouter.patch(
  '/buildings/:id',
  requireAuth,
  requireRole('supervisor'),
  asyncHandler(async (req, res) => {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : '';
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid building ID.');
    }
    const updates = updateBuildingSchema.parse(req.body);
    const updated = await BuildingModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    if (!updated) {
      throw new AppError(404, 'BUILDING_NOT_FOUND', 'Building was not found.');
    }
    res.json({ building: serializeBuilding(updated) });
  })
);

locationRouter.post(
  '/rooms',
  requireAuth,
  requireRole('supervisor'),
  asyncHandler(async (req, res) => {
    const body = createRoomSchema.parse(req.body);
    if (!mongoose.Types.ObjectId.isValid(body.buildingId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid building ID.');
    }
    const building = await BuildingModel.findById(body.buildingId).lean();
    if (!building) {
      throw new AppError(404, 'BUILDING_NOT_FOUND', 'Building was not found.');
    }
    const created = await RoomModel.create({
      buildingId: new mongoose.Types.ObjectId(body.buildingId),
      name: body.name,
      roomNumber: body.roomNumber,
      floor: body.floor,
    });
    res.status(201).json({ room: serializeRoom(created, building.name) });
  })
);

locationRouter.patch(
  '/rooms/:id',
  requireAuth,
  requireRole('supervisor'),
  asyncHandler(async (req, res) => {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : '';
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid room ID.');
    }
    const updates = updateRoomSchema.parse(req.body);
    const updated = await RoomModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).populate('buildingId', 'name');
    if (!updated) {
      throw new AppError(404, 'ROOM_NOT_FOUND', 'Room was not found.');
    }
    res.json({ room: serializeRoom(updated) });
  })
);
