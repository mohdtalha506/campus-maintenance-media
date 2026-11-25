import { connectDatabase, disconnectDatabase } from './connect.js';
import { seedDatabase } from './seedData.js';

async function main() {
  await connectDatabase();
  const reset = process.argv.includes('--reset');
  await seedDatabase({ reset });
  console.log('Database seeded successfully (Academic Block, Labs, Hostel, users, and sample tickets).');
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await disconnectDatabase();
  process.exit(1);
});
