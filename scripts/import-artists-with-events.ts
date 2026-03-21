import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { nanoid } from 'nanoid';
import { slugify } from '@/lib/slugify';

/**
 * Import artists from Ticketmaster who have upcoming events
 * This ensures you only add artists who are actually touring
 */

interface TicketmasterAttraction {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
  classifications?: Array<{ genre?: { name?: string } }>;
}

async function getArtistsWithEvents(): Promise<TicketmasterAttraction[]> {
  if (!process.env.TICKETMASTER_API_KEY) {
    throw new Error('TICKETMASTER_API_KEY is not set');
  }

  const allArtists: TicketmasterAttraction[] = [];

  // Fetch multiple pages of music events and extract the artists/attractions
  const totalPages = 5;
  for (let page = 0; page < totalPages; page++) {
    console.log(`🎸 Fetching events page ${page + 1}/${totalPages}...`);

    const params = new URLSearchParams({
      apikey: process.env.TICKETMASTER_API_KEY,
      classificationName: 'music',
      size: '200',
      page: String(page),
      sort: 'relevance,desc',
      countryCode: 'US',
    });

    try {
      const response = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?${params}`
      );

      if (!response.ok) {
        console.log(`  ✗ Error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const evts = data._embedded?.events || [];

      for (const evt of evts) {
        const attractions = evt._embedded?.attractions || [];
        for (const attraction of attractions) {
          // Only include music artists (not venues, sponsors, etc.)
          const isMusicArtist = attraction.classifications?.some(
            (c: any) => c.segment?.name === 'Music'
          );
          if (isMusicArtist || !attraction.classifications) {
            allArtists.push(attraction);
          }
        }
      }

      console.log(`  ✓ Extracted artists from ${evts.length} events (total: ${allArtists.length})`);

      // Delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ✗ Error fetching page ${page}:`, error);
    }
  }

  return allArtists;
}

async function importArtists() {
  console.log('🚀 Importing artists with upcoming events from Ticketmaster...\n');

  const artistsFromTM = await getArtistsWithEvents();

  // Remove duplicates
  const uniqueArtists = Array.from(
    new Map(artistsFromTM.map(a => [a.id, a])).values()
  );

  console.log(`\n📊 Found ${uniqueArtists.length} unique artists with events\n`);

  let added = 0;
  let skipped = 0;

  for (const artist of uniqueArtists) {
    try {
      await db.insert(artists).values({
        id: nanoid(),
        slug: slugify(artist.name),
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

      if (added % 10 === 0) {
        console.log(`  ✓ Imported ${added} artists...`);
      }
    } catch (error: any) {
      if (error.code === '23505') {
        skipped++;
      } else {
        console.error(`  ✗ Error adding ${artist.name}:`, error);
      }
    }
  }

  console.log(`\n✅ Import completed!`);
  console.log(`  Added: ${added} new artists`);
  console.log(`  Skipped (already exist): ${skipped} artists`);
  console.log(`\nNext step: Run 'npm run fetch:tours' to get their tour dates!`);
}

importArtists()
  .catch(console.error)
  .finally(() => process.exit(0));
