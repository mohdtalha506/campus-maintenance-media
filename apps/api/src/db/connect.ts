import mongoose from 'mongoose';
import { env } from '../config/env.js';

let memoryServer: { stop: () => Promise<boolean | void>; getUri: () => string } | null = null;

export async function connectDatabase(uriOverride?: string): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  let uri = uriOverride ?? env.mongodbUri;
  if (!uriOverride && env.useInMemoryDb) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const server = await MongoMemoryServer.create();
    memoryServer = server;
    uri = server.getUri();
  }

  await mongoose.connect(uri);
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
