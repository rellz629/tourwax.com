import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { nanoid } from 'nanoid';

/**
 * Import popular music artists from Ticketmaster
 * This fetches artists with upcoming music events
 */

async function importFromTicketmaster() {
  console.log('🎸 Importing popular artists from Ticketmaster...\n');

  if (!process.env.TICKETMASTER_API_KEY) {
    throw new Error('TICKETMASTER_API_KEY is not set');
  }

  const allArtists: any[] = [];
  const pages = 5; // Fetch 5 pages = 500 artists

  for (let page = 0; page < pages; page++) {
    console.log(`📄 Fetching page ${page + 1}/${pages}...`);

    const params = new URLSearchParams({
      apikey: process.env.TICKETMASTER_API_KEY,
      classificationName: 'music',
      size: '100',
      page: page.toString(),
      sort: 'relevance,desc',
    });

    try {
      const response = await fetch(
        `https://app.ticketmaster.com/discovery/v2/attractions.json?${params}`
      );

      if (!response.ok) {
        console.log(`  ✗ Error: ${response.status}`);
        const errorText = await response.text();
        console.log(`  Error details: ${errorText.substring(0, 200)}`);
        continue;
      }

      const data = await response.json();
      const attractions = data._embedded?.attractions || [];

      allArtists.push(...attractions);
      console.log(`  ✓ Found ${attractions.length} artists (Total so far: ${allArtists.length})`);

      // Delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ✗ Error fetching page ${page}:`, error);
    }
  }

  // Remove duplicates by Ticketmaster ID
  const uniqueArtists = Array.from(
    new Map(allArtists.map(a => [a.id, a])).values()
  );

  console.log(`\n📊 Found ${uniqueArtists.length} unique artists\n`);

  let added = 0;
  let skipped = 0;

  for (const artist of uniqueArtists) {
    try {
      await db.insert(artists).values({
        id: nanoid(),
        name: artist.name,
        genre: artist.classifications?.[0]?.genre?.name || null,
        imageUrl: artist.images?.[0]?.url || null,
        spotifyId: null,
        ticketmasterId: artist.id,
        bandsintownId: null,
        seatgeekId: null,
        isActive: true,
      });
      added++;

      if (added % 50 === 0) {
        console.log(`  ✓ Imported ${added} artists...`);
      }
    } catch (error: any) {
      if (error.code === '23505') {
        // Duplicate - artist already exists
        skipped++;
      } else {
        console.error(`  ✗ Error adding ${artist.name}:`, error.message);
      }
    }
  }

  console.log(`\n✅ Import completed!`);
  console.log(`  Added: ${added} new artists`);
  console.log(`  Skipped (already exist): ${skipped} artists`);
  console.log(`  Total artists in database: ${added + skipped + 20} (including original 20)`);
  console.log(`\n📝 Next steps:`);
  console.log(`  1. Run 'npm run fetch:tours' to get tour dates`);
  console.log(`  2. Run 'npm run fetch:news' to get news articles`);
}

importFromTicketmaster()
  .catch(console.error)
  .finally(() => process.exit(0));
