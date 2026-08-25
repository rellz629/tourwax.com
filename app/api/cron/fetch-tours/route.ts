import { NextResponse } from 'next/server';
import { db } from '@/db';
import { artists, events, eventArtists, venues } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import * as ticketmaster from '@/lib/ticketmaster';
import * as seatgeek from '@/lib/seatgeek';
import { isPackage } from '@/lib/event-utils';
import { slugify } from '@/lib/slugify';
import { nanoid } from 'nanoid';
import type { FestivalLineup } from '@/lib/ticketmaster';
import type { NewEvent } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH_SIZE = 5;

function deduplicateEvents(eventList: NewEvent[], venueList: { id: string; city?: string | null }[]): NewEvent[] {
  const groups = new Map<string, NewEvent[]>();

  const venueIdToCity = new Map<string, string>();
  for (const v of venueList) {
    if (v.city) venueIdToCity.set(v.id, v.city.toLowerCase());
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

  // Merge groups on adjacent UTC dates that are likely the same concert
  // (cross-source events where late-night local time crosses midnight in UTC)
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
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }
    const mainEvent =
      group.find(e => !isPackage(e.name) && e.source === 'ticketmaster') ||
      group.find(e => !isPackage(e.name)) ||
      group[0];
    deduped.push(mainEvent);
  }

  return deduped;
}

async function processFestivalLineups(
  lineups: FestivalLineup[],
  sourceEvents: NewEvent[],
) {
  let importedArtists = 0;
  let importedEvents = 0;

  for (const lineup of lineups) {
    const sourceEvent = sourceEvents.find(e => e.externalId === lineup.eventId);
    if (!sourceEvent) continue;

    for (const attraction of lineup.attractions) {
      const slug = slugify(attraction.name);
      const existing = await db.query.artists.findFirst({
        where: or(
          eq(artists.ticketmasterId, attraction.id),
          eq(artists.slug, slug),
        ),
      });

      let artistId: string;

      if (existing) {
        artistId = existing.id;
        if (!existing.ticketmasterId) {
          await db.update(artists)
            .set({ ticketmasterId: attraction.id, updatedAt: new Date() })
            .where(eq(artists.id, existing.id));
        }
      } else {
        artistId = nanoid();
        try {
          await db.insert(artists).values({
            id: artistId,
            slug,
            name: attraction.name,
            imageUrl: attraction.imageUrl || null,
            genre: attraction.genre || null,
            ticketmasterId: attraction.id,
            isActive: true,
          });
          importedArtists++;
        } catch (err: any) {
          if (err.code === '23505') {
            const bySlug = await db.query.artists.findFirst({
              where: eq(artists.slug, slug),
            });
            if (bySlug) artistId = bySlug.id;
            else continue;
          } else {
            continue;
          }
        }
      }

      const eventId = `tm-${lineup.eventId}-${attraction.id}`;
      try {
        await db.insert(events).values({
          id: eventId,
          venueId: sourceEvent.venueId,
          name: sourceEvent.name,
          eventDate: sourceEvent.eventDate,
          status: sourceEvent.status || 'scheduled',
          ticketUrl: sourceEvent.ticketUrl,
          minPrice: sourceEvent.minPrice,
          maxPrice: sourceEvent.maxPrice,
          currency: sourceEvent.currency,
          source: 'ticketmaster',
          externalId: `${lineup.eventId}-${attraction.id}`,
          metadata: null,
        }).onConflictDoUpdate({
          target: events.id,
          set: {
            name: sourceEvent.name,
            eventDate: sourceEvent.eventDate,
            ticketUrl: sourceEvent.ticketUrl,
            updatedAt: new Date(),
          },
        });
        await db.insert(eventArtists).values({ eventId, artistId }).onConflictDoNothing();
        importedEvents++;
      } catch {
        // Skip constraint errors
      }
    }
  }

  return { importedArtists, importedEvents };
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

  let festivalLineups: FestivalLineup[] | undefined;

  if (tmData.status === 'fulfilled') {
    const { events: tmEvents, venues: tmVenues, ticketmasterId, artistInfo, festivalLineups: lineups } = tmData.value;
    festivalLineups = lineups;
    // Store plain merchant URLs; affiliate wrapping happens at render via /out
    allEvents.push(...tmEvents);
    allVenues.push(...tmVenues);
    if (ticketmasterId) updates.ticketmasterId = ticketmasterId;
    if (artistInfo?.imageUrl) updates.imageUrl = artistInfo.imageUrl;
    if (artistInfo?.genre) updates.genre = artistInfo.genre;
  }

  if (sgData.status === 'fulfilled') {
    const { events: sgEvents, venues: sgVenues, seatgeekId, artistInfo } = sgData.value;
    allEvents.push(...sgEvents.map(e => ({ ...e })));
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
    await db.insert(eventArtists)
      .values(dedupedEvents.map(e => ({ eventId: e.id, artistId })))
      .onConflictDoNothing();
  }

  // Process festival lineups
  let festivalEvents = 0;
  if (festivalLineups && festivalLineups.length > 0) {
    const result = await processFestivalLineups(festivalLineups, dedupedEvents);
    festivalEvents = result.importedEvents;
  }

  return { events: dedupedEvents.length + festivalEvents, venues: allVenues.length };
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
