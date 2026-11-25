import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env.js';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many login attempts. Please wait a few minutes and try again.',
    },
  },
});

export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.aiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user?.id ?? req.ip ?? 'anonymous',
  message: {
    error: {
      code: 'AI_RATE_LIMITED',
      message:
        'You have reached the temporary AI draft limit. You can continue filling the report manually.',
    },
  },
});
