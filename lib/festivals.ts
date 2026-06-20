import { cache } from 'react';
import { db } from '@/db';
import { artists, events, venues, eventArtists } from '@/db/schema';
import { and, eq, gte, lt } from 'drizzle-orm';
import { slugify } from './slugify';
import { isPackage, isFestival, looksLikeTourStopName } from './event-utils';
import { clusterVenues } from './venue-cluster';
import type { Artist, Event, Venue } from '@/db/schema';

export const MIN_ARTISTS_FOR_FESTIVAL = 3;
export const ARCHIVE_MONTHS = 18;
/** Max gap (in days) between consecutive festival days that still belongs to the same multi-day festival. */
const MAX_DAY_GAP = 2;
/**
 * If the same set of artists plays this many distinct venues with no festival/brand
 * keyword, it's a touring package (e.g. Bruno Mars + RAYE + DJ Pee .Wee), not a
 * festival. Two venues can happen for a residency split across cities; three is
 * the point where we're confident it's a tour.
 */
const TOUR_PACKAGE_VENUE_THRESHOLD = 3;

/**
 * Branded festival names used as canonical slug bases when matched in event names.
 * These are well-known multi-artist festivals where the brand keyword is a strong
 * search term in its own right. When no match is found, the canonical slug falls
 * back to venue + date (stable but generic).
 *
 * Order matters: more specific phrases are listed BEFORE shorter ones that would
 * also substring-match (e.g. "rock am ring" before "ring", "big ears festival"
 * before "ears"). All entries must be lowercase.
 */
const BRAND_FESTIVAL_KEYWORDS = [
  // Multi-word / specific first to avoid being shadowed by shorter substrings.
  'all roads music festival',
  'austin city limits',
  'bbc radio 1\'s big weekend',
  'beats & bites festival',
  'bearded theory',
  'big ears festival',
  'bonnaroo',
  'boston calling',
  'breakaway music festival',
  'byron bay bluesfest',
  'camp bestival',
  'coachella',
  'country thunder',
  'creamfields',
  'discovery festival',
  'download festival',
  'edc las vegas',
  'electric daisy carnival',
  'electric forest',
  'field day',
  'firefly',
  'forecastle',
  'fuji rock',
  'glastonbury',
  'governors ball',
  'hellfest',
  'hurricane festival',
  'inkcarceration',
  'iceland airwaves',
  'lollapalooza',
  'louder than life',
  'mempho',
  'mountain jam',
  'newport folk',
  'newport jazz',
  'north sea jazz',
  'nova rock',
  'ohana fest',
  'osheaga',
  'outlaw music festival',
  'outside lands',
  'parklife',
  'pitchfork',
  'primavera',
  'reading & leeds',
  'riot fest',
  'rock am ring',
  'rock im park',
  'roskilde',
  'sea.hear.now',
  'shaky knees',
  'sonar',
  'sonic temple',
  'southside festival',
  'splash!',
  'stagecoach',
  'summerfest',
  'tomorrowland',
  'wacken',
  'welcome to rockville',
  'when we were young',
] as const;

