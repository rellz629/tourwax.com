import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { sql } from 'drizzle-orm';

async function findDuplicates() {
  console.log('🔍 Checking for duplicate artists...\n');

  // Find duplicate artist names
  const duplicates = await db.execute(sql`
    SELECT name, COUNT(*) as count,
           STRING_AGG(id, ', ') as ids,
           STRING_AGG(COALESCE(spotify_id, 'no-spotify'), ', ') as spotify_ids
    FROM artists
    GROUP BY name
    HAVING COUNT(*) > 1
    ORDER BY name
  `);

  if (duplicates.rows.length === 0) {
    console.log('✅ No duplicate artists found!');
  } else {
    console.log(`❌ Found ${duplicates.rows.length} duplicate artist names:\n`);

    for (const row of duplicates.rows as any[]) {
      console.log(`Artist: ${row.name} (${row.count} entries)`);
      const ids = row.ids.split(', ');
      const spotifyIds = row.spotify_ids.split(', ');

      for (let i = 0; i < ids.length; i++) {
        console.log(`  - ID: ${ids[i]}, Spotify: ${spotifyIds[i]}`);
      }
      console.log('');
    }
  }

  // Also check for artists with low-res images
  console.log('\n🖼️  Checking image quality...\n');

  const lowResImages = await db.select({
    name: artists.name,
    imageUrl: artists.imageUrl,
  })
  .from(artists)
  .where(sql`image_url IS NOT NULL`);

  const pixelatedArtists = lowResImages.filter(a => {
    if (!a.imageUrl) return false;
    // Check if image URL contains size indicators
    return a.imageUrl.includes('60x60') || a.imageUrl.includes('64x64') || a.imageUrl.includes('120x120');
  });

  if (pixelatedArtists.length > 0) {
    console.log(`⚠️  Found ${pixelatedArtists.length} artists with potentially low-res images:`);
    pixelatedArtists.forEach(a => {
      console.log(`  - ${a.name}: ${a.imageUrl?.substring(0, 80)}...`);
    });
  } else {
    console.log('✅ All artist images appear to be high resolution');
  }
}

findDuplicates()
  .catch(console.error)
  .finally(() => process.exit(0));
