import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events, eventArtists, venues } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import * as ticketmaster from '@/lib/ticketmaster';
import * as seatgeek from '@/lib/seatgeek';
import { getTicketmasterAffiliateUrl } from '@/lib/affiliate';
import { isPackage } from '@/lib/event-utils';
import { slugify } from '@/lib/slugify';
import { nanoid } from 'nanoid';
import type { FestivalLineup } from '@/lib/ticketmaster';
import type { NewEvent } from '@/db/schema';

function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .replace(/\bst\.?\s/g, 'saint ')
    .replace(/\bft\.?\s/g, 'fort ')
    .replace(/\bmt\.?\s/g, 'mount ')
    .replace(/\bn\.\s/g, 'north ')
    .replace(/\bs\.\s/g, 'south ')
    .replace(/\be\.\s/g, 'east ')
    .replace(/\bw\.\s/g, 'west ')
    .trim();
}

function deduplicateEvents(eventList: NewEvent[], venueList: { id: string; city?: string | null }[]): NewEvent[] {
  const groups = new Map<string, NewEvent[]>();
  const venueIdToCity = new Map<string, string>();
  for (const v of venueList) {
    if (v.city) venueIdToCity.set(v.id, normalizeCity(v.city));
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

  // Merge adjacent-day groups that are likely the same concert from different sources
  const keys = Array.from(groups.keys());
  for (const key of keys) {
    const [city, dateStr] = key.split('_');
    const prevDate = new Date(dateStr + 'T00:00:00Z');
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const prevKey = `${city}_${prevDate.toISOString().slice(0, 10)}`;

    if (groups.has(prevKey) && groups.has(key)) {
      const prevGroup = groups.get(prevKey)!;
      const curGroup = groups.get(key)!;
      const shouldMerge = curGroup.some(cur =>
        prevGroup.some(prev => {
          if (cur.source === prev.source) return false;
          const curTime = (cur.eventDate instanceof Date ? cur.eventDate : new Date(cur.eventDate)).getTime();
          const prevTime = (prev.eventDate instanceof Date ? prev.eventDate : new Date(prev.eventDate)).getTime();
          return Math.abs(curTime - prevTime) < 6 * 60 * 60 * 1000;
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
    if (group.length === 1) { deduped.push(group[0]); continue; }
    const mainEvent =
      group.find(e => !isPackage(e.name) && e.source === 'ticketmaster') ||
      group.find(e => !isPackage(e.name)) ||
      group[0];
    deduped.push(mainEvent);
  }
  return deduped;
}

const slug = process.argv[2];
if (!slug) { console.error('Usage: tsx scripts/fetch-tours-single.ts <artist-slug>'); process.exit(1); }

async function main() {
  const artist = await db.query.artists.findFirst({ where: eq(artists.slug, slug) });
  if (!artist) { console.error(`Artist "${slug}" not found`); process.exit(1); }

  console.log(`Fetching tours for: ${artist.name}`);

  const [tmData, sgData] = await Promise.allSettled([
    ticketmaster.searchArtistEvents(artist.name),
    seatgeek.searchArtistEvents(artist.name),
  ]);

  const allEvents: NewEvent[] = [];
  const allVenues: any[] = [];
  const updates: any = {};

  let festivalLineups: FestivalLineup[] | undefined;

  if (tmData.status === 'fulfilled') {
    const { events: tmEvents, venues: tmVenues, ticketmasterId, artistInfo, festivalLineups: lineups } = tmData.value;
    festivalLineups = lineups;
    const tmEventsWithAffiliate = tmEvents.map(e => ({
      ...e,
      ticketUrl: e.ticketUrl ? getTicketmasterAffiliateUrl(e.ticketUrl) : e.ticketUrl,
    }));
    allEvents.push(...tmEventsWithAffiliate);
    allVenues.push(...tmVenues);
    if (ticketmasterId) updates.ticketmasterId = ticketmasterId;
    if (artistInfo?.imageUrl) updates.imageUrl = artistInfo.imageUrl;
    if (artistInfo?.genre) updates.genre = artistInfo.genre;
    console.log(`  Ticketmaster: ${tmEvents.length} events`);
  } else { console.log(`  Ticketmaster: ${tmData.reason}`); }

  if (sgData.status === 'fulfilled') {
    const { events: sgEvents, venues: sgVenues, seatgeekId, artistInfo } = sgData.value;
    allEvents.push(...sgEvents.map(e => ({ ...e })));
    allVenues.push(...sgVenues);
    if (seatgeekId) updates.seatgeekId = seatgeekId.toString();
    if (artistInfo?.imageUrl && !updates.imageUrl) updates.imageUrl = artistInfo.imageUrl;
    if (artistInfo?.genre && !updates.genre) updates.genre = artistInfo.genre;
    console.log(`  SeatGeek: ${sgEvents.length} events`);
  } else { console.log(`  SeatGeek: ${sgData.reason}`); }

  if (Object.keys(updates).length > 0) {
    await db.update(artists).set({ ...updates, updatedAt: new Date() }).where(eq(artists.id, artist.id));
  }

  if (allVenues.length > 0) {
    await db.insert(venues).values(allVenues).onConflictDoUpdate({
      target: venues.id, set: { name: venues.name, city: venues.city, updatedAt: new Date() },
    });
    console.log(`  Stored ${allVenues.length} venues`);
  }

  const dedupedEvents = deduplicateEvents(allEvents, allVenues);
  if (dedupedEvents.length < allEvents.length) {
    console.log(`  Deduped: ${allEvents.length} -> ${dedupedEvents.length} events`);
  }

  if (dedupedEvents.length > 0) {
    await db.insert(events).values(dedupedEvents).onConflictDoUpdate({
      target: events.id,
      set: { name: events.name, eventDate: events.eventDate, status: events.status, ticketUrl: events.ticketUrl,
        minPrice: events.minPrice, maxPrice: events.maxPrice, currency: events.currency, metadata: events.metadata, updatedAt: new Date() },
    });
    console.log(`  Stored ${dedupedEvents.length} events`);

    // Upsert event_artists junction rows for this artist
    await db.insert(eventArtists)
      .values(dedupedEvents.map(e => ({ eventId: e.id, artistId: artist.id })))
      .onConflictDoNothing();
  }

  // Process festival lineups
  if (festivalLineups && festivalLineups.length > 0) {
    console.log(`  🎪 Found ${festivalLineups.length} festival event(s), processing lineups...`);
    let importedArtists = 0;
    let importedEvents = 0;

    for (const lineup of festivalLineups) {
      const sourceEvent = dedupedEvents.find(e => e.externalId === lineup.eventId);
      if (!sourceEvent) continue;

      for (const attraction of lineup.attractions) {
        const attrSlug = slugify(attraction.name);
        const existing = await db.query.artists.findFirst({
          where: or(eq(artists.ticketmasterId, attraction.id), eq(artists.slug, attrSlug)),
        });

        let attrArtistId: string;
        if (existing) {
          attrArtistId = existing.id;
          if (!existing.ticketmasterId) {
            await db.update(artists).set({ ticketmasterId: attraction.id, updatedAt: new Date() }).where(eq(artists.id, existing.id));
          }
        } else {
          attrArtistId = nanoid();
          try {
            await db.insert(artists).values({
              id: attrArtistId, slug: attrSlug, name: attraction.name,
              imageUrl: attraction.imageUrl || null, genre: attraction.genre || null,
              ticketmasterId: attraction.id, isActive: true,
            });
            importedArtists++;
            console.log(`    🎤 Imported festival artist: ${attraction.name}`);
          } catch (err: any) {
            if (err.code === '23505') {
              const bySlug = await db.query.artists.findFirst({ where: eq(artists.slug, attrSlug) });
              if (bySlug) attrArtistId = bySlug.id; else continue;
            } else continue;
          }
        }

        const eventId = `tm-${lineup.eventId}-${attraction.id}`;
        try {
          await db.insert(events).values({
            id: eventId, venueId: sourceEvent.venueId,
            name: sourceEvent.name, eventDate: sourceEvent.eventDate,
            status: sourceEvent.status || 'scheduled', ticketUrl: sourceEvent.ticketUrl,
            minPrice: sourceEvent.minPrice, maxPrice: sourceEvent.maxPrice,
            currency: sourceEvent.currency, source: 'ticketmaster',
            externalId: `${lineup.eventId}-${attraction.id}`, metadata: null,
          }).onConflictDoUpdate({
            target: events.id,
            set: { name: sourceEvent.name, eventDate: sourceEvent.eventDate, ticketUrl: sourceEvent.ticketUrl, updatedAt: new Date() },
          });
          await db.insert(eventArtists)
            .values({ eventId, artistId: attrArtistId })
            .onConflictDoNothing();
          importedEvents++;
        } catch { /* skip */ }
      }
    }
    if (importedArtists > 0 || importedEvents > 0) {
      console.log(`  🎪 Festival lineup: imported ${importedArtists} new artists, ${importedEvents} events`);
    }
  }

  console.log('Done!');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
