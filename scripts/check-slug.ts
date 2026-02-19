import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq, like } from 'drizzle-orm';

async function checkSlug() {
  const artist = await db.query.artists.findFirst({
    where: eq(artists.name, 'Jhené Aiko'),
  });

  console.log('Artist:', artist?.name);
  console.log('Slug:', artist?.slug);
  console.log('ID:', artist?.id);

  // Also check what slugs contain "jhen"
  const similarArtists = await db
    .select()
    .from(artists)
    .where(like(artists.name, '%Jhen%'));

  console.log('\nSimilar artists:');
  similarArtists.forEach(a => {
    console.log(`  ${a.name} -> ${a.slug}`);
  });
}

checkSlug()
  .catch(console.error)
  .finally(() => process.exit(0));
