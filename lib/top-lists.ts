import { db } from '@/db';
import { artists, events, venues, eventArtists } from '@/db/schema';
import { and, eq, gte, lt, inArray, sql } from 'drizzle-orm';
import { slugify } from './slugify';
import { clusterVenues } from './venue-cluster';
import { getAllFestivals } from './festivals';

/**
 * "Top" lists that headline the concerts / tours / venues / festivals index pages.
 *
 * Each list ranks a DIFFERENT unit on a DIFFERENT signal so it adds information
 * the grid below it doesn't already make obvious:
 *   - Top Tours    -> artists, by number of upcoming dates ("who's touring hardest")
 *   - Top Concerts -> individual shows, by the headliner's overall tour size
 *   - Top Venues   -> venues nationwide, by upcoming show count ("busiest rooms")
 *   - Top Festivals-> festivals, by lineup size ("biggest lineups")
 *
 * All four are bounded to a rolling window (default 60 days) so the lists stay
 * fresh and a show a year out can't outrank everything.
 */

export const TOP_WINDOW_DAYS = 60;
export const TOP_LIMIT = 5;

function windowEnd(from: Date, days: number): Date {
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  return to;
}

export interface TopTour {
  name: string;
  slug: string;
  genre: string | null;
  dateCount: number;
}

/** Artists with the most upcoming dates in the window. */
export async function getTopTours(limit = TOP_LIMIT, windowDays = TOP_WINDOW_DAYS): Promise<TopTour[]> {
  const now = new Date();
  const until = windowEnd(now, windowDays);

  const rows = await db
    .select({
      name: artists.name,
      slug: artists.slug,
      genre: artists.genre,
      dateCount: sql<number>`count(*)::int`,
    })
    .from(eventArtists)
    .innerJoin(events, eq(events.id, eventArtists.eventId))
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .where(and(gte(events.eventDate, now), lt(events.eventDate, until), eq(artists.isActive, true)))
    .groupBy(artists.name, artists.slug, artists.genre)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows;
}

export interface TopConcert {
  artistName: string;
  artistSlug: string;
  /** The headlining artist's total number of upcoming dates (tour size). */
  tourDates: number;
  venueName: string | null;
  location: string | null;
  eventDate: Date;
  formattedDate: string;
}

/**
 * Marquee shows in the window, one per artist, ranked by the headliner's total
 * upcoming tour size. We rank artists by how many dates they have on the road
 * (all upcoming, a proxy for "big touring act" since we store no popularity
 * score), then surface each top artist's soonest show inside the window. Deduping
 * by artist keeps one act from filling all five slots with their own dates.
 */
export async function getTopConcerts(limit = TOP_LIMIT, windowDays = TOP_WINDOW_DAYS): Promise<TopConcert[]> {
  const now = new Date();
  const until = windowEnd(now, windowDays);

  // Rank artists by TOTAL upcoming dates (tour size), not just the window — a big
  // tour is a big tour even if only one of its dates lands in the next 60 days.
  const ranked = await db
    .select({
      id: artists.id,
      name: artists.name,
      slug: artists.slug,
      tourDates: sql<number>`count(*)::int`,
    })
    .from(eventArtists)
    .innerJoin(events, eq(events.id, eventArtists.eventId))
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .where(and(gte(events.eventDate, now), eq(artists.isActive, true)))
    .groupBy(artists.id, artists.name, artists.slug)
    .orderBy(sql`count(*) desc`)
    .limit(limit * 8);

  if (ranked.length === 0) return [];

  const tourDatesById = new Map(ranked.map((a) => [a.id, a.tourDates]));
  const artistIds = ranked.map((a) => a.id);

  // Pull every in-window show for the ranked artists, earliest first, then keep
  // each artist's soonest one.
  const shows = await db
    .select({
      artistId: eventArtists.artistId,
      eventDate: events.eventDate,
      venueName: venues.name,
      city: venues.city,
      state: venues.state,
    })
    .from(eventArtists)
    .innerJoin(events, eq(events.id, eventArtists.eventId))
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(and(inArray(eventArtists.artistId, artistIds), gte(events.eventDate, now), lt(events.eventDate, until)))
    .orderBy(events.eventDate);

  const soonestByArtist = new Map<string, (typeof shows)[number]>();
  for (const show of shows) {
    if (!soonestByArtist.has(show.artistId)) soonestByArtist.set(show.artistId, show);
  }

  const result: TopConcert[] = [];
  for (const artist of ranked) {
    const show = soonestByArtist.get(artist.id);
    if (!show) continue; // ranked artist has no date inside the window
    const locationParts = [show.city, show.state].filter(Boolean) as string[];
    result.push({
      artistName: artist.name,
      artistSlug: artist.slug,
      tourDates: tourDatesById.get(artist.id) ?? 0,
      venueName: show.venueName,
      location: locationParts.length ? locationParts.join(', ') : null,
      eventDate: show.eventDate,
      formattedDate: show.eventDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    });
    if (result.length >= limit) break;
  }

  return result;
}

