import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserModel } from '../models/User.js';
import { asyncHandler } from '../utils/errors.js';

export const userRouter = Router();

userRouter.get(
  '/technicians',
  requireAuth,
  requireRole('supervisor'),
  asyncHandler(async (_req, res) => {
    const docs = await UserModel.find({ role: 'technician', active: true })
      .select('name email role active')
      .sort({ name: 1 })
      .lean();

    res.json({
      technicians: docs.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active,
      })),
    });
  })
);
