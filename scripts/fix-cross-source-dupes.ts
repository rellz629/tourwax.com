import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { events, venues } from '@/db/schema';
import { sql, inArray } from 'drizzle-orm';

// Find and remove duplicate events across sources (Ticketmaster vs SeatGeek)
// where the same artist plays the same city on the same date but the venues
// have different IDs and slightly different city names (e.g., "St Augustine" vs "Saint Augustine")

async function main() {
  console.log('🔍 Finding cross-source duplicate events...\n');

  // Join events with venues, normalize city names, and find duplicates
  const duplicateGroups = await db.execute(sql`
    SELECT e.artist_id,
           e.event_date::date as event_day,
           LOWER(REGEXP_REPLACE(
             REGEXP_REPLACE(
               REGEXP_REPLACE(
                 REGEXP_REPLACE(
                   REGEXP_REPLACE(COALESCE(v.city, ''), '\mSt\.?\s', 'Saint ', 'gi'),
                 '\mFt\.?\s', 'Fort ', 'gi'),
               '\mMt\.?\s', 'Mount ', 'gi'),
             '\mN\.?\s', 'North ', 'gi'),
           '\mS\.?\s', 'South ', 'gi')
           ) as norm_city,
           array_agg(e.id ORDER BY
             CASE WHEN e.source = 'ticketmaster' THEN 0 ELSE 1 END,
             e.id
           ) as event_ids,
           array_agg(e.name ORDER BY
             CASE WHEN e.source = 'ticketmaster' THEN 0 ELSE 1 END,
             e.id
           ) as event_names,
           array_agg(e.source ORDER BY
             CASE WHEN e.source = 'ticketmaster' THEN 0 ELSE 1 END,
             e.id
           ) as event_sources,
           array_agg(v.city ORDER BY
             CASE WHEN e.source = 'ticketmaster' THEN 0 ELSE 1 END,
             e.id
           ) as venue_cities,
           count(*) as cnt
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    GROUP BY e.artist_id, e.event_date::date, norm_city
    HAVING count(*) > 1
      AND count(DISTINCT e.source) > 1
    ORDER BY count(*) DESC
  `);

  // postgres-js returns an array directly from db.execute
  const rows = Array.isArray(duplicateGroups) ? duplicateGroups : (duplicateGroups as any).rows || [];

  if (rows.length === 0) {
    console.log('No cross-source duplicates found!');
    return;
  }

  console.log(`Found ${rows.length} groups of cross-source duplicate events\n`);

  const idsToDelete: string[] = [];

  for (const group of rows) {
    const ids = group.event_ids as string[];
    const names = group.event_names as string[];
    const sources = group.event_sources as string[];
    const cities = group.venue_cities as string[];

    // Keep the first one (Ticketmaster preferred due to ORDER BY)
    const keepId = ids[0];
    const deleteIds = ids.slice(1);

    console.log(`  ${names[0]} — ${cities[0]} (${group.event_day}):`);
    console.log(`    ✓ KEEP:   [${sources[0]}] ${names[0]} (${cities[0]})`);
    for (let i = 1; i < ids.length; i++) {
      console.log(`    ✗ DELETE: [${sources[i]}] ${names[i]} (${cities[i]})`);
    }
    console.log('');

    idsToDelete.push(...deleteIds);
  }

  if (idsToDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  console.log(`\n🗑️  Deleting ${idsToDelete.length} cross-source duplicate events...`);

  const batchSize = 100;
  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);
    await db.delete(events).where(inArray(events.id, batch));
  }

  console.log(`✅ Deleted ${idsToDelete.length} cross-source duplicate events!`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
