import { config } from 'dotenv';
// Load .env.local BEFORE any other imports
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as ticketmaster from '@/lib/ticketmaster';
import * as seatgeek from '@/lib/seatgeek';
import { getTicketmasterAffiliateUrl } from '@/lib/affiliate';

async function fetchToursForArtist(artistId: string, artistName: string) {
  console.log(`\n🎵 Fetching tours for: ${artistName}`);

  try {
    // Fetch from both sources in parallel
    const [tmData, sgData] = await Promise.allSettled([
      ticketmaster.searchArtistEvents(artistName),
      seatgeek.searchArtistEvents(artistName),
    ]);

    const allEvents = [];
    const allVenues = [];
    const updates: {
      ticketmasterId?: string;
      seatgeekId?: string;
      imageUrl?: string;
      genre?: string;
    } = {};

    // Process Ticketmaster data
    if (tmData.status === 'fulfilled') {
      const { events: tmEvents, venues: tmVenues, ticketmasterId, artistInfo } = tmData.value;
      // Apply affiliate tracking to Ticketmaster event URLs
      const tmEventsWithAffiliate = tmEvents.map(e => ({
        ...e,
        artistId,
        ticketUrl: e.ticketUrl ? getTicketmasterAffiliateUrl(e.ticketUrl) : e.ticketUrl,
      }));
      allEvents.push(...tmEventsWithAffiliate);
      allVenues.push(...tmVenues);
      if (ticketmasterId) updates.ticketmasterId = ticketmasterId;
      if (artistInfo?.imageUrl) updates.imageUrl = artistInfo.imageUrl;
      if (artistInfo?.genre) updates.genre = artistInfo.genre;
      console.log(`  ✓ Ticketmaster: ${tmEvents.length} events (with affiliate tracking)`);
    } else {
      console.log(`  ✗ Ticketmaster: ${tmData.reason}`);
    }

    // Process SeatGeek data
    if (sgData.status === 'fulfilled') {
      const { events: sgEvents, venues: sgVenues, seatgeekId, artistInfo } = sgData.value;
      allEvents.push(...sgEvents.map(e => ({ ...e, artistId })));
      allVenues.push(...sgVenues);
      if (seatgeekId) updates.seatgeekId = seatgeekId.toString();
      // Only update image/genre from SeatGeek if we don't have it from Ticketmaster
      if (artistInfo?.imageUrl && !updates.imageUrl) updates.imageUrl = artistInfo.imageUrl;
      if (artistInfo?.genre && !updates.genre) updates.genre = artistInfo.genre;
      console.log(`  ✓ SeatGeek: ${sgEvents.length} events`);
    } else {
      console.log(`  ✗ SeatGeek: ${sgData.reason}`);
    }

    // Update artist with external IDs, image, and genre (even if no events)
    if (Object.keys(updates).length > 0) {
      await db.update(artists)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(artists.id, artistId));
    }

    if (allVenues.length === 0 && allEvents.length === 0) {
      console.log(`  ⚠️  No events found`);
      return;
    }

    // Upsert venues
    if (allVenues.length > 0) {
      await db.insert(venues)
        .values(allVenues)
        .onConflictDoUpdate({
          target: venues.id,
          set: {
            name: venues.name,
            city: venues.city,
            updatedAt: new Date(),
          },
        });
      console.log(`  ✓ Stored ${allVenues.length} venues`);
    }

    // Upsert events
    if (allEvents.length > 0) {
      await db.insert(events)
        .values(allEvents)
        .onConflictDoUpdate({
          target: events.id,
          set: {
            name: events.name,
            eventDate: events.eventDate,
            status: events.status,
            ticketUrl: events.ticketUrl,
            minPrice: events.minPrice,
            maxPrice: events.maxPrice,
            currency: events.currency,
            metadata: events.metadata,
            updatedAt: new Date(),
          },
        });
      console.log(`  ✓ Stored ${allEvents.length} events`);
    }

  } catch (error) {
    console.error(`  ❌ Error fetching tours for ${artistName}:`, error);
  }
}

async function main() {
  console.log('🚀 Starting tour data fetch...\n');

  // Get all active artists
  const allArtists = await db.select().from(artists).where(eq(artists.isActive, true));

  console.log(`Found ${allArtists.length} active artists\n`);

  // Process artists sequentially to avoid rate limits
  for (const artist of allArtists) {
    await fetchToursForArtist(artist.id, artist.name);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n✅ Tour data fetch completed!');
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
