import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { nanoid } from 'nanoid';
import { getTopArtistsByGenre, getTopArtists, GENRES } from '@/lib/spotify';
import { slugify } from '@/lib/slugify';

async function importFromSpotify() {
  console.log('🎵 Importing artists from Spotify...\n');

  const allArtists: any[] = [];

  // Skip the generic "top artists" search and rely on genre searches instead
  // (Spotify's search API is finicky with different limit values)

  // Option 2: Get top artists by genre
  for (const genre of GENRES.slice(0, 5)) { // Limit to 5 genres to avoid rate limits
    console.log(`🎸 Fetching top artists in ${genre}...`);
    try {
      const genreArtists = await getTopArtistsByGenre(genre, 20);
      allArtists.push(...genreArtists);
      console.log(`  ✓ Found ${genreArtists.length} ${genre} artists`);

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log(`  ✗ Error fetching ${genre} artists:`, error);
    }
  }

  // Remove duplicates by Spotify ID
  const uniqueArtists = Array.from(
    new Map(allArtists.map(a => [a.id, a])).values()
  );

  console.log(`\n📈 Total unique artists found: ${uniqueArtists.length}\n`);

  // Insert into database
  let added = 0;
  let skipped = 0;

  for (const artist of uniqueArtists) {
    try {
      await db.insert(artists).values({
        id: nanoid(),
        slug: slugify(artist.name),
        name: artist.name,
        genre: artist.genres[0] || null,
        imageUrl: artist.images[0]?.url || null,
        spotifyId: artist.id,
        ticketmasterId: null,
        bandsintownId: null,
        seatgeekId: null,
        isActive: true,
      });
      added++;
      console.log(`  ✓ Added ${artist.name} (${artist.genres[0] || 'Unknown'})`);
    } catch (error: any) {
      if (error.code === '23505') {
        skipped++;
      } else {
        console.error(`  ✗ Error adding ${artist.name}:`, error);
      }
    }
  }

  console.log(`\n✅ Import completed!`);
  console.log(`  Added: ${added} artists`);
  console.log(`  Skipped (duplicates): ${skipped} artists`);
}

importFromSpotify()
  .catch(console.error)
  .finally(() => process.exit(0));
