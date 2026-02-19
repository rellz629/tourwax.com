import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { isNull, eq } from 'drizzle-orm';
import { searchArtist } from '@/lib/spotify';

async function fixIssues() {
  console.log('🔧 Fixing duplicate artists and image quality...\n');

  // Step 1: Remove duplicate artists (ones without Spotify IDs)
  console.log('1️⃣ Removing duplicate artists (without Spotify IDs)...');

  const duplicateNames = [
    'Ariana Grande', 'Billie Eilish', 'Doja Cat', 'Drake', 'Dua Lipa',
    'Harry Styles', 'Kendrick Lamar', 'Olivia Rodrigo', 'Post Malone',
    'Taylor Swift', 'The Weeknd', 'Travis Scott'
  ];

  let deleted = 0;
  for (const name of duplicateNames) {
    // Delete the artist with this name that has NO Spotify ID
    const result = await db.delete(artists)
      .where(eq(artists.name, name))
      .where(isNull(artists.spotifyId));

    deleted++;
    console.log(`  ✓ Removed duplicate: ${name}`);
  }

  console.log(`\n  Removed ${deleted} duplicate artists\n`);

  // Step 2: Check and update low-quality images
  console.log('2️⃣ Checking specific artist images...\n');

  const artistsToCheck = ['Tyler, The Creator', 'Jhené Aiko'];

  for (const artistName of artistsToCheck) {
    const [artist] = await db.select()
      .from(artists)
      .where(eq(artists.name, artistName))
      .limit(1);

    if (!artist) {
      console.log(`  ⚠️  Artist not found: ${artistName}`);
      continue;
    }

    console.log(`  Checking: ${artistName}`);
    console.log(`    Current image: ${artist.imageUrl?.substring(0, 80)}...`);

    // Fetch fresh data from Spotify
    if (artist.spotifyId) {
      try {
        const spotifyData = await searchArtist(artistName);
        if (spotifyData && spotifyData.images && spotifyData.images.length > 0) {
          // Get the highest quality image (first one is usually largest)
          const bestImage = spotifyData.images[0].url;

          if (bestImage !== artist.imageUrl) {
            await db.update(artists)
              .set({ imageUrl: bestImage })
              .where(eq(artists.id, artist.id));

            console.log(`    ✓ Updated to: ${bestImage.substring(0, 80)}...`);
          } else {
            console.log(`    ℹ️  Image already at best quality`);
          }
        }
      } catch (error) {
        console.log(`    ✗ Error updating image:`, error);
      }
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✅ All fixes completed!');
}

fixIssues()
  .catch(console.error)
  .finally(() => process.exit(0));
