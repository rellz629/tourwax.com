import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { slugify } from '@/lib/slugify';

async function fixJheneSlug() {
  console.log('🔧 Fixing Jhené Aiko slug...\n');

  const artist = await db.query.artists.findFirst({
    where: eq(artists.name, 'Jhené Aiko'),
  });

  if (!artist) {
    console.log('❌ Artist not found');
    return;
  }

  console.log('Current slug:', artist.slug);

  const newSlug = slugify(artist.name);
  console.log('New slug:', newSlug);

  if (artist.slug === newSlug) {
    console.log('✓ Slug is already correct!');
    return;
  }

  await db
    .update(artists)
    .set({ slug: newSlug })
    .where(eq(artists.id, artist.id));

  console.log('✅ Slug updated successfully!');
  console.log(`   Old: ${artist.slug}`);
  console.log(`   New: ${newSlug}`);
}

fixJheneSlug()
  .catch(console.error)
  .finally(() => process.exit(0));
