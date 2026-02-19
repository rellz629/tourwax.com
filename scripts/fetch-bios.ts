import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface WikipediaResponse {
  extract?: string;
  title?: string;
}

/**
 * Artists with common names need specific Wikipedia page titles
 */
const WIKIPEDIA_ARTIST_PAGES: Record<string, string> = {
  'Future': 'Future_(rapper)',
  'Drake': 'Drake_(musician)',
  'Khalid': 'Khalid_(singer)',
  'Muse': 'Muse_(band)',
  'H.E.R.': 'H.E.R.',
};

/**
 * Fetch a short bio from Wikipedia for an artist
 */
async function fetchWikipediaBio(artistName: string): Promise<string | null> {
  try {
    // Use specific Wikipedia page if available, otherwise use artist name
    const wikipediaPage = WIKIPEDIA_ARTIST_PAGES[artistName] || artistName;

    // Wikipedia API endpoint for extracts
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikipediaPage)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TourWax/1.0 (https://tourwax.com; contact@tourwax.com)',
      },
    });

    if (!response.ok) {
      console.log(`  ⚠️  Wikipedia page not found for ${artistName}`);
      return null;
    }

    const data: WikipediaResponse = await response.json();

    if (!data.extract) {
      console.log(`  ⚠️  No extract found for ${artistName}`);
      return null;
    }

    // Get first 2-3 sentences (up to about 300 characters)
    let bio = data.extract;

    // Split by sentences and take first 2-3
    const sentences = bio.match(/[^.!?]+[.!?]+/g) || [];
    if (sentences.length >= 2) {
      bio = sentences.slice(0, 2).join(' ').trim();

      // If still too long, just take first sentence
      if (bio.length > 400) {
        bio = sentences[0].trim();
      }
    }

    return bio;
  } catch (error) {
    console.error(`  ❌ Error fetching Wikipedia bio for ${artistName}:`, error);
    return null;
  }
}

async function updateArtistBios() {
  console.log('🔍 Fetching Wikipedia bios for all artists...\n');

  // Get all active artists
  const allArtists = await db
    .select()
    .from(artists)
    .where(eq(artists.isActive, true));

  console.log(`Found ${allArtists.length} active artists\n`);

  let successCount = 0;
  let failCount = 0;

  for (const artist of allArtists) {
    console.log(`📖 Fetching bio for: ${artist.name}`);

    const bio = await fetchWikipediaBio(artist.name);

    if (bio) {
      // Update artist with bio
      await db
        .update(artists)
        .set({
          bio,
          updatedAt: new Date(),
        })
        .where(eq(artists.id, artist.id));

      console.log(`  ✓ Updated bio (${bio.length} chars)`);
      console.log(`  "${bio.substring(0, 100)}..."\n`);
      successCount++;
    } else {
      console.log(`  ⚠️  No bio found\n`);
      failCount++;
    }

    // Small delay to be nice to Wikipedia's API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✅ Bio fetch completed!');
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
}

updateArtistBios()
  .catch(console.error)
  .finally(() => process.exit(0));
