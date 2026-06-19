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
