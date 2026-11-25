import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { aiRouter } from './routes/aiRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { locationRouter } from './routes/locationRoutes.js';
import { mediaRouter } from './routes/mediaRoutes.js';
import { notificationRouter } from './routes/notificationRoutes.js';
import { ticketRouter } from './routes/ticketRoutes.js';
import { userRouter } from './routes/userRoutes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'campus-maintenance-api',
      aiMode: env.aiMode,
      storageDriver: env.storageDriver,
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/locations', locationRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/tickets', ticketRouter);
  app.use('/api/media', mediaRouter);
  app.use('/api/notifications', notificationRouter);

  app.use(errorHandler);
  return app;
}
