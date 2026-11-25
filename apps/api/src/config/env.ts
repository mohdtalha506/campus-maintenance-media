import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface AppEnv {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  useInMemoryDb: boolean;
  jwtSecret: string;
  jwtExpiresIn: string;
  cookieName: string;
  corsOrigins: string[];
  storageDriver: 'local' | 's3';
  uploadDir: string;
  mediaSigningSecret: string;
  s3: {
    endpoint: string;
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  };
  aiMode: 'live' | 'mock';
  geminiApiKey: string;
  geminiModel: string;
  aiTimeoutMs: number;
  aiRateLimitMax: number;
  loginRateLimitMax: number;
}

export function loadEnv(): AppEnv {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const jwtSecret =
    process.env.JWT_SECRET ??
    (nodeEnv === 'production' ? '' : 'dev-only-insecure-jwt-secret-change-me');
  if (!jwtSecret) {
    throw new Error('JWT_SECRET must be set in production');
  }

  const storageDriver = process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local';
  const aiMode = process.env.AI_MODE === 'mock' ? 'mock' : 'live';

  return {
    nodeEnv,
    port: Number(process.env.PORT ?? 4000),
    mongodbUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/campus_maintenance',
    useInMemoryDb: process.env.USE_IN_MEMORY_DB === 'true',
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    cookieName: process.env.COOKIE_NAME ?? 'cmc_session',
    corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    storageDriver,
    uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? './uploads'),
    mediaSigningSecret: process.env.MEDIA_SIGNING_SECRET ?? jwtSecret,
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      bucket: process.env.S3_BUCKET ?? '',
      region: process.env.S3_REGION ?? 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    },
    aiMode,
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
    aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 25000),
    aiRateLimitMax: Number(process.env.AI_RATE_LIMIT_MAX ?? 20),
    loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 25),
  };
}

export const env = loadEnv();
