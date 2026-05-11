import { db } from '@/db';
import { artists, events, venues, eventArtists } from '@/db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { slugify } from './slugify';

const DATE_SUFFIX_RE = /-(\d{4}-\d{2}-\d{2})$/;

/**
 * Attempt to map an unknown festival slug to a useful destination. Used when a
 * festival slug no longer resolves (false positive cleaned up, source data
 * removed, etc.). Returns null if no sensible destination can be found.
 *
 * Strategy, in order:
 *   1. Parse `{venueSlug}-{yyyy-mm-dd}` from the slug. Look up the headliner
 *      that played at that venue on that date. If one is the dominant artist
 *      across multiple sources, redirect to that artist's page.
 *   2. Otherwise, redirect to the venue page if the venue is recognized.
 *   3. Otherwise return null and let the caller decide (notFound, generic /festivals).
 */
export async function resolveRemovedFestivalSlug(slug: string): Promise<string | null> {
  const dateMatch = slug.match(DATE_SUFFIX_RE);
  if (!dateMatch) return null;

  const venueSlug = slug.slice(0, dateMatch.index);
  const dateStr = dateMatch[1];

  if (!venueSlug || venueSlug.length < 3) return null;

  // Look up the venue by slugified name.
  const venueRows = await db.select({ name: venues.name }).from(venues);
  const matchingVenue = venueRows.find((v) => slugify(v.name) === venueSlug);
  if (!matchingVenue) return null;

  // Look at the events that day at this venue. Pick the artist with the most
  // event rows (deduped sources count as multiple — that's fine, it ranks the
  // headliner correctly).
  const dayStart = new Date(`${dateStr}T00:00:00Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59Z`);

  // Rank candidate artists by: rows on this date at this venue (primary), then by
  // total upcoming event count globally so well-known headliners win ties when
  // multiple unrelated shows landed on the same date at the same venue.
  const rows = await db
    .select({
      artistSlug: artists.slug,
      sameDayCount: sql<number>`count(*)::int`,
      globalEventCount: sql<number>`(
        select count(*)::int from ${events} e2
        inner join ${eventArtists} ea2 on ea2.event_id = e2.id
        where ea2.artist_id = ${artists.id}
      )`,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .where(
      and(
        eq(venues.name, matchingVenue.name),
        gte(events.eventDate, dayStart),
        lte(events.eventDate, dayEnd),
      ),
    )
    .groupBy(artists.id, artists.slug)
    .orderBy(sql`count(*) desc, max((
      select count(*) from ${events} e3
      inner join ${eventArtists} ea3 on ea3.event_id = e3.id
      where ea3.artist_id = ${artists.id}
    )) desc`);

  if (rows.length > 0 && rows[0].artistSlug) {
    return `/artists/${rows[0].artistSlug}`;
  }

  return `/venues/${venueSlug}`;
}
