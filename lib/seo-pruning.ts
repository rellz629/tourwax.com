/**
 * SEO pruning thresholds and predicates. Event counts fed into these predicates
 * come from lib/event-counts.ts so the sitemap and pages always agree.
 * Single source of truth used by:
 *   - app/sitemap.ts                   (filter URLs out of sitemap.xml)
 *   - app/artists/[slug]/page.tsx      (set robots.index=false on thin artist pages)
 *   - app/venues/[slug]/page.tsx       (same for thin venue pages)
 *   - app/concerts/[city]/page.tsx     (same for thin city pages)
 *   - app/festivals/[slug]/page.tsx    (same for ad-hoc/tour-stop "festival" pages)
 *   - scripts/seo-audit.ts             (mirrors these constants for offline reports)
 *
 * Thresholds were re-calibrated 2026-05-31 against the GSC drilldowns under
 * Traffic Reports/5-31-2026/. The previous (May 7) thresholds were directionally
 * correct but too generous: 656 artists in GSC "Crawled - not indexed" passed
 * the old `lifetime >= 3 OR upcoming >= 1` rule. Google's quality classifier
 * rejects single-event artist pages even when our predicate allows them, so
 * the new floors require either a real upcoming presence (>=2 for artists,
 * >=5 for cities) or meaningful lifetime depth (>=5 / >=10).
 *
 * Bing, DuckDuckGo, and Yahoo continue to index and rank the surface that
 * Google has demoted (Vercel referrers and GA4 channel breakdown both confirm
 * ~70% of organic traffic comes from non-Google search engines as of late May
 * 2026). The cut is calibrated to convince Google's classifier without
 * destroying the surface those other engines are still ranking.
 */

export const SEO_PRUNE = {
  ARTIST_MIN_LIFETIME_EVENTS: 5,
  ARTIST_MIN_UPCOMING_EVENTS: 2,
  VENUE_MIN_LIFETIME_EVENTS: 10,
  VENUE_MIN_UPCOMING_EVENTS: 2,
  CITY_MIN_LIFETIME_EVENTS: 10,
  CITY_MIN_UPCOMING_EVENTS: 5,
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
  return (
    upcoming < SEO_PRUNE.ARTIST_MIN_UPCOMING_EVENTS &&
    lifetime < SEO_PRUNE.ARTIST_MIN_LIFETIME_EVENTS
  );
}

export function shouldNoindexVenue({ lifetime, upcoming }: EventCounts): boolean {
  return (
    upcoming < SEO_PRUNE.VENUE_MIN_UPCOMING_EVENTS &&
    lifetime < SEO_PRUNE.VENUE_MIN_LIFETIME_EVENTS
  );
}

export function shouldNoindexCity({ lifetime, upcoming }: EventCounts): boolean {
  return (
    upcoming < SEO_PRUNE.CITY_MIN_UPCOMING_EVENTS &&
    lifetime < SEO_PRUNE.CITY_MIN_LIFETIME_EVENTS
  );
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
