import { db } from '@/db';
import { events, venues, eventArtists } from '@/db/schema';
import { eq, sql, inArray, and, or, isNull } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { clusterVenues } from './venue-cluster';
import { resolveCityLocations, type CityLocation } from './city-locations';

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

/**
 * Keyed by canonical cluster slug (lib/venue-cluster.ts), so duplicate records
 * of the same physical venue ("BC Place" / "BC Place Stadium") roll up into ONE
 * sitemap entry — matching the venue page, which 308s non-canonical member
 * slugs to the canonical one. Counts aggregate across cluster members; summing
 * per-member distinct event ids is safe because an event id belongs to exactly
 * one venue row.
 */
export async function getAllVenueIndexCounts(now: Date = new Date()): Promise<Map<string, IndexCounts & { name: string }>> {
  const [countRows, venueRows] = await Promise.all([
    db
      .select({
        venueId: events.venueId,
        lifetime: sql<number>`count(distinct ${events.id})::int`,
        upcoming: sql<number>`count(distinct ${events.id}) filter (where ${upcomingFilter(now)})::int`,
      })
      .from(events)
      .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
      .groupBy(events.venueId),
    // Same venue + weight query the venue page's getVenueBySlug runs, so both
    // sides pick the same canonical member for every cluster.
    db
      .select({
        venue: venues,
        weight: sql<number>`count(${events.id}) filter (where ${upcomingFilter(now)})::int`,
      })
      .from(venues)
      .leftJoin(events, eq(events.venueId, venues.id))
      .groupBy(venues.id),
  ]);

  const countsById = new Map(countRows.filter((r) => r.venueId).map((r) => [r.venueId!, r]));
  const weights = new Map(venueRows.map((r) => [r.venue.id, r.weight]));
  const clusters = clusterVenues(venueRows.map((r) => r.venue), (id) => weights.get(id) ?? 0);

  const bySlug = new Map<string, IndexCounts & { name: string }>();
  for (const r of venueRows) {
    const counts = countsById.get(r.venue.id);
    if (!counts) continue;
    const cluster = clusters.get(r.venue.id)!;
    const cur = bySlug.get(cluster.canonicalSlug);
    if (cur) {
      cur.lifetime += counts.lifetime;
      cur.upcoming += counts.upcoming;
    } else {
      bySlug.set(cluster.canonicalSlug, {
        lifetime: counts.lifetime,
        upcoming: counts.upcoming,
        name: cluster.canonicalName,
      });
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

/**
 * Per-(city, state, country) artist-linked event counts — the shared dominance
 * measure for slug-collision resolution (lib/city-locations.ts). Used by the
 * bulk rollup below, the city page's location resolution, and the consistency
 * checker, so all three always pick the same dominant location per slug.
 */
export async function getCityLocationCountRows(now: Date = new Date()) {
  return db
    .select({
      city: venues.city,
      state: venues.state,
      country: venues.country,
      lifetime: sql<number>`count(distinct ${events.id})::int`,
      upcoming: sql<number>`count(distinct ${events.id}) filter (where ${upcomingFilter(now)})::int`,
    })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .where(sql`${venues.city} is not null`)
    .groupBy(venues.city, venues.state, venues.country);
}

/**
 * Keyed by slugified city name. Counts cover only the slug's DOMINANT physical
 * location (Portland OR, not Portland ME) — matching what the page renders.
 * Same-city spelling/format variants (Toronto ON/CA + ON/Canada) still merge.
 */
export async function getAllCityIndexCounts(now: Date = new Date()): Promise<Map<string, IndexCounts>> {
  const rows = await getCityLocationCountRows(now);
  const locations = resolveCityLocations(rows.map((r) => ({ ...r, city: r.city! })));

  const bySlug = new Map<string, IndexCounts>();
  for (const [slug, locs] of locations) {
    bySlug.set(slug, { lifetime: locs[0].lifetime, upcoming: locs[0].upcoming });
  }
  return bySlug;
}

/** Drizzle filter matching venues belonging to one resolved city location. */
export function cityLocationWhere(loc: Pick<CityLocation, 'cityNames' | 'states' | 'countries'>): SQL {
  const nullableIn = (column: typeof venues.state | typeof venues.country, values: (string | null)[]) => {
    const present = [...new Set(values.filter((v): v is string => v !== null))];
    const hasNull = values.some((v) => v === null);
    if (!hasNull) return inArray(column, present);
    if (present.length === 0) return isNull(column);
    return or(isNull(column), inArray(column, present))!;
  };
  return and(
    inArray(venues.city, loc.cityNames),
    nullableIn(venues.state, loc.states),
    nullableIn(venues.country, loc.countries)
  )!;
}

/** Counts for one resolved city location (what getCityInfo returned), matching
 *  the bulk dominant-location rollup above. */
export async function getCityIndexCounts(
  loc: Pick<CityLocation, 'cityNames' | 'states' | 'countries'>,
  now: Date = new Date()
): Promise<IndexCounts> {
  if (loc.cityNames.length === 0) return { lifetime: 0, upcoming: 0 };
  const rows = await db
    .select({
      lifetime: sql<number>`count(distinct ${events.id})::int`,
      upcoming: sql<number>`count(distinct ${events.id}) filter (where ${upcomingFilter(now)})::int`,
    })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .where(cityLocationWhere(loc));

  return rows[0] ?? { lifetime: 0, upcoming: 0 };
}
