import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { slugify } from '@/lib/slugify';

async function fixAllSlugs() {
  console.log('🔧 Checking all artist slugs for special characters...\n');

  const allArtists = await db.select().from(artists);

  let fixedCount = 0;

  for (const artist of allArtists) {
    const correctSlug = slugify(artist.name);

    if (artist.slug !== correctSlug) {
      console.log(`Fixing: ${artist.name}`);
      console.log(`  Old slug: ${artist.slug}`);
      console.log(`  New slug: ${correctSlug}`);

      await db
        .update(artists)
        .set({ slug: correctSlug })
        .where(eq(artists.id, artist.id));

      fixedCount++;
      console.log('  ✓ Updated\n');
    }
  }

  console.log(`✅ Checked ${allArtists.length} artists`);
  console.log(`   Fixed: ${fixedCount}`);
  console.log(`   Already correct: ${allArtists.length - fixedCount}`);
}

fixAllSlugs()
  .catch(console.error)
  .finally(() => process.exit(0));
