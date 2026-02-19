import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';

async function checkSlugs() {
  const allArtists = await db.select({
    name: artists.name,
    slug: artists.slug
  })
  .from(artists)
  .limit(15);

  console.log('Sample artist slugs:\n');
  allArtists.forEach(a => {
    console.log(`  ${a.name.padEnd(25)} → ${a.slug}`);
  });
}

checkSlugs()
  .catch(console.error)
  .finally(() => process.exit(0));