export interface TopVenue {
  name: string;
  slug: string;
  location: string | null;
  showCount: number;
}

/** Busiest venues nationwide by upcoming show count in the window. */
export async function getTopVenues(limit = TOP_LIMIT, windowDays = TOP_WINDOW_DAYS): Promise<TopVenue[]> {
  const now = new Date();
  const until = windowEnd(now, windowDays);

  const venueRows = await db
    .select({
      id: venues.id,
      name: venues.name,
      city: venues.city,
      state: venues.state,
      latitude: venues.latitude,
      longitude: venues.longitude,
      eventCount: sql<number>`count(*)::int`,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(and(gte(events.eventDate, now), lt(events.eventDate, until)))
    .groupBy(venues.id, venues.name, venues.city, venues.state, venues.latitude, venues.longitude);

  // Collapse duplicate venue records (same place from TM + SG) into one card,
  // matching how the /venues grid counts shows.
  const counts = new Map(venueRows.map((v) => [v.id, v.eventCount]));
  const clusters = clusterVenues(venueRows, (id) => counts.get(id) ?? 0);
  const byCanonical = new Map<string, { name: string; city: string | null; state: string | null; showCount: number }>();
  for (const v of venueRows) {
    const cluster = clusters.get(v.id)!;
    let agg = byCanonical.get(cluster.canonicalId);
    if (!agg) {
      const canon = venueRows.find((r) => r.id === cluster.canonicalId)!;
      agg = { name: cluster.canonicalName, city: canon.city, state: canon.state, showCount: 0 };
      byCanonical.set(cluster.canonicalId, agg);
    }
    agg.showCount += v.eventCount;
  }

  return Array.from(byCanonical.values())
    .sort((a, b) => b.showCount - a.showCount)
    .slice(0, limit)
    .map((v) => {
      const locationParts = [v.city, v.state].filter(Boolean) as string[];
      return {
        name: v.name,
        slug: slugify(v.name),
        location: locationParts.length ? locationParts.join(', ') : null,
        showCount: v.showCount,
      };
    });
}

export interface TopFestival {
  name: string;
  slug: string;
  location: string | null;
  formattedDateRange: string;
  artistCount: number;
}

/** Festivals starting within the window, ranked by lineup size. */
export async function getTopFestivals(limit = TOP_LIMIT, windowDays = TOP_WINDOW_DAYS): Promise<TopFestival[]> {
  const now = new Date();
  const untilKey = windowEnd(now, windowDays).toISOString().slice(0, 10);

  const festivals = await getAllFestivals();

  return festivals
    .filter((f) => f.date <= untilKey)
    .sort((a, b) => b.artistCount - a.artistCount)
    .slice(0, limit)
    .map((f) => {
      const locationParts = [f.venue.city, f.venue.state].filter(Boolean) as string[];
      return {
        name: f.name,
        slug: f.slug,
        location: locationParts.length ? locationParts.join(', ') : null,
        formattedDateRange: f.formattedDateRange,
        artistCount: f.artistCount,
      };
    });
}