export function findBrandFestival(name: string): string | null {
  const lower = name.toLowerCase();
  for (const kw of BRAND_FESTIVAL_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

export interface FestivalArtist {
  name: string;
  slug: string;
  imageUrl: string | null;
  genre: string | null;
}

/** A single ticket source (Ticketmaster, SeatGeek, etc.) for a given event card. */
export interface TicketSource {
  source: string;
  ticketUrl: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
}

/**
 * One unique ticket-purchase option for the festival (e.g. "4-Day Pass", "Single Day Friday",
 * "VIP"). Aggregates multiple sources (TM, SG) into a single card with multi-source CTAs.
 */
export interface FestivalEventCard {
  id: string;
  name: string;
  eventDate: Date;
  formattedDate: string;
  ticketSources: TicketSource[];
  /** Lowest minPrice across all ticket sources. */
  minPrice: number | null;
  /** Highest maxPrice across all ticket sources. */
  maxPrice: number | null;
  currency: string | null;
}

export interface FestivalDay {
  date: string;
  formattedDate: string;
  artists: FestivalArtist[];
  events: FestivalEventCard[];
}

export interface Festival {
  name: string;
  /** Canonical slug. For branded festivals: brand+startDate. Else: venueSlug+startDate. */
  slug: string;
  /**
   * Primary legacy slug derived from sorted unique event names (deterministic).
   * Single-day festival's first-day legacy slug.
   */
  legacySlug: string;
  /**
   * All slugs that should redirect to this festival (canonical + legacy for every
   * day in a multi-day festival, minus the canonical itself).
   */
  legacySlugs: string[];
  /** Start date YYYY-MM-DD. Kept as `date` for back-compat with the festival listing/compare pages. */
  date: string;
  /** End date YYYY-MM-DD. Equals `date` for single-day festivals. */
  endDate: string;
  /** "Friday, July 30, 2026" — start date pretty. Kept for back-compat. */
  formattedDate: string;
  /** "Friday, July 30 to Monday, August 2, 2026" or just one date for single-day. */
  formattedDateRange: string;
  isMultiDay: boolean;
  venue: Venue;
  venueSlug: string;
  /** One entry per festival day, sorted ascending. */
  days: FestivalDay[];
  /** Deduplicated union of artists across all days. */
  artists: FestivalArtist[];
  artistCount: number;
  /** Festival-level deduplicated tickets (4-Day Pass, Single-Day, VIP, etc.). */
  events: FestivalEventCard[];
  isPast: boolean;
}

/**
 * Find longest common prefix among event names, used to derive festival name.
 */
export function deriveFestivalName(eventNames: string[], venueName: string, formattedDate: string): string {
  if (eventNames.length === 0) return `${venueName} - ${formattedDate}`;

  // Find longest common prefix
  let prefix = eventNames[0];
  for (let i = 1; i < eventNames.length; i++) {
    while (!eventNames[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix.length === 0) break;
    }
    if (prefix.length === 0) break;
  }

  // Clean up trailing separators
  prefix = prefix.replace(/[\s\-:,|]+$/, '').trim();

  if (prefix.length >= 5) {
    return prefix;
  }

  return `${venueName} - ${formattedDate}`;
}

function formatDateLong(yyyymmdd: string): string {
  return new Date(yyyymmdd + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateRange(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatDateLong(startDate);
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  const sameYear = start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
  const endStr = end.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startStr} to ${endStr}`;
}

/**
 * Build event cards by deduplicating raw rows by (event name + event date),
 * accumulating each event's ticket sources (TM, SG) into a single card.
 */
function buildEventCards(rawRows: { event: Event }[]): FestivalEventCard[] {
  const cards = new Map<string, {
    id: string;
    name: string;
    eventDate: Date;
    sources: Map<string, TicketSource>;
  }>();

  for (const row of rawRows) {
    const key = `${row.event.name}|${row.event.eventDate.toISOString()}`;
    let card = cards.get(key);
    if (!card) {
      card = {
        id: row.event.id,
        name: row.event.name,
        eventDate: row.event.eventDate,
        sources: new Map(),
      };
      cards.set(key, card);
    }
    // Stable id: lowest by string sort across sources for a given (name, date)
    if (row.event.id < card.id) card.id = row.event.id;

    if (!card.sources.has(row.event.source)) {
      card.sources.set(row.event.source, {
        source: row.event.source,
        ticketUrl: row.event.ticketUrl,
        minPrice: row.event.minPrice,
        maxPrice: row.event.maxPrice,
        currency: row.event.currency,
      });
    }
  }

  const result: FestivalEventCard[] = [];
  for (const c of cards.values()) {
    const ticketSources = Array.from(c.sources.values());
    const mins = ticketSources.map((ts) => ts.minPrice).filter((p): p is number => p !== null && p > 0);
    const maxs = ticketSources.map((ts) => ts.maxPrice).filter((p): p is number => p !== null && p > 0);
    result.push({
      id: c.id,
      name: c.name,
      eventDate: c.eventDate,
      formattedDate: c.eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      ticketSources,
      minPrice: mins.length ? Math.min(...mins) : null,
      maxPrice: maxs.length ? Math.max(...maxs) : null,
      currency: ticketSources.find((ts) => ts.currency)?.currency || null,
    });
  }

  return result.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
}

/**
 * Festival-level event cards: across all days, dedupe by event NAME (the same
 * "4-Day Pass" listed on multiple days collapses to one card showing the earliest date).
 */
function dedupeFestivalEvents(allDayEvents: FestivalEventCard[]): FestivalEventCard[] {
  const byName = new Map<string, FestivalEventCard>();
  for (const card of allDayEvents) {
    const existing = byName.get(card.name);
    if (!existing) {
      byName.set(card.name, card);
      continue;
    }
    // Merge: keep the earlier card's date and id, but union the ticket sources and price range.
    const merged: FestivalEventCard = card.eventDate < existing.eventDate
      ? { ...card }
      : { ...existing };
    const sourceMap = new Map<string, TicketSource>();
    for (const ts of [...existing.ticketSources, ...card.ticketSources]) {
      if (!sourceMap.has(ts.source)) sourceMap.set(ts.source, ts);
    }
    merged.ticketSources = Array.from(sourceMap.values());
    const mins = merged.ticketSources.map((ts) => ts.minPrice).filter((p): p is number => p !== null && p > 0);
    const maxs = merged.ticketSources.map((ts) => ts.maxPrice).filter((p): p is number => p !== null && p > 0);
    merged.minPrice = mins.length ? Math.min(...mins) : null;
    merged.maxPrice = maxs.length ? Math.max(...maxs) : null;
    byName.set(card.name, merged);
  }
  return Array.from(byName.values()).sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
}

interface FetchOptions {
  from?: Date;
  to?: Date;
}

interface DayGroup {
  venueSlug: string;
  date: string;
  venue: Venue;
  rawRows: { event: Event; artist: Artist }[];
  artistsById: Map<string, Artist>;
  allEventNames: Set<string>;
}

interface QualifiedDay {
  venueSlug: string;
  date: string;
  venue: Venue;
  artists: FestivalArtist[];
  events: FestivalEventCard[];
  brandKey: string | null;
  derivedName: string;
  legacySlug: string;
  rawRows: { event: Event; artist: Artist }[];
}

async function fetchFestivals({ from, to }: FetchOptions): Promise<Festival[]> {
  const conditions = [];
  if (from) conditions.push(gte(events.eventDate, from));
  if (to) conditions.push(lt(events.eventDate, to));

  const rows = await db
    .select({
      event: events,
      venue: venues,
      artist: artists,
    })
    .from(events)
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(events.eventDate);

  // Collapse duplicate venue records first, so the same festival ingested from
  // two sources (or under two venue names) buckets into a single day group
  // instead of splitting its lineup below the 3-artist detection threshold.
  const venueById = new Map<string, Venue>();
  for (const row of rows) venueById.set(row.venue.id, row.venue);
  const venueClusters = clusterVenues([...venueById.values()]);

  // Step 1: bucket raw rows into per-day groups keyed by canonical venue + date.
  const dayGroups = new Map<string, DayGroup>();
  for (const row of rows) {
    if (!row.venue.name) continue;
    if (isPackage(row.event.name)) continue;

    const cluster = venueClusters.get(row.venue.id);
    const venueSlug = cluster ? cluster.canonicalSlug : slugify(row.venue.name);
    const canonicalVenue = (cluster && venueById.get(cluster.canonicalId)) || row.venue;
    const dateKey = new Date(row.event.eventDate).toISOString().slice(0, 10);
    const groupKey = `${venueSlug}_${dateKey}`;

    let group = dayGroups.get(groupKey);
    if (!group) {
      group = {
        venueSlug,
        date: dateKey,
        venue: canonicalVenue,
        rawRows: [],
        artistsById: new Map(),
        allEventNames: new Set(),
      };
      dayGroups.set(groupKey, group);
    }

    group.rawRows.push({ event: row.event, artist: row.artist });
    group.allEventNames.add(row.event.name);
    if (!group.artistsById.has(row.artist.id)) {
      group.artistsById.set(row.artist.id, row.artist);
    }
  }

  // Step 2: filter to qualifying festival days. A day qualifies as a festival when:
  //   - any event name matches a branded festival (Bonnaroo, Coachella, etc.), OR
  //   - any event name matches a generic festival keyword ("fest", "festival") AND that
  //     same name doesn't also look like a tour stop. This guards against tour-stop
  //     names that happen to contain "fest" as a substring (e.g. "GODSMACK Tour 2026 -
  //     UFEST 20" contains "fest" but is clearly a tour stop), OR
  //   - the day has 3+ distinct artists AND none of the event names look like a tour
  //     stop ("Bruno Mars with X and Y", "Metallica: M72 World Tour", "w/", "presents:").
  const qualifiedDays: QualifiedDay[] = [];
  for (const group of dayGroups.values()) {
    const eventNamesArray = Array.from(group.allEventNames);
    const hasBrandMatch = eventNamesArray.some((name) => findBrandFestival(name));
    const hasCleanFestMatch = eventNamesArray.some((name) => isFestival(name) && !looksLikeTourStopName(name));
    const hasEnoughArtists = group.artistsById.size >= MIN_ARTISTS_FOR_FESTIVAL;
    const anyLooksLikeTourStop = eventNamesArray.some((name) => looksLikeTourStopName(name));
    const qualifiesFromArtists = hasEnoughArtists && !anyLooksLikeTourStop;
    if (!hasBrandMatch && !hasCleanFestMatch && !qualifiesFromArtists) continue;

    const formattedDate = formatDateLong(group.date);
    const allEventNamesSorted = eventNamesArray.sort();
    const derivedName = deriveFestivalName(allEventNamesSorted, group.venue.name, formattedDate);
    const legacySlug = `${slugify(derivedName)}-${group.date}`;

    let brandKey: string | null = null;
    for (const eventName of allEventNamesSorted) {
      const brand = findBrandFestival(eventName);
      if (brand) {
        brandKey = brand;
        break;
      }
    }

    const dayArtists: FestivalArtist[] = Array.from(group.artistsById.values()).map((a) => ({
      name: a.name,
      slug: a.slug,
      imageUrl: a.imageUrl,
      genre: a.genre,
    }));

    const dayEvents = buildEventCards(group.rawRows);

    qualifiedDays.push({
      venueSlug: group.venueSlug,
      date: group.date,
      venue: group.venue,
      artists: dayArtists,
      events: dayEvents,
      brandKey,
      derivedName,
      legacySlug,
      rawRows: group.rawRows,
    });
  }

  // Step 2b: drop tour packages misidentified as festivals. A "tour package" is the same
  // sorted artist set appearing at 3+ distinct venues — that pattern is a headliner touring
  // with named openers, not a festival. Days with a brand or festival-keyword match are
  // exempt (a real festival can legitimately share a lineup with another stop).
  const signatureVenues = new Map<string, Set<string>>();
  for (const day of qualifiedDays) {
    if (day.brandKey) continue;
    const hasFestivalKeyword = Array.from(new Set(day.rawRows.map((r) => r.event.name))).some((n) => isFestival(n) && !looksLikeTourStopName(n));
    if (hasFestivalKeyword) continue;
    const signature = day.artists.map((a) => a.slug).sort().join(',');
    let venueSet = signatureVenues.get(signature);
    if (!venueSet) {
      venueSet = new Set();
      signatureVenues.set(signature, venueSet);
    }
    venueSet.add(day.venueSlug);
  }
  const tourSignatures = new Set<string>();
  for (const [signature, venues] of signatureVenues.entries()) {
    if (venues.size >= TOUR_PACKAGE_VENUE_THRESHOLD) tourSignatures.add(signature);
  }
  const cleanedDays: QualifiedDay[] = [];
  for (const day of qualifiedDays) {
    if (day.brandKey) {
      cleanedDays.push(day);
      continue;
    }
    const hasFestivalKeyword = Array.from(new Set(day.rawRows.map((r) => r.event.name))).some((n) => isFestival(n) && !looksLikeTourStopName(n));
    if (hasFestivalKeyword) {
      cleanedDays.push(day);
      continue;
    }
    const signature = day.artists.map((a) => a.slug).sort().join(',');
    if (tourSignatures.has(signature)) continue;
    cleanedDays.push(day);
  }

  // Step 3: cluster days that belong to the same multi-day festival (same venue, same brand,
  // contiguous dates with at most MAX_DAY_GAP days between consecutive entries).
  // Days without a brand keyword stay as standalone single-day festivals.
  const clusters = new Map<string, QualifiedDay[]>();
  for (const day of cleanedDays) {
    const clusterKey = day.brandKey
      ? `${day.venueSlug}|brand|${day.brandKey}`
      : `${day.venueSlug}|nobrand|${day.date}`; // nobrand keys are unique per date so they don't merge
    const list = clusters.get(clusterKey) ?? [];
    list.push(day);
    clusters.set(clusterKey, list);
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const festivals: Festival[] = [];

  for (const cluster of clusters.values()) {
    cluster.sort((a, b) => a.date.localeCompare(b.date));

    // Split cluster into contiguous runs.
    const runs: QualifiedDay[][] = [];
    let currentRun: QualifiedDay[] = [cluster[0]];
    for (let i = 1; i < cluster.length; i++) {
      const prev = cluster[i - 1];
      const cur = cluster[i];
      const gapMs = new Date(cur.date).getTime() - new Date(prev.date).getTime();
      const gapDays = Math.round(gapMs / (1000 * 60 * 60 * 24));
      if (gapDays <= MAX_DAY_GAP) {
        currentRun.push(cur);
      } else {
        runs.push(currentRun);
        currentRun = [cur];
      }
    }
    runs.push(currentRun);

    for (const run of runs) {
      festivals.push(buildFestivalFromRun(run, todayKey));
    }
  }

  // Sort by start date ascending so listings show what's coming up first.
  festivals.sort((a, b) => a.date.localeCompare(b.date));

  return festivals;
}

function buildFestivalFromRun(days: QualifiedDay[], todayKey: string): Festival {
  const startDate = days[0].date;
  const endDate = days[days.length - 1].date;
  const isMultiDay = days.length > 1;

  // Festival name: prefer first day's brand-derived label if available, else first day's derived name.
  // For multi-day branded fests, this is just the brand keyword in title case.
  const firstDay = days[0];
  let name = firstDay.derivedName;
  if (firstDay.brandKey) {
    // Title-case the brand keyword (e.g. "lollapalooza" → "Lollapalooza", "rock am ring" → "Rock Am Ring")
    name = firstDay.brandKey.replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  // Canonical slug: brand+startDate or venue+startDate
  const slug = firstDay.brandKey
    ? `${slugify(firstDay.brandKey)}-${startDate}`
    : `${firstDay.venueSlug}-${startDate}`;

  // Primary legacy slug = first day's legacy slug.
  const primaryLegacy = firstDay.legacySlug;
  // All slugs that should redirect to this canonical: every day's canonical+legacy except the canonical itself.
  const legacySlugSet = new Set<string>();
  for (const day of days) {
    const dayCanonical = firstDay.brandKey
      ? `${slugify(firstDay.brandKey)}-${day.date}`
      : `${day.venueSlug}-${day.date}`;
    if (dayCanonical !== slug) legacySlugSet.add(dayCanonical);
    if (day.legacySlug !== slug) legacySlugSet.add(day.legacySlug);
  }
  legacySlugSet.delete(slug); // safety
  // primaryLegacy is also in the set when it's not equal to canonical
  const legacySlugs = Array.from(legacySlugSet);

  // Union artists across days, dedupe by slug.
  const artistsBySlug = new Map<string, FestivalArtist>();
  for (const day of days) {
    for (const a of day.artists) {
      if (!artistsBySlug.has(a.slug)) artistsBySlug.set(a.slug, a);
    }
  }
  const allArtists = Array.from(artistsBySlug.values());

  // Festival-level events: all day events deduped by name (collapses multi-day passes).
  const allDayEvents = days.flatMap((d) => d.events);
  const festivalEvents = dedupeFestivalEvents(allDayEvents);

  // Per-day FestivalDay objects for the page's day-by-day section.
  const festivalDays: FestivalDay[] = days.map((d) => ({
    date: d.date,
    formattedDate: formatDateLong(d.date),
    artists: d.artists,
    events: d.events,
  }));

  return {
    name,
    slug,
    legacySlug: primaryLegacy,
    legacySlugs,
    date: startDate,
    endDate,
    formattedDate: formatDateLong(startDate),
    formattedDateRange: formatDateRange(startDate, endDate),
    isMultiDay,
    venue: firstDay.venue,
    venueSlug: firstDay.venueSlug,
    days: festivalDays,
    artists: allArtists,
    artistCount: allArtists.length,
    events: festivalEvents,
    isPast: endDate < todayKey,
  };
}

/**
 * Cross-request TTL memo. React's cache() only dedupes within a single request,
 * so every statically generated page re-ran the full-events festival scan —
 * with ~19k pages in a build, the concurrent scans saturated the database and
 * festival/artist pages hit Next's 60s static-generation timeout. One scan per
 * process per TTL window is plenty: festival data only moves when imports run,
 * and pages revalidate every 30 minutes anyway.
 */
function ttlMemo<T>(fn: () => Promise<T>, ttlMs: number): () => Promise<T> {
  let entry: { at: number; value: Promise<T> } | null = null;
  return () => {
    if (!entry || Date.now() - entry.at > ttlMs) {
      const value = fn().catch((err) => {
        entry = null; // don't cache failures
        throw err;
      });
      entry = { at: Date.now(), value };
    }
    return entry.value;
  };
}

const FESTIVALS_TTL_MS = 30 * 60 * 1000;

const getUpcomingFestivalsMemo = ttlMemo(
  () => fetchFestivals({ from: new Date() }),
  FESTIVALS_TTL_MS,
);

const getArchivedFestivalsMemo = ttlMemo(
  () => {
    const from = new Date();
    from.setMonth(from.getMonth() - ARCHIVE_MONTHS);
    return fetchFestivals({ from, to: new Date() });
  },
  FESTIVALS_TTL_MS,
);

export const getAllFestivals = cache(async function getAllFestivals(): Promise<Festival[]> {
  return getUpcomingFestivalsMemo();
});

export const getArchivedFestivals = cache(async function getArchivedFestivals(monthsBack = ARCHIVE_MONTHS): Promise<Festival[]> {
  if (monthsBack !== ARCHIVE_MONTHS) {
    const from = new Date();
    from.setMonth(from.getMonth() - monthsBack);
    return fetchFestivals({ from, to: new Date() });
  }
  return getArchivedFestivalsMemo();
});

/**
 * Look up a festival by either its canonical slug or any of its legacy slugs.
 * Returns the festival; the caller is responsible for redirecting non-canonical
 * hits to the canonical URL.
 */
export async function getFestivalBySlug(slug: string): Promise<Festival | null> {
  const matches = (f: Festival) =>
    f.slug === slug || f.legacySlug === slug || f.legacySlugs.includes(slug);

  const upcoming = await getAllFestivals();
  const upcomingMatch = upcoming.find(matches);
  if (upcomingMatch) return upcomingMatch;

  const archived = await getArchivedFestivals();
  return archived.find(matches) ?? null;
}
