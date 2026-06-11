import { db } from '@/db';
import { events, venues, eventArtists } from '@/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import { slugify } from './slugify';

/**
 * Canonical event counts used for indexing decisions.
 *
 * The sitemap filter (app/sitemap.ts) and the per-page noindex decisions
 * (artist/venue/city generateMetadata) MUST use the same counts, or pages end
 * up noindexed while still listed in sitemap.xml — Ahrefs flagged ~322 such
 * URLs on 2026-06-09. The old code counted raw event_artists rows in the
 * sitemap but deduplicated rows on the pages, so any show listed by both
 * Ticketmaster and SeatGeek passed the sitemap threshold while failing the
 * page threshold.
 *
 * Definitions (mirroring what each page actually renders):
 *   - Artist:  distinct (venue city, calendar date) — one "show" regardless of
 *              how many sources list it. Matches the artist page's city+date
 *              event grouping.
 *   - Venue:   distinct artist-linked event ids across all venue rows sharing
 *              a slugified name. Matches getVenueEvents' per-event-id grouping
 *              (inner join to event_artists, so artistless rows don't count).
 *   - City:    distinct artist-linked event ids across all city spellings
 *              sharing a slugified name.
 *
 * Bulk variants feed the sitemap; per-entity variants feed generateMetadata.
 * Both run the same SQL expressions so the two can never disagree (beyond the
 * ISR window between their renders).
 */

export interface IndexCounts {
  lifetime: number;
  upcoming: number;
}

const artistDistinctShow = sql`(coalesce(${venues.city}, ''), ${events.eventDate}::date)`;

function upcomingFilter(now: Date) {
  return sql`${events.eventDate} >= ${now.toISOString()}`;
}

// ---- Artists ----

export async function getAllArtistIndexCounts(now: Date = new Date()): Promise<Map<string, IndexCounts>> {
  const rows = await db
    .select({
      artistId: eventArtists.artistId,
      lifetime: sql<number>`count(distinct ${artistDistinctShow})::int`,
      upcoming: sql<number>`count(distinct ${artistDistinctShow}) filter (where ${upcomingFilter(now)})::int`,
    })
    .from(eventArtists)
    .innerJoin(events, eq(events.id, eventArtists.eventId))
    .leftJoin(venues, eq(venues.id, events.venueId))
    .groupBy(eventArtists.artistId);

  return new Map(rows.map((r) => [r.artistId, { lifetime: r.lifetime, upcoming: r.upcoming }]));
}

export async function getArtistIndexCounts(artistId: string, now: Date = new Date()): Promise<IndexCounts> {
  const rows = await db
    .select({
      lifetime: sql<number>`count(distinct ${artistDistinctShow})::int`,
      upcoming: sql<number>`count(distinct ${artistDistinctShow}) filter (where ${upcomingFilter(now)})::int`,
    })
    .from(eventArtists)
    .innerJoin(events, eq(events.id, eventArtists.eventId))
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(eq(eventArtists.artistId, artistId));

  return rows[0] ?? { lifetime: 0, upcoming: 0 };
}

// ---- Venues ----

/** Keyed by slugified venue name; same-name rows from different sources merge. */
export async function getAllVenueIndexCounts(now: Date = new Date()): Promise<Map<string, IndexCounts & { name: string }>> {
  const rows = await db
    .select({
      venueName: venues.name,
      lifetime: sql<number>`count(distinct ${events.id})::int`,
      upcoming: sql<number>`count(distinct ${events.id}) filter (where ${upcomingFilter(now)})::int`,
    })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .groupBy(venues.name);

  const bySlug = new Map<string, IndexCounts & { name: string }>();
  for (const r of rows) {
    if (!r.venueName) continue;
    const slug = slugify(r.venueName);
    const cur = bySlug.get(slug);
    if (cur) {
      cur.lifetime += r.lifetime;
      cur.upcoming += r.upcoming;
    } else {
      bySlug.set(slug, { lifetime: r.lifetime, upcoming: r.upcoming, name: r.venueName });
    }
  }
  return bySlug;
}

/** venueIds must be every venue row whose slugified name matches the page slug
 *  (what getVenueBySlug already returns) so this matches the bulk slug rollup. */
export async function getVenueIndexCounts(venueIds: string[], now: Date = new Date()): Promise<IndexCounts> {
  if (venueIds.length === 0) return { lifetime: 0, upcoming: 0 };
  const rows = await db
    .select({
      lifetime: sql<number>`count(distinct ${events.id})::int`,
      upcoming: sql<number>`count(distinct ${events.id}) filter (where ${upcomingFilter(now)})::int`,
    })
    .from(events)
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .where(inArray(events.venueId, venueIds));

  return rows[0] ?? { lifetime: 0, upcoming: 0 };
}

// ---- Cities ----

/** Keyed by slugified city name; same-slug spellings merge. */
export async function getAllCityIndexCounts(now: Date = new Date()): Promise<Map<string, IndexCounts>> {
  const rows = await db
    .select({
      city: venues.city,
      lifetime: sql<number>`count(distinct ${events.id})::int`,
      upcoming: sql<number>`count(distinct ${events.id}) filter (where ${upcomingFilter(now)})::int`,
    })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .where(sql`${venues.city} is not null`)
    .groupBy(venues.city);

  const bySlug = new Map<string, IndexCounts>();
  for (const r of rows) {
    if (!r.city) continue;
    const slug = slugify(r.city);
    const cur = bySlug.get(slug) ?? { lifetime: 0, upcoming: 0 };
    cur.lifetime += r.lifetime;
    cur.upcoming += r.upcoming;
    bySlug.set(slug, cur);
  }
  return bySlug;
}

/** cityNames must be every distinct spelling whose slugified form matches the
 *  page slug so this matches the bulk slug rollup. */
export async function getCityIndexCounts(cityNames: string[], now: Date = new Date()): Promise<IndexCounts> {
  if (cityNames.length === 0) return { lifetime: 0, upcoming: 0 };
  const rows = await db
    .select({
      lifetime: sql<number>`count(distinct ${events.id})::int`,
      upcoming: sql<number>`count(distinct ${events.id}) filter (where ${upcomingFilter(now)})::int`,
    })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .where(inArray(venues.city, cityNames));

  return rows[0] ?? { lifetime: 0, upcoming: 0 };
}
