import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';

async function checkSlugs() {
  const allArtists = await db.select({
    name: artists.name,
    slug: artists.slug,
  }).from(artists).limit(10);

  console.log('\nSample artists from database:');
  allArtists.forEach(a => {
    console.log(`  ${a.name.padEnd(25)} -> slug: '${a.slug || 'NULL'}'`);
  });

  const nullCount = allArtists.filter(a => !a.slug).length;
  if (nullCount > 0) {
    console.log(`\n⚠️  Warning: ${nullCount} artists missing slugs!`);
  } else {
    console.log('\n✓ All artists have slugs');
  }
}

checkSlugs()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
