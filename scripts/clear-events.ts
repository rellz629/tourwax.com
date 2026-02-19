import { config } from 'dotenv';
// Load .env.local BEFORE any other imports
config({ path: '.env.local' });

import { db } from '@/db';
import { events, venues } from '@/db/schema';

async function main() {
  console.log('🗑️  Clearing events and venues...\n');

  await db.delete(events);
  console.log('  ✓ Cleared all events');

  await db.delete(venues);
  console.log('  ✓ Cleared all venues');

  console.log('\n✅ Database cleaned!');
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
