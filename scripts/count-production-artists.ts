import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events } from '@/db/schema';
import { sql } from 'drizzle-orm';

async function checkProduction() {
  console.log('Checking production database...\n');

  try {
    // Count artists
    const artistCount = await db.select({ count: sql<number>`count(*)` })
      .from(artists);

    // Count events
    const eventCount = await db.select({ count: sql<number>`count(*)` })
      .from(events);

    console.log(`✓ Connected to database`);
    console.log(`  Artists: ${artistCount[0].count}`);
    console.log(`  Events: ${eventCount[0].count}`);

    if (artistCount[0].count === 0) {
      console.log('\n⚠️  WARNING: No artists in database!');
      console.log('   Run: npm run seed');
      console.log('   Then: npm run fetch:tours');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
}

checkProduction()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
