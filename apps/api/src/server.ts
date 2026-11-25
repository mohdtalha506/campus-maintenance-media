import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './db/connect.js';
import { seedDatabaseIfEmpty } from './db/seedData.js';

async function start(): Promise<void> {
  await connectDatabase();
  if (env.useInMemoryDb) {
    await seedDatabaseIfEmpty();
  }

  const app = createApp();
  app.listen(env.port, '0.0.0.0', () => {
    console.log(
      `Campus Maintenance API listening on http://localhost:${env.port} (AI_MODE=${env.aiMode}, STORAGE=${env.storageDriver})`
    );
  });
}

start().catch((err) => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});
