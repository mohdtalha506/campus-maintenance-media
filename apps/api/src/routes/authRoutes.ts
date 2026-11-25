import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { loginSchema } from '@campus/shared';
import { env } from '../config/env.js';
import { requireAuth, signSessionToken } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';
import { UserModel } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  loginRateLimiter,
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.parse(req.body);
    const userDoc = await UserModel.findOne({ email: parsed.email });
    if (!userDoc || !userDoc.active) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const valid = await bcrypt.compare(parsed.password, userDoc.passwordHash);
    if (!valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const user = {
      id: userDoc._id.toString(),
      name: userDoc.name,
      email: userDoc.email,
      role: userDoc.role,
      active: userDoc.active,
    };

    const token = signSessionToken(user);

    res.cookie(env.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.nodeEnv === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    const isMobileClient = req.headers['x-client-type'] === 'mobile';
    res.json({
      user,
      ...(isMobileClient ? { token } : {}),
    });
  })
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    path: '/',
  });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
