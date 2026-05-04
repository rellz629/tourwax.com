import { cache } from 'react';
import { db } from '@/db';
import { artists, events, venues, eventArtists } from '@/db/schema';
import { and, eq, gte, lt } from 'drizzle-orm';
import { slugify } from './slugify';
import { isPackage, isFestival } from './event-utils';
import type { Artist, Event, Venue } from '@/db/schema';

export const MIN_ARTISTS_FOR_FESTIVAL = 3;
export const ARCHIVE_MONTHS = 18;

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
  'austin city limits',
  'big ears festival',
  'bonnaroo',
  'byron bay bluesfest',
  'camp bestival',
  'coachella',
  'creamfields',
  'download festival',
  'electric daisy carnival',
  'firefly',
  'fuji rock',
  'glastonbury',
  'governors ball',
  'hellfest',
  'hurricane festival',
  'lollapalooza',
  'mountain jam',
  'newport folk',
  'newport jazz',
  'nova rock',
  'osheaga',
  'outside lands',
  'parklife',
  'pitchfork',
  'primavera',
  'reading & leeds',
  'rock am ring',
  'rock im park',
  'roskilde',
  'sonar',
  'southside festival',
  'splash!',
  'summerfest',
  'tomorrowland',
  'wacken',
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

export interface FestivalEvent {
  id: string;
  name: string;
  eventDate: Date;
  ticketUrl: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
  source: string;
  artist: FestivalArtist;
}

export interface Festival {
  name: string;
  /** Canonical slug: stable across lineup/event-name changes (venueSlug + date). */
  slug: string;
  /**
   * Legacy prefix-based slug used before slug stabilization. Computed deterministically
   * from sorted unique event names so it can still match historic GSC URLs.
   */
  legacySlug: string;
  date: string; // YYYY-MM-DD
  formattedDate: string;
  venue: Venue;
  venueSlug: string;
  artists: FestivalArtist[];
  events: FestivalEvent[];
  artistCount: number;
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

interface FetchOptions {
  from?: Date;
  to?: Date;
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

  // Group by venue slug + date
  const groups = new Map<string, {
    venueSlug: string;
    date: string;
    venue: Venue;
    eventsByArtist: Map<string, { event: Event; artist: Artist }>;
    /** All distinct event names across every row in the group, used for deterministic legacy slug derivation. */
    allEventNames: Set<string>;
  }>();

  for (const row of rows) {
    if (!row.venue.name) continue;
    if (isPackage(row.event.name)) continue;

    const venueSlug = slugify(row.venue.name);
    const dateKey = new Date(row.event.eventDate).toISOString().slice(0, 10);
    const groupKey = `${venueSlug}_${dateKey}`;

    let group = groups.get(groupKey);
    if (!group) {
      group = {
        venueSlug,
        date: dateKey,
        venue: row.venue,
        eventsByArtist: new Map(),
        allEventNames: new Set(),
      };
      groups.set(groupKey, group);
    }

    group.allEventNames.add(row.event.name);

    // Keep one event per artist (prefer non-package, already filtered above)
    if (!group.eventsByArtist.has(row.artist.id)) {
      group.eventsByArtist.set(row.artist.id, { event: row.event, artist: row.artist });
    }
  }

  // Filter to groups with 3+ distinct artists, OR events whose name matches festival keywords
  const festivals: Festival[] = [];
  const todayKey = new Date().toISOString().slice(0, 10);

  for (const group of groups.values()) {
    const hasEnoughArtists = group.eventsByArtist.size >= MIN_ARTISTS_FOR_FESTIVAL;
    const nameMatchesFestival = Array.from(group.allEventNames).some(name => isFestival(name));

    if (!hasEnoughArtists && !nameMatchesFestival) continue;

    const entries = Array.from(group.eventsByArtist.values());

    const formattedDate = new Date(group.date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Legacy slug uses ALL distinct event names (sorted) so it's deterministic across runs.
    // This matches what was historically indexed by Google when the data first stabilized.
    const allEventNamesSorted = Array.from(group.allEventNames).sort();
    const festivalName = deriveFestivalName(allEventNamesSorted, group.venue.name, formattedDate);
    const legacySlug = `${slugify(festivalName)}-${group.date}`;

    // Canonical slug:
    //   1. If any event name contains a known branded festival (Lollapalooza, Wacken, etc.),
    //      use the brand keyword + date. Preserves search/CTR value of the festival name.
    //   2. Otherwise fall back to venueSlug + date. Stable across lineup churn for ad-hoc
    //      multi-artist groups (e.g. headliner-with-openers shows where the prefix shifts).
    let brandSlugBase: string | null = null;
    for (const eventName of allEventNamesSorted) {
      const brand = findBrandFestival(eventName);
      if (brand) {
        brandSlugBase = slugify(brand);
        break;
      }
    }
    const canonicalSlug = brandSlugBase
      ? `${brandSlugBase}-${group.date}`
      : `${group.venueSlug}-${group.date}`;

    const festivalArtists: FestivalArtist[] = entries.map((e) => ({
      name: e.artist.name,
      slug: e.artist.slug,
      imageUrl: e.artist.imageUrl,
      genre: e.artist.genre,
    }));

    const festivalEvents: FestivalEvent[] = entries.map((e) => ({
      id: e.event.id,
      name: e.event.name,
      eventDate: e.event.eventDate,
      ticketUrl: e.event.ticketUrl,
      minPrice: e.event.minPrice,
      maxPrice: e.event.maxPrice,
      currency: e.event.currency,
      source: e.event.source,
      artist: {
        name: e.artist.name,
        slug: e.artist.slug,
        imageUrl: e.artist.imageUrl,
        genre: e.artist.genre,
      },
    }));

    festivals.push({
      name: festivalName,
      slug: canonicalSlug,
      legacySlug,
      date: group.date,
      formattedDate,
      venue: group.venue,
      venueSlug: group.venueSlug,
      artists: festivalArtists,
      events: festivalEvents,
      artistCount: festivalArtists.length,
      isPast: group.date < todayKey,
    });
  }

  // Sort by artist count descending
  festivals.sort((a, b) => b.artistCount - a.artistCount);

  return festivals;
}

export const getAllFestivals = cache(async function getAllFestivals(): Promise<Festival[]> {
  return fetchFestivals({ from: new Date() });
});

export const getArchivedFestivals = cache(async function getArchivedFestivals(monthsBack = ARCHIVE_MONTHS): Promise<Festival[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - monthsBack);
  const to = new Date();
  return fetchFestivals({ from, to });
});

/**
 * Look up a festival by either its canonical slug (venue+date) or its legacy
 * prefix-based slug. Returns the festival; the caller is responsible for
 * redirecting legacy hits to the canonical URL.
 */
export async function getFestivalBySlug(slug: string): Promise<Festival | null> {
  const upcoming = await getAllFestivals();
  const upcomingMatch = upcoming.find((f) => f.slug === slug || f.legacySlug === slug);
  if (upcomingMatch) return upcomingMatch;

  const archived = await getArchivedFestivals();
  return archived.find((f) => f.slug === slug || f.legacySlug === slug) ?? null;
}
