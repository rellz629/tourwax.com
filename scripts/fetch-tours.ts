import { config } from 'dotenv';
// Load .env.local BEFORE any other imports
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as ticketmaster from '@/lib/ticketmaster';
import * as seatgeek from '@/lib/seatgeek';
import { getTicketmasterAffiliateUrl } from '@/lib/affiliate';
import { isPackage } from '@/lib/event-utils';
import type { NewEvent } from '@/db/schema';

// Deduplicate events: keep only the main event per city+date, filtering out package variants
function deduplicateEvents(eventList: NewEvent[], venueList: { id: string; city?: string | null }[]): NewEvent[] {
  const groups = new Map<string, NewEvent[]>();

  // Build venue-to-city lookup for cross-source matching
  const venueIdToCity = new Map<string, string>();
  for (const v of venueList) {
    if (v.city) venueIdToCity.set(v.id, v.city.toLowerCase());
  }

  for (const event of eventList) {
    // Group by city + calendar date (catches cross-source dupes for the same venue)
    const dateKey = event.eventDate instanceof Date
      ? event.eventDate.toISOString().slice(0, 10)
      : new Date(event.eventDate).toISOString().slice(0, 10);
    const city = (event.venueId && venueIdToCity.get(event.venueId)) || 'unknown';
    const key = `${city}_${dateKey}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }

  const deduped: NewEvent[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }
    // Prefer the main event (non-package), or fallback to the first one
    const mainEvent = group.find(e => !isPackage(e.name)) || group[0];
    deduped.push(mainEvent);
  }

  return deduped;
}

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

    // Deduplicate events (remove VIP/package variants and cross-source dupes)
    const dedupedEvents = deduplicateEvents(allEvents, allVenues);
    if (dedupedEvents.length < allEvents.length) {
      console.log(`  🔄 Deduped: ${allEvents.length} → ${dedupedEvents.length} events (removed ${allEvents.length - dedupedEvents.length} package variants)`);
    }

    // Upsert events
    if (dedupedEvents.length > 0) {
      await db.insert(events)
        .values(dedupedEvents)
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
      console.log(`  ✓ Stored ${dedupedEvents.length} events`);
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
