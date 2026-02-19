import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
  const artistsWithCounts = await db
    .select({
      name: artists.name,
      genre: artists.genre,
      eventCount: sql<number>`count(${events.id})`,
    })
    .from(artists)
    .leftJoin(events, eq(artists.id, events.artistId))
    .groupBy(artists.id, artists.name, artists.genre)
    .orderBy(sql`count(${events.id}) desc`);

  console.log('\n📊 Artist Event Summary:\n');

  const withEvents = artistsWithCounts.filter(a => Number(a.eventCount) > 0);
  const withoutEvents = artistsWithCounts.filter(a => Number(a.eventCount) === 0);

  console.log('✅ Artists with upcoming tours:');
  withEvents.forEach(a => {
    console.log(`  • ${a.name} (${a.genre}): ${a.eventCount} events`);
  });

  console.log('\n⏸️  Artists with no current tours:');
  withoutEvents.forEach(a => {
    console.log(`  • ${a.name} (${a.genre})`);
  });

  console.log(`\n📈 Total: ${withEvents.length} artists touring, ${withoutEvents.length} on break\n`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
