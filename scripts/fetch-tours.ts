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
// Groups by city + date, and also catches events that span a UTC date boundary
// (e.g., a 11 PM EDT event is Oct 2 UTC but should dedup with Oct 1 events in the same city)
function deduplicateEvents(eventList: NewEvent[], venueList: { id: string; city?: string | null; name?: string }[]): NewEvent[] {
  const groups = new Map<string, NewEvent[]>();

  // Build venue lookups for cross-source matching
  const venueIdToCity = new Map<string, string>();
  const venueIdToName = new Map<string, string>();
  for (const v of venueList) {
    if (v.city) venueIdToCity.set(v.id, v.city.toLowerCase());
    if (v.name) venueIdToName.set(v.id, v.name.toLowerCase());
  }

  for (const event of eventList) {
    const eventDate = event.eventDate instanceof Date
      ? event.eventDate
      : new Date(event.eventDate);
    const dateKey = eventDate.toISOString().slice(0, 10);
    const city = (event.venueId && venueIdToCity.get(event.venueId)) || 'unknown';
    const key = `${city}_${dateKey}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }

  // Second pass: merge groups that are likely the same event but ended up on adjacent
  // UTC dates (e.g., late-night local time crossing midnight in UTC)
  const keys = Array.from(groups.keys());
  for (const key of keys) {
    const [city, dateStr] = key.split('_');
    const prevDate = new Date(dateStr + 'T00:00:00Z');
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const prevKey = `${city}_${prevDate.toISOString().slice(0, 10)}`;

    if (groups.has(prevKey) && groups.has(key)) {
      const prevGroup = groups.get(prevKey)!;
      const curGroup = groups.get(key)!;

      // Check if adjacent-day events are actually the same concert
      // (different sources, same city, times within 6 hours of each other)
      const shouldMerge = curGroup.some(cur =>
        prevGroup.some(prev => {
          if (cur.source === prev.source) return false; // Same source won't duplicate
          const curTime = (cur.eventDate instanceof Date ? cur.eventDate : new Date(cur.eventDate)).getTime();
          const prevTime = (prev.eventDate instanceof Date ? prev.eventDate : new Date(prev.eventDate)).getTime();
          return Math.abs(curTime - prevTime) < 6 * 60 * 60 * 1000; // Within 6 hours
        })
      );

      if (shouldMerge) {
        prevGroup.push(...curGroup);
        groups.delete(key);
      }
    }
  }

  const deduped: NewEvent[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }
    // Prefer the main event (non-package), then prefer ticketmaster as primary source
    const mainEvent =
      group.find(e => !isPackage(e.name) && e.source === 'ticketmaster') ||
      group.find(e => !isPackage(e.name)) ||
      group[0];
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
