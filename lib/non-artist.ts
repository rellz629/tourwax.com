/**
 * Heuristic: does this name look like a promoter, booking agency, festival
 * brand, or tribute act rather than a real performing artist?
 *
 * Ticketmaster and SeatGeek return these in their `attractions` / `performers`
 * fields, often with no music classification, and the importers used to flatten
 * them straight into the `artists` table. That produced bogus artist pages
 * (e.g. "Winiary Bookings") that outranked real artists by event count. See
 * scripts/reattribute-promoter-events.ts and scripts/deactivate-junk-artists.ts
 * for the cleanup of historical rows; this guard stops new ones being created.
 *
 * Deliberately conservative — only patterns that are virtually never a real
 * band name — because importers SKIP creation when this returns true. A missed
 * promoter is cheap to clean up later; a false positive silently drops a real
 * artist, so the bar to match is high.
 */

// Promoter / agency / management signals. Kept narrow to avoid real-band
// collisions: "agency" is omitted (e.g. "The Agency") in favour of "booking
// agency", and "mgmt" is omitted because it is the band MGMT, not management.
const PROMOTER_RE =
  /\b(bookings?|promotions?|promoter|presents|management|booking agency|live nation|aeg presents|goldenvoice|c3 presents)\b/i;

// "Fest" / "Festival" as a whole word. \b keeps "Manifest"/"Fest Anza" safe
// because the boundary only fires on a standalone token.
const FESTIVAL_RE = /\b(festival|fest)\b/i;

const TRIBUTE_RE = /^\s*(a\s+)?tribute to\b|\btribute (band|show)\b/i;

export type NonArtistReason = 'promoter' | 'festival' | 'tribute';

export function nonArtistReason(name: string): NonArtistReason | null {
  const n = (name ?? '').trim();
  if (!n) return null;
  if (TRIBUTE_RE.test(n)) return 'tribute';
  if (PROMOTER_RE.test(n)) return 'promoter';
  if (FESTIVAL_RE.test(n)) return 'festival';
  return null;
}

export function isLikelyNonArtist(name: string): boolean {
  return nonArtistReason(name) !== null;
}
