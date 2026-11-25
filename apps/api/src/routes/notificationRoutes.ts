import { Router } from 'express';
import { registerPushTokenSchema, unregisterPushTokenSchema } from '@campus/shared';
import { requireAuth } from '../middleware/auth.js';
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  registerPushToken,
  unregisterPushToken,
} from '../services/notificationService.js';
import { asyncHandler } from '../utils/errors.js';

export const notificationRouter = Router();

notificationRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await listNotificationsForUser(req.user!.id);
    res.json(result);
  })
);

notificationRouter.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await markAllNotificationsRead(req.user!.id);
    res.json(result);
  })
);

notificationRouter.post(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const result = await markNotificationRead(req.user!.id, id);
    res.json(result);
  })
);

notificationRouter.post(
  '/push-token',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = registerPushTokenSchema.parse(req.body);
    await registerPushToken(req.user!.id, body.token, body.platform);
    res.json({ ok: true });
  })
);

notificationRouter.delete(
  '/push-token',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = unregisterPushTokenSchema.parse(req.body);
    await unregisterPushToken(req.user!.id, body.token);
    res.json({ ok: true });
  })
);
