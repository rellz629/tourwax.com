import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import * as ticketmaster from '@/lib/ticketmaster';
import * as seatgeek from '@/lib/seatgeek';

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
    const updates: { ticketmasterId?: string; seatgeekId?: string } = {};

    // Process Ticketmaster data
    if (tmData.status === 'fulfilled') {
      const { events: tmEvents, venues: tmVenues, ticketmasterId } = tmData.value;
      allEvents.push(...tmEvents.map(e => ({ ...e, artistId })));
      allVenues.push(...tmVenues);
      if (ticketmasterId) updates.ticketmasterId = ticketmasterId;
      console.log(`  ✓ Ticketmaster: ${tmEvents.length} events`);
    } else {
      console.log(`  ✗ Ticketmaster: ${tmData.reason}`);
    }

    // Process SeatGeek data
    if (sgData.status === 'fulfilled') {
      const { events: sgEvents, venues: sgVenues, seatgeekId } = sgData.value;
      allEvents.push(...sgEvents.map(e => ({ ...e, artistId })));
      allVenues.push(...sgVenues);
      if (seatgeekId) updates.seatgeekId = seatgeekId.toString();
      console.log(`  ✓ SeatGeek: ${sgEvents.length} events`);
    } else {
      console.log(`  ✗ SeatGeek: ${sgData.reason}`);
    }

    if (allVenues.length === 0 && allEvents.length === 0) {
      console.log(`  ⚠️  No events found`);
      return;
    }

    // Update artist with external IDs
    if (Object.keys(updates).length > 0) {
      await db.update(artists)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(artists.id, artistId));
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

    // Delete old events for this artist to avoid duplicates
    await db.delete(events).where(eq(events.artistId, artistId));

    // Insert new events
    if (allEvents.length > 0) {
      await db.insert(events).values(allEvents);
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
