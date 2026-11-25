import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole, UserSummaryDTO } from '@campus/shared';
import { env } from '../config/env.js';
import { UserModel } from '../models/User.js';
import { AppError } from '../utils/errors.js';

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserSummaryDTO;
  }
}

export function signSessionToken(user: UserSummaryDTO): string {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function extractAuthToken(req: Request): string | null {
  const cookieToken = req.cookies?.[env.cookieName];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }
  return null;
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractAuthToken(req);
    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    }

    let decoded: AuthTokenPayload;
    try {
      decoded = jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
    } catch {
      throw new AppError(401, 'INVALID_TOKEN', 'Session is invalid or expired.');
    }

    const userDoc = await UserModel.findById(decoded.sub).select('-passwordHash').lean();
    if (!userDoc || !userDoc.active) {
      throw new AppError(401, 'UNAUTHORIZED', 'User account is inactive or not found.');
    }

    req.user = {
      id: userDoc._id.toString(),
      name: userDoc.name,
      email: userDoc.email,
      role: userDoc.role,
      active: userDoc.active,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required.'));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          403,
          'FORBIDDEN',
          `Role '${req.user.role}' is not permitted to perform this action.`
        )
      );
      return;
    }
    next();
  };
}
