/**
 * Shared event filtering utilities for deduplication across pages and scripts.
 */

import { getAffiliateUrl } from '@/lib/affiliate';

export const PACKAGE_KEYWORDS = [
  'vip', 'package', 'upgrade', 'comfort seat', 'lounge', 'meet & greet',
  'meet and greet', 'premium', 'platinum', 'gold circle', 'early entry',
  'soundcheck', 'vinyl room', 'hospitality', 'suite', 'box seat',
  'excluding concert ticket', 'hot ticket', 'upsell',
  'club level', 'logen-seat', 'accessible ticket', 'payment plan',
  'tribute', 'tribute to', 'tribute band', 'live band tribute',
];

export function isPackage(name: string): boolean {
  const lower = name.toLowerCase();
  return PACKAGE_KEYWORDS.some(kw => lower.includes(kw));
}

const FESTIVAL_KEYWORDS = [
  'fest', 'festival', 'palooza', 'bonnaroo', 'coachella', 'glastonbury',
  'lollapalooza', 'summerfest', 'firefly', 'governors ball', 'ultra',
  'tomorrowland', 'primavera', 'reading & leeds', 'download festival',
  'wireless', 'parklife', 'bestival', 'creamfields', 'sonar',
  'roskilde', 'fuji rock', 'rock am ring', 'rock im park',
  'wacken', 'hellfest', 'nova rock', 'hurricane festival',
  'southside festival', 'splash!', 'melt!', 'frequency',
];

