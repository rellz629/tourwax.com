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
};

async function fetchWikipediaBio(wikipediaPage: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikipediaPage)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TourWax/1.0 (https://tourwax.com; contact@tourwax.com)',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: WikipediaResponse = await response.json();

    if (!data.extract) {
      return null;
    }

    let bio = data.extract;

    // Split by sentences and take first 2-3
    const sentences = bio.match(/[^.!?]+[.!?]+/g) || [];
    if (sentences.length >= 2) {
      bio = sentences.slice(0, 2).join(' ').trim();

      if (bio.length > 400) {
        bio = sentences[0].trim();
      }
    }

    return bio;
  } catch (error) {
    console.error(`Error fetching bio:`, error);
    return null;
  }
}

async function fixProblematicBios() {
  console.log('🔧 Fixing bios for artists with common names...\n');

  const artistsToFix = ['Future', 'Drake', 'Khalid', 'Muse'];

  for (const artistName of artistsToFix) {
    console.log(`📖 Updating bio for: ${artistName}`);

    const wikipediaPage = WIKIPEDIA_ARTIST_PAGES[artistName];
    const bio = await fetchWikipediaBio(wikipediaPage);

    if (bio) {
      // Find and update artist
      const artist = await db.query.artists.findFirst({
        where: eq(artists.name, artistName),
      });

      if (artist) {
        await db
          .update(artists)
          .set({
            bio,
            updatedAt: new Date(),
          })
          .where(eq(artists.id, artist.id));

        console.log(`  ✓ Updated bio (${bio.length} chars)`);
        console.log(`  "${bio.substring(0, 100)}..."\n`);
      } else {
        console.log(`  ⚠️  Artist not found in database\n`);
      }
    } else {
      console.log(`  ❌ Failed to fetch bio\n`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('✅ Bio fixes completed!');
}

fixProblematicBios()
  .catch(console.error)
  .finally(() => process.exit(0));
