import { NextResponse } from 'next/server';
import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as ticketmaster from '@/lib/ticketmaster';
import * as seatgeek from '@/lib/seatgeek';
import { getTicketmasterAffiliateUrl } from '@/lib/affiliate';
import { isPackage } from '@/lib/event-utils';
import type { NewEvent } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH_SIZE = 5;

function deduplicateEvents(eventList: NewEvent[], venueList: { id: string; city?: string | null }[]): NewEvent[] {
  const groups = new Map<string, NewEvent[]>();

  // Build venue-to-city lookup for cross-source matching
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
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }
    const mainEvent = group.find(e => !isPackage(e.name)) || group[0];
    deduped.push(mainEvent);
  }

  return deduped;
}

async function fetchToursForArtist(artistId: string, artistName: string) {
  const [tmData, sgData] = await Promise.allSettled([
    ticketmaster.searchArtistEvents(artistName),
    seatgeek.searchArtistEvents(artistName),
  ]);

  const allEvents: NewEvent[] = [];
  const allVenues: any[] = [];
  const updates: {
    ticketmasterId?: string;
    seatgeekId?: string;
    imageUrl?: string;
    genre?: string;
  } = {};

  if (tmData.status === 'fulfilled') {
    const { events: tmEvents, venues: tmVenues, ticketmasterId, artistInfo } = tmData.value;
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
  }

  if (sgData.status === 'fulfilled') {
    const { events: sgEvents, venues: sgVenues, seatgeekId, artistInfo } = sgData.value;
    allEvents.push(...sgEvents.map(e => ({ ...e, artistId })));
    allVenues.push(...sgVenues);
    if (seatgeekId) updates.seatgeekId = seatgeekId.toString();
    if (artistInfo?.imageUrl && !updates.imageUrl) updates.imageUrl = artistInfo.imageUrl;
    if (artistInfo?.genre && !updates.genre) updates.genre = artistInfo.genre;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(artists)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(artists.id, artistId));
  }

  if (allVenues.length === 0 && allEvents.length === 0) {
    return { events: 0, venues: 0 };
  }

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
  }

  const dedupedEvents = deduplicateEvents(allEvents, allVenues);

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
  }

  return { events: dedupedEvents.length, venues: allVenues.length };
}

async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const allArtists = await db.select().from(artists).where(eq(artists.isActive, true));

    const results = await processBatch(
      allArtists,
      BATCH_SIZE,
      (artist) => fetchToursForArtist(artist.id, artist.name),
    );

    let processed = 0;
    let totalEvents = 0;
    const errors: string[] = [];

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        processed++;
        totalEvents += result.value.events;
      } else {
        errors.push(`${allArtists[idx].name}: ${result.reason}`);
      }
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      processed,
      totalArtists: allArtists.length,
      eventsStored: totalEvents,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      duration: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
