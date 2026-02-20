import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { events } from '@/db/schema';
import { sql, inArray } from 'drizzle-orm';

const PACKAGE_KEYWORDS = [
  'vip', 'package', 'upgrade', 'comfort seat', 'lounge', 'meet & greet',
  'meet and greet', 'premium', 'platinum', 'gold circle', 'early entry',
  'soundcheck', 'vinyl room', 'hospitality', 'suite', 'box seat',
  'excluding concert ticket', 'hot ticket', 'upsell',
];

async function main() {
  console.log('🔍 Finding duplicate events...\n');

  // Find groups of events with the same artist, venue, and date
  const duplicateGroups = await db.execute(sql`
    SELECT artist_id, venue_id, event_date::date as event_day,
           array_agg(id) as event_ids,
           array_agg(name) as event_names,
           count(*) as cnt
    FROM events
    GROUP BY artist_id, venue_id, event_date::date
    HAVING count(*) > 1
    ORDER BY count(*) DESC
  `);

  if (duplicateGroups.rows.length === 0) {
    console.log('No duplicates found!');
    return;
  }

  console.log(`Found ${duplicateGroups.rows.length} groups of duplicate events\n`);

  const idsToDelete: string[] = [];

  for (const group of duplicateGroups.rows) {
    const ids = group.event_ids as string[];
    const names = group.event_names as string[];

    // Find the main event (non-package) or keep the first one
    let keepIndex = 0;
    for (let i = 0; i < names.length; i++) {
      const lower = names[i].toLowerCase();
      const isPackage = PACKAGE_KEYWORDS.some(kw => lower.includes(kw));
      if (!isPackage) {
        keepIndex = i;
        break;
      }
    }

    const keepId = ids[keepIndex];
    const deleteIds = ids.filter((_: string, i: number) => i !== keepIndex);

    console.log(`  Group (${ids.length} events):`);
    for (let i = 0; i < ids.length; i++) {
      const marker = i === keepIndex ? '✓ KEEP' : '✗ DELETE';
      console.log(`    ${marker}: ${names[i]}`);
    }
    console.log('');

    idsToDelete.push(...deleteIds);
  }

  if (idsToDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  console.log(`\n🗑️  Deleting ${idsToDelete.length} duplicate events...`);

  // Delete in batches
  const batchSize = 100;
  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);
    await db.delete(events).where(inArray(events.id, batch));
  }

  console.log(`✅ Deleted ${idsToDelete.length} duplicate/package events!`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