export function isFestival(name: string): boolean {
  const lower = name.toLowerCase();
  return FESTIVAL_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Event-name patterns that strongly indicate a tour stop (one headliner + named
 * openers), as opposed to a festival lineup. Used by the festival detector to
 * reject false positives where a venue happens to host 3+ artists on one date
 * but the event is actually just an arena/amphitheater show.
 *
 * A name passes this check if it matches one of these patterns. Real festival
 * event names ("Bonnaroo 2026 Friday Pass", "Stagecoach VIP") will not match.
 */
const TOUR_STOP_PATTERNS: RegExp[] = [
  / with .+/i,                  // "Bruno Mars with Leon Thomas and DJ Pee .Wee", "Staind with Hoobastank"
  / w\/ /i,                     // "Rob Zombie w/ Marilyn Manson"
  / presents:/i,                // "Post Malone Presents: The BIG ASS Stadium Tour"
  / feat\.? /i,                 // "Outskirts feat. Jelly Roll" (handled at festival level, harmless here)
  /[-–:]\s*the .+ tour\b/i,     // "Bruno Mars - The Romantic Tour"
  /[-–:].+\btour\b/i,           // "Metallica: M72 World Tour"
  /\btour\s*\d{4}/i,            // "Tour 2026" — "GODSMACK - The Rise of Rock World Tour 2026"
  /\broad show\b/i,             // "Chris Stapleton's All-American Road Show"
];

export function looksLikeTourStopName(name: string): boolean {
  return TOUR_STOP_PATTERNS.some((rx) => rx.test(name));
}

/**
 * Reduces an event name to a stable base for dedup matching: drops
 * parenthetical qualifiers ("(18+)", "(18 and Over...)") and package-only
 * segments ("- payment plan at checkout", "VIP Package"), then lowercases and
 * strips punctuation. So "Parklife - Saturday", "Parklife - Saturday - payment
 * plan at checkout", and "Parklife (Sold Out) - Saturday" all share one base.
 */
export function eventBaseName(name: string): string {
  const withoutParens = name.replace(/\([^)]*\)/g, ' ');
  const segments = withoutParens.split(/\s+[-–:|]\s+/).map((s) => s.trim()).filter(Boolean);
  const kept = segments.filter((seg) => !isPackage(seg));
  const base = (kept.length ? kept : segments).join(' ');
  return base.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Dedup key that collapses the same real-world show regardless of how it was
 * ingested. Uses city rather than venueId so cross-source duplicates merge
 * (Ticketmaster and SeatGeek each mint their own venue record for one event),
 * and the normalized base name so package/qualifier variants merge too.
 */
export function eventDedupeKey(name: string, city: string | null | undefined, eventDate: Date): string {
  return `${eventBaseName(name)}|${(city ?? '').toLowerCase().trim()}|${eventDate.getTime()}`;
}

/** Fields dedupeEvents() needs from a row, regardless of its shape. */
export interface DedupeFields {
  name: string;
  artistName?: string | null;
  city?: string | null;
  eventDate: Date;
}

// Cross-source listings of one show disagree on start time (door vs show time,
// rounding, occasionally the calendar day). Same headliner + city within this
// window is the same show; nightly residencies sit ~24h apart and stay split.
const CROSS_SOURCE_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * Collapses duplicate event rows for listings, in two passes:
 *
 *  1. By normalized base name + city + time — merges festival lineups and
 *     co-headline bills (one event, many artist rows), package/qualifier name
 *     variants, and same-name cross-source dupes.
 *  2. By headliner + city within a time window — merges the same show ingested
 *     from Ticketmaster and SeatGeek under different names ("Khalid with Lauv"
 *     vs "Khalid: It's Always Summer Somewhere Tour"), where venue id, name,
 *     and even the exact timestamp differ between sources.
 *
 * Non-package rows are preferred on collision. Original ordering is preserved.
 */
export function dedupeEvents<T>(rows: T[], get: (row: T) => DedupeFields): T[] {
  // Pass 1
  const byName = new Map<string, T>();
  for (const row of rows) {
    const f = get(row);
    const key = eventDedupeKey(f.name, f.city, f.eventDate);
    const existing = byName.get(key);
    if (!existing || (isPackage(get(existing).name) && !isPackage(f.name))) {
      byName.set(key, row);
    }
  }

  // Pass 2
  const survivors = Array.from(byName.values());
  const buckets = new Map<string, T[]>();
  const dropped = new Set<T>();
  for (const row of survivors) {
    const f = get(row);
    const artist = (f.artistName ?? '').toLowerCase().trim();
    if (!artist) continue; // no reliable headliner to cluster on
    const bucketKey = `${artist}|${(f.city ?? '').toLowerCase().trim()}`;
    const kept = buckets.get(bucketKey);
    if (!kept) {
      buckets.set(bucketKey, [row]);
      continue;
    }
    const near = kept.find(
      (k) => Math.abs(get(k).eventDate.getTime() - f.eventDate.getTime()) <= CROSS_SOURCE_WINDOW_MS
    );
    if (!near) {
      kept.push(row);
    } else if (isPackage(get(near).name) && !isPackage(f.name)) {
      dropped.add(near);
      kept.splice(kept.indexOf(near), 1, row);
    } else {
      dropped.add(row);
    }
  }
  return survivors.filter((r) => !dropped.has(r));
}

/**
 * Decides the primary clickable label for an event row in a listing.
 *
 * Festivals are stored as one event record per lineup artist, so after dedup
 * the surviving row carries an arbitrary artist. For those, label with the
 * festival name itself and link to tickets (affiliate-wrapped) rather than an
 * artist page. Every other event labels with the headlining artist and links
 * to that artist's page.
 *
 * Pass explicit fields (not a row object) so it works across the flat homepage
 * shape and the nested `row.event` shape used by the other listing pages.
 */
export interface EventLabelInput {
  name: string;
  ticketUrl?: string | null;
  source?: string | null;
  artistName: string;
  artistSlug: string;
}

export interface EventLabel {
  text: string;
  href: string | null;
  external: boolean;
}

export function eventPrimaryLabel(input: EventLabelInput): EventLabel {
  if (isFestival(input.name)) {
    return {
      text: input.name,
      href: input.ticketUrl ? getAffiliateUrl(input.ticketUrl, input.source ?? '') : null,
      external: true,
    };
  }
  return {
    text: input.artistName,
    href: `/artists/${input.artistSlug}`,
    external: false,
  };
}
