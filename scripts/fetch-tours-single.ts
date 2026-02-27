import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as ticketmaster from '@/lib/ticketmaster';
import * as seatgeek from '@/lib/seatgeek';
import { getTicketmasterAffiliateUrl } from '@/lib/affiliate';
import type { NewEvent } from '@/db/schema';

const PACKAGE_KEYWORDS = [
  'vip', 'package', 'upgrade', 'comfort seat', 'lounge', 'meet & greet',
  'meet and greet', 'premium', 'platinum', 'gold circle', 'early entry',
  'soundcheck', 'vinyl room', 'hospitality', 'suite', 'box seat',
  'excluding concert ticket', 'hot ticket', 'upsell',
];

function isPackageVariant(eventName: string): boolean {
  const lower = eventName.toLowerCase();
  return PACKAGE_KEYWORDS.some(kw => lower.includes(kw));
}

function deduplicateEvents(eventList: NewEvent[], venueList: { id: string; city?: string | null }[]): NewEvent[] {
  const groups = new Map<string, NewEvent[]>();
  const venueIdToCity = new Map<string, string>();
  for (const v of venueList) {
    if (v.city) venueIdToCity.set(v.id, v.city.toLowerCase());
  }

  for (const event of eventList) {
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
    if (group.length === 1) { deduped.push(group[0]); continue; }
    const mainEvent = group.find(e => !isPackageVariant(e.name)) || group[0];
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

  if (tmData.status === 'fulfilled') {
    const { events: tmEvents, venues: tmVenues, ticketmasterId, artistInfo } = tmData.value;
    const tmEventsWithAffiliate = tmEvents.map(e => ({
      ...e, artistId: artist.id,
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
    allEvents.push(...sgEvents.map(e => ({ ...e, artistId: artist.id })));
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
  }

  console.log('Done!');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
