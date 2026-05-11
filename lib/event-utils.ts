/**
 * Shared event filtering utilities for deduplication across pages and scripts.
 */

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
