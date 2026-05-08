/**
 * SEO pruning thresholds and predicates. Single source of truth used by:
 *   - app/sitemap.ts                   (filter URLs out of sitemap.xml)
 *   - app/artists/[slug]/page.tsx      (set robots.index=false on thin artist pages)
 *   - app/venues/[slug]/page.tsx       (same for thin venue pages)
 *   - app/concerts/[city]/page.tsx     (same for thin city pages)
 *   - app/festivals/[slug]/page.tsx    (same for ad-hoc/tour-stop "festival" pages)
 *   - scripts/seo-audit.ts             (mirrors these constants for offline reports)
 *
 * These thresholds were calibrated against the May 2026 GSC drilldown which
 * showed ~3,700 thin programmatic URLs in "Crawled - currently not indexed" /
 * "Discovered - currently not indexed" buckets after a late-April quality
 * reassessment by Google.
 */

export const SEO_PRUNE = {
  ARTIST_MIN_LIFETIME_EVENTS: 3,
  VENUE_MIN_LIFETIME_EVENTS: 3,
  CITY_MIN_LIFETIME_EVENTS: 5,
  CITY_MIN_UPCOMING_EVENTS: 3,
  FESTIVAL_MIN_ARTISTS_NO_BRAND: 5,
  FESTIVAL_MIN_DAYS_NO_BRAND: 2,
} as const;

interface EventCounts {
  lifetime: number;
  upcoming: number;
}

/**
 * Real artist between tour cycles → noindex temporarily, do NOT deactivate.
 * The page stays clickable from internal links and search; only Google's index
 * is told to skip it until events return.
 */
export function shouldNoindexArtist({ lifetime, upcoming }: EventCounts): boolean {
  return upcoming === 0 && lifetime < SEO_PRUNE.ARTIST_MIN_LIFETIME_EVENTS;
}

export function shouldNoindexVenue({ lifetime, upcoming }: EventCounts): boolean {
  return upcoming === 0 && lifetime < SEO_PRUNE.VENUE_MIN_LIFETIME_EVENTS;
}

export function shouldNoindexCity({ lifetime, upcoming }: EventCounts): boolean {
  if (upcoming === 0 && lifetime < SEO_PRUNE.CITY_MIN_LIFETIME_EVENTS) return true;
  if (upcoming > 0 && upcoming < SEO_PRUNE.CITY_MIN_UPCOMING_EVENTS) return true;
  return false;
}

interface FestivalShape {
  artistCount: number;
  daysCount: number;
  brandKey: string | null;
}

/**
 * "Festivals" that are really tour stops with openers (Iron Maiden + Megadeth +
 * Anthrax, Post Malone presents..., Bruno Mars with RAYE & DJ Pee.Wee) get a
 * /festivals/<slug> URL because they cross the 3-artists-at-same-venue
 * threshold. Treat them as not-real-festivals: not in sitemap, page is noindex.
 *
 * Branded festivals (matching BRAND_FESTIVAL_KEYWORDS) always pass.
 */
export function shouldNoindexFestival(f: FestivalShape): boolean {
  if (f.brandKey) return false;
  if (f.daysCount >= SEO_PRUNE.FESTIVAL_MIN_DAYS_NO_BRAND) return false;
  if (f.artistCount >= SEO_PRUNE.FESTIVAL_MIN_ARTISTS_NO_BRAND) return false;
  return true;
}
