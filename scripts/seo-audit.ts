/**
 * SEO Audit: cross-reference Google Search Console "Crawled - currently not
 * indexed" and "Discovered - currently not indexed" exports with the production
 * database and current festival classifier output, then emit per-type CSVs of
 * URLs to prune (noindex / 410 / sitemap-remove) plus a summary report.
 *
 * Run:  npm run audit:seo
 *
 * Inputs (read from `Traffic Reports/`):
 *   - tourwax.com-Coverage-Drilldown-2026-05-06/Table.csv          (Crawled - not indexed)
 *   - tourwax.com-Coverage-Drilldown-2026-05-06 (1)/Table.csv      (Discovered - not indexed)
 *
 * Outputs (written to `audit-output/`):
 *   - summary.txt
 *   - artists-prune.csv
 *   - venues-prune.csv
 *   - cities-prune.csv
 *   - festivals-prune.csv
 *   - slugify-unicode-issues.csv
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { db } from '@/db';
import { artists, events, venues, eventArtists } from '@/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import { slugify } from '@/lib/slugify';
import { getAllFestivals, getArchivedFestivals, findBrandFestival } from '@/lib/festivals';

// ============================================================================
// Thresholds (tune in one place)
// ============================================================================

// Mirrors lib/seo-pruning.ts SEO_PRUNE constants. Bump in lockstep.
const THRESHOLDS = {
  /** Artist needs at least this many upcoming OR this many lifetime events to index. */
  ARTIST_MIN_LIFETIME_EVENTS: 5,
  ARTIST_MIN_UPCOMING_EVENTS: 2,
  /** Venue needs at least this many upcoming OR this many lifetime events to index. */
  VENUE_MIN_LIFETIME_EVENTS: 5,
  VENUE_MIN_UPCOMING_EVENTS: 1,
  /** City needs at least this many upcoming OR this many lifetime events to index. */
  CITY_MIN_LIFETIME_EVENTS: 10,
  CITY_MIN_UPCOMING_EVENTS: 5,
  /** Festival without a brand keyword needs at least this many distinct artists OR at least this many days. */
  FESTIVAL_MIN_ARTISTS_NO_BRAND: 5,
  FESTIVAL_MIN_DAYS_NO_BRAND: 2,
};

// Names that suggest the row is not actually an artist (festival, tour package, tribute act, etc.).
const NON_ARTIST_NAME_FLAGS = [
  'festival', ' fest', 'fest ', 'tribute', 'concert', 'presents',
  'tour bus', 'classical', 'symphony',
];

// ============================================================================
// GSC CSV loading
// ============================================================================

const REPORTS_DIR = path.join(process.cwd(), 'Traffic Reports', '5-31-2026');
const NOT_FOUND_404 = path.join(
  REPORTS_DIR,
  'tourwax.com-Coverage-Drilldown-2026-05-31',
  'Table.csv',
);
const CRAWLED_NOT_INDEXED = path.join(
  REPORTS_DIR,
  'tourwax.com-Coverage-Drilldown-2026-05-31 (1)',
  'Table.csv',
);
const DISCOVERED_NOT_INDEXED = path.join(
  REPORTS_DIR,
  'tourwax.com-Coverage-Drilldown-2026-05-31 (2)',
  'Table.csv',
);
const OUTPUT_DIR = path.join(process.cwd(), 'audit-output');

function loadGscUrls(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Missing: ${filePath}`);
    return [];
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return raw
    .split('\n')
    .slice(1) // header
    .map((l) => l.split(',')[0]?.trim())
    .filter((u): u is string => !!u && u.startsWith('https://'));
}

interface GscIndex {
  artists: Set<string>; // slugs
  venues: Set<string>;
  festivals: Set<string>;
  cities: Set<string>;
  blog: Set<string>;
  tours: Set<string>;
  raw: Set<string>; // full URL set
  crawled: Set<string>; // urls in "Crawled - not indexed"
  discovered: Set<string>; // urls in "Discovered - not indexed"
}

function indexGscUrls(crawledUrls: string[], discoveredUrls: string[]): GscIndex {
  const idx: GscIndex = {
    artists: new Set(),
    venues: new Set(),
    festivals: new Set(),
    cities: new Set(),
    blog: new Set(),
    tours: new Set(),
    raw: new Set(),
    crawled: new Set(crawledUrls),
    discovered: new Set(discoveredUrls),
  };
  for (const url of [...crawledUrls, ...discoveredUrls]) {
    idx.raw.add(url);
    const pathname = url.replace(/^https?:\/\/(www\.)?tourwax\.com/, '');
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length < 2) continue;
    const [type, slug] = parts;
    if (type === 'artists') idx.artists.add(slug);
    else if (type === 'venues') idx.venues.add(slug);
    else if (type === 'festivals') idx.festivals.add(slug);
    else if (type === 'concerts') idx.cities.add(slug);
    else if (type === 'blog') idx.blog.add(slug);
    else if (type === 'tours') idx.tours.add(slug);
  }
  return idx;
}

// ============================================================================
// CSV writer (RFC4180-ish)
// ============================================================================

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filename: string, headers: string[], rows: unknown[][]) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const lines = [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))];
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), lines.join('\n') + '\n');
}

// ============================================================================
// Slugify Unicode bug detection
// ============================================================================

/**
 * Better slugify that transliterates a small set of Latin-extended letters that
 * the production slugify currently strips entirely. Used here for diagnosis only.
 */
function slugifyTransliterated(s: string): string {
  const map: Record<string, string> = {
    ł: 'l', Ł: 'L',
    ø: 'o', Ø: 'O',
    æ: 'ae', Æ: 'AE',
    œ: 'oe', Œ: 'OE',
    ß: 'ss',
    đ: 'd', Đ: 'D',
    þ: 'th', Þ: 'Th',
  };
  return slugify(s.replace(/[łŁøØæÆœŒßđĐþÞ]/g, (c) => map[c] ?? c));
}

// ============================================================================
// DB queries
// ============================================================================

interface ArtistStats {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  lifetime: number;
  upcoming: number;
  hasBio: boolean;
  hasImage: boolean;
  hasSpotifyId: boolean;
}

async function getArtistStats(now: Date): Promise<ArtistStats[]> {
  const rows = await db
    .select({
      id: artists.id,
      slug: artists.slug,
      name: artists.name,
      isActive: artists.isActive,
      bio: artists.bio,
      imageUrl: artists.imageUrl,
      spotifyId: artists.spotifyId,
      lifetime: sql<number>`count(${eventArtists.eventId})::int`,
      upcoming: sql<number>`count(${eventArtists.eventId}) filter (where ${events.eventDate} >= ${now.toISOString()})::int`,
    })
    .from(artists)
    .leftJoin(eventArtists, eq(eventArtists.artistId, artists.id))
    .leftJoin(events, eq(events.id, eventArtists.eventId))
    .groupBy(artists.id, artists.slug, artists.name, artists.isActive, artists.bio, artists.imageUrl, artists.spotifyId);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    isActive: r.isActive,
    lifetime: r.lifetime,
    upcoming: r.upcoming,
    hasBio: !!r.bio && r.bio.length > 50,
    hasImage: !!r.imageUrl,
    hasSpotifyId: !!r.spotifyId,
  }));
}

interface VenueStats {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  country: string | null;
  lifetime: number;
  upcoming: number;
}

async function getVenueStats(now: Date): Promise<VenueStats[]> {
  const rows = await db
    .select({
      id: venues.id,
      name: venues.name,
      city: venues.city,
      state: venues.state,
      country: venues.country,
      lifetime: sql<number>`count(${events.id})::int`,
      upcoming: sql<number>`count(${events.id}) filter (where ${events.eventDate} >= ${now.toISOString()})::int`,
    })
    .from(venues)
    .leftJoin(events, eq(events.venueId, venues.id))
    .groupBy(venues.id, venues.name, venues.city, venues.state, venues.country);
  return rows.map((r) => ({ ...r, slug: slugify(r.name) }));
}

interface CityStats {
  city: string;
  state: string | null;
  slug: string;
  lifetime: number;
  upcoming: number;
}

async function getCityStats(now: Date): Promise<CityStats[]> {
  const rows = await db
    .select({
      city: venues.city,
      state: venues.state,
      lifetime: sql<number>`count(${events.id})::int`,
      upcoming: sql<number>`count(${events.id}) filter (where ${events.eventDate} >= ${now.toISOString()})::int`,
    })
    .from(venues)
    .leftJoin(events, eq(events.venueId, venues.id))
    .where(sql`${venues.city} is not null`)
    .groupBy(venues.city, venues.state);
  return rows
    .filter((r): r is { city: string; state: string | null; lifetime: number; upcoming: number } => !!r.city)
    .map((r) => ({ ...r, slug: slugify(r.city) }));
}

// ============================================================================
// Recommendation logic
// ============================================================================

function nameSuggestsNonArtist(name: string): boolean {
  const lower = name.toLowerCase();
  return NON_ARTIST_NAME_FLAGS.some((flag) => lower.includes(flag));
}

function recommendArtist(a: ArtistStats): { action: string; reason: string } | null {
  const lacksMetadata = !a.hasBio && !a.hasImage && !a.hasSpotifyId;
  const looksFake = nameSuggestsNonArtist(a.name);
  const noEvents =
    a.upcoming < THRESHOLDS.ARTIST_MIN_UPCOMING_EVENTS &&
    a.lifetime < THRESHOLDS.ARTIST_MIN_LIFETIME_EVENTS;

  // Junk import: looks like a non-artist + no curated metadata + no events.
  if (looksFake && lacksMetadata && noEvents) {
    return {
      action: 'set isActive=false (junk import)',
      reason: 'name pattern + zero metadata + no events',
    };
  }
  // Suspicious name even with metadata — flag for human review.
  if (looksFake) {
    return {
      action: 'review (likely not an artist)',
      reason: 'name contains festival/tribute/concert/presents pattern',
    };
  }
  // Sparse data + no events: imported but never enriched.
  if (noEvents && lacksMetadata) {
    return {
      action: 'set isActive=false (thin import)',
      reason: 'no events, no bio, no image, no spotifyId',
    };
  }
  // Real-looking artist with no events: noindex temporarily, do NOT deactivate.
  // We want Drake/Paramore/etc. to come back when events return.
  if (noEvents) {
    return {
      action: 'noindex temporarily (until events return)',
      reason: `${a.lifetime} lifetime / ${a.upcoming} upcoming, but has metadata`,
    };
  }
  return null;
}

function recommendVenue(v: VenueStats): { action: string; reason: string } | null {
  if (
    v.upcoming < THRESHOLDS.VENUE_MIN_UPCOMING_EVENTS &&
    v.lifetime < THRESHOLDS.VENUE_MIN_LIFETIME_EVENTS
  ) {
    return {
      action: 'noindex / drop from sitemap',
      reason: `${v.upcoming} upcoming / ${v.lifetime} lifetime`,
    };
  }
  return null;
}

function recommendCity(c: CityStats): { action: string; reason: string } | null {
  if (
    c.upcoming < THRESHOLDS.CITY_MIN_UPCOMING_EVENTS &&
    c.lifetime < THRESHOLDS.CITY_MIN_LIFETIME_EVENTS
  ) {
    return {
      action: 'noindex / drop from sitemap',
      reason: `${c.upcoming} upcoming / ${c.lifetime} lifetime`,
    };
  }
  return null;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('📥 Loading GSC drilldown exports...');
  const crawled = loadGscUrls(CRAWLED_NOT_INDEXED);
  const discovered = loadGscUrls(DISCOVERED_NOT_INDEXED);
  const notFound = loadGscUrls(NOT_FOUND_404);
  const gsc = indexGscUrls(crawled, discovered);
  console.log(`   crawled-not-indexed:    ${crawled.length} URLs`);
  console.log(`   discovered-not-indexed: ${discovered.length} URLs`);
  console.log(`   not-found-404:          ${notFound.length} URLs`);
  console.log(`   by type (not-indexed buckets):`);
  console.log(`     artists=${gsc.artists.size} venues=${gsc.venues.size} festivals=${gsc.festivals.size} concerts=${gsc.cities.size} blog=${gsc.blog.size} tours=${gsc.tours.size}`);

  const now = new Date();

  console.log('\n📊 Querying DB...');
  const [artistStats, venueStats, cityStats, upcomingFests, archivedFests] = await Promise.all([
    getArtistStats(now),
    getVenueStats(now),
    getCityStats(now),
    getAllFestivals(),
    getArchivedFestivals(),
  ]);
  console.log(`   artists: ${artistStats.length}`);
  console.log(`   venues:  ${venueStats.length}`);
  console.log(`   cities:  ${cityStats.length}`);
  console.log(`   festivals (upcoming + archived): ${upcomingFests.length} + ${archivedFests.length}`);

  // ---- Artists ----
  const artistRows: unknown[][] = [];
  const artistDbSlugs = new Set<string>();
  let artistsRecommended = 0;
  let artistsRecommendedAndInGsc = 0;
  let artistsInGscAndInDb = 0;
  for (const a of artistStats) {
    artistDbSlugs.add(a.slug);
    const inGsc = gsc.artists.has(a.slug);
    const rec = recommendArtist(a);
    if (inGsc) artistsInGscAndInDb++;
    if (!rec && !inGsc) continue;
    if (rec) artistsRecommended++;
    if (rec && inGsc) artistsRecommendedAndInGsc++;
    artistRows.push([
      a.slug,
      a.name,
      a.lifetime,
      a.upcoming,
      a.isActive,
      a.hasBio,
      a.hasImage,
      a.hasSpotifyId,
      inGsc ? (gsc.crawled.has(`https://www.tourwax.com/artists/${a.slug}`) ? 'crawled-not-indexed' : 'discovered-not-indexed') : '',
      rec?.action ?? '',
      rec?.reason ?? '',
    ]);
  }
  artistRows.sort((a, b) => Number(b[8] !== '') - Number(a[8] !== '') || Number(a[2]) - Number(b[2]));
  const artistsGscPhantom = Array.from(gsc.artists).filter((s) => !artistDbSlugs.has(s));
  writeCsv(
    'artists-prune.csv',
    ['slug', 'name', 'lifetime_events', 'upcoming_events', 'is_active', 'has_bio', 'has_image', 'has_spotify_id', 'gsc_status', 'recommendation', 'reason'],
    artistRows,
  );

  // ---- Venues ----
  const venueRows: unknown[][] = [];
  const venueDbSlugs = new Set<string>();
  let venuesRecommended = 0;
  let venuesRecommendedAndInGsc = 0;
  let venuesInGscAndInDb = 0;
  for (const v of venueStats) {
    venueDbSlugs.add(v.slug);
    const inGsc = gsc.venues.has(v.slug);
    const rec = recommendVenue(v);
    if (inGsc) venuesInGscAndInDb++;
    if (!rec && !inGsc) continue;
    if (rec) venuesRecommended++;
    if (rec && inGsc) venuesRecommendedAndInGsc++;
    venueRows.push([
      v.slug,
      v.name,
      v.city ?? '',
      v.state ?? '',
      v.country ?? '',
      v.lifetime,
      v.upcoming,
      inGsc ? (gsc.crawled.has(`https://www.tourwax.com/venues/${v.slug}`) ? 'crawled-not-indexed' : 'discovered-not-indexed') : '',
      rec?.action ?? '',
      rec?.reason ?? '',
    ]);
  }
  venueRows.sort((a, b) => Number(b[7] !== '') - Number(a[7] !== '') || Number(a[5]) - Number(b[5]));
  writeCsv(
    'venues-prune.csv',
    ['slug', 'name', 'city', 'state', 'country', 'lifetime_events', 'upcoming_events', 'gsc_status', 'recommendation', 'reason'],
    venueRows,
  );
  const venuesGscPhantom = Array.from(gsc.venues).filter((s) => !venueDbSlugs.has(s));

  // ---- Cities ----
  const cityRows: unknown[][] = [];
  const cityDbSlugs = new Set<string>();
  let citiesRecommended = 0;
  let citiesRecommendedAndInGsc = 0;
  let citiesInGscAndInDb = 0;
  // Aggregate: cities table is per-(city,state); but slugs collide on city only.
  // Roll up to city-slug for the sitemap-aligned view.
  const bySlug = new Map<string, { lifetime: number; upcoming: number; cityNames: Set<string> }>();
  for (const c of cityStats) {
    const cur = bySlug.get(c.slug) ?? { lifetime: 0, upcoming: 0, cityNames: new Set() };
    cur.lifetime += c.lifetime;
    cur.upcoming += c.upcoming;
    cur.cityNames.add(`${c.city}${c.state ? `, ${c.state}` : ''}`);
    bySlug.set(c.slug, cur);
  }
  for (const [slug, agg] of bySlug.entries()) {
    cityDbSlugs.add(slug);
    const inGsc = gsc.cities.has(slug);
    const rec = recommendCity({ city: '', state: null, slug, lifetime: agg.lifetime, upcoming: agg.upcoming });
    if (inGsc) citiesInGscAndInDb++;
    if (!rec && !inGsc) continue;
    if (rec) citiesRecommended++;
    if (rec && inGsc) citiesRecommendedAndInGsc++;
    cityRows.push([
      slug,
      Array.from(agg.cityNames).join(' | '),
      agg.lifetime,
      agg.upcoming,
      inGsc ? (gsc.crawled.has(`https://www.tourwax.com/concerts/${slug}`) ? 'crawled-not-indexed' : 'discovered-not-indexed') : '',
      rec?.action ?? '',
      rec?.reason ?? '',
    ]);
  }
  cityRows.sort((a, b) => Number(b[4] !== '') - Number(a[4] !== '') || Number(a[2]) - Number(b[2]));
  writeCsv(
    'cities-prune.csv',
    ['slug', 'city_names', 'lifetime_events', 'upcoming_events', 'gsc_status', 'recommendation', 'reason'],
    cityRows,
  );
  const citiesGscPhantom = Array.from(gsc.cities).filter((s) => !cityDbSlugs.has(s) && !['tonight', 'this-weekend', 'this-week', 'state', 'near-me'].includes(s));

  // ---- Festivals (upcoming + archived) ----
  const festRows: unknown[][] = [];
  const festDbSlugs = new Set<string>();
  let festsRecommended = 0;
  let festsRecommendedAndInGsc = 0;
  let festsInGscAndInDb = 0;
  const allFests = [...upcomingFests, ...archivedFests];
  for (const f of allFests) {
    const brand = findBrandFestival(f.name);
    const isReal = !!brand
      || f.artistCount >= THRESHOLDS.FESTIVAL_MIN_ARTISTS_NO_BRAND
      || f.days.length >= THRESHOLDS.FESTIVAL_MIN_DAYS_NO_BRAND;

    const slugVariants = [f.slug, f.legacySlug, ...f.legacySlugs];
    for (const s of slugVariants) festDbSlugs.add(s);
    const inGsc = slugVariants.some((s) => gsc.festivals.has(s));
    if (isReal && !inGsc) continue; // healthy real festival, ignore

    let action = '';
    let reason = '';
    if (!isReal) {
      action = '410 / drop from sitemap (or add brand keyword to BRAND_FESTIVAL_KEYWORDS)';
      reason = `not a real festival: brand=${brand ?? 'none'}, artists=${f.artistCount}, days=${f.days.length}`;
      festsRecommended++;
      if (inGsc) festsRecommendedAndInGsc++;
    } else {
      action = 'keep, but request reindex';
      reason = 'real festival in not-indexed bucket';
    }
    if (inGsc) festsInGscAndInDb++;

    festRows.push([
      f.slug,
      f.name,
      f.venue.name,
      f.date,
      f.endDate,
      f.artistCount,
      f.days.length,
      brand ?? '',
      isReal ? 'real' : 'not-real',
      inGsc ? 'in-gsc-not-indexed' : '',
      action,
      reason,
    ]);
  }
  festRows.sort((a, b) => Number(b[9] !== '') - Number(a[9] !== '') || String(a[8]).localeCompare(String(b[8])));
  writeCsv(
    'festivals-prune.csv',
    [
      'slug', 'name', 'venue', 'start_date', 'end_date',
      'artist_count', 'day_count', 'brand_match', 'classification',
      'gsc_status', 'recommendation', 'reason',
    ],
    festRows,
  );
  const festsGscPhantom = Array.from(gsc.festivals).filter((s) => !festDbSlugs.has(s));

  // ---- Phantom URLs (in GSC but no DB row) ----
  const phantomRows: unknown[][] = [
    ...artistsGscPhantom.map((s) => ['/artists/' + s, gsc.crawled.has(`https://www.tourwax.com/artists/${s}`) ? 'crawled-not-indexed' : 'discovered-not-indexed']),
    ...venuesGscPhantom.map((s) => ['/venues/' + s, gsc.crawled.has(`https://www.tourwax.com/venues/${s}`) ? 'crawled-not-indexed' : 'discovered-not-indexed']),
    ...citiesGscPhantom.map((s) => ['/concerts/' + s, gsc.crawled.has(`https://www.tourwax.com/concerts/${s}`) ? 'crawled-not-indexed' : 'discovered-not-indexed']),
    ...festsGscPhantom.map((s) => ['/festivals/' + s, gsc.crawled.has(`https://www.tourwax.com/festivals/${s}`) ? 'crawled-not-indexed' : 'discovered-not-indexed']),
  ];
  writeCsv(
    'phantom-urls.csv',
    ['url', 'gsc_status'],
    phantomRows,
  );

  // ---- 404 redirect candidates (URLs Google had indexed and now hit 404) ----
  // Each row gets a suggested action: 410 (gone, no replacement), 301-redirect
  // (closest live entity), or review (slug change candidate).
  const fourOhFourRows: unknown[][] = [];
  for (const url of notFound) {
    const pathname = url.replace(/^https?:\/\/(www\.)?tourwax\.com/, '');
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      fourOhFourRows.push([url, '', '', '410', 'top-level URL no longer exists']);
      continue;
    }
    const [type, slug] = parts;

    if (type === 'artists') {
      const liveBySlug = artistStats.find((a) => a.slug === slug);
      if (liveBySlug) {
        fourOhFourRows.push([url, 'artist', slug, 'investigate', 'slug matches DB but URL 404s — check page render']);
        continue;
      }
      // Slug-change candidate: any artist whose transliterated slug matches?
      const transliterated = artistStats.find((a) => slugifyTransliterated(a.name) === slug);
      if (transliterated) {
        fourOhFourRows.push([url, 'artist', slug, `301 /artists/${transliterated.slug}`, `slug changed: ${transliterated.name}`]);
        continue;
      }
      fourOhFourRows.push([url, 'artist', slug, '410', 'no matching artist in DB']);
    } else if (type === 'venues') {
      const liveBySlug = venueStats.find((v) => v.slug === slug);
      if (liveBySlug) {
        fourOhFourRows.push([url, 'venue', slug, 'investigate', 'slug matches DB but URL 404s']);
        continue;
      }
      fourOhFourRows.push([url, 'venue', slug, '410', 'no matching venue in DB']);
    } else if (type === 'festivals') {
      fourOhFourRows.push([url, 'festival', slug, '410', 'festival likely pruned by classifier or dedup']);
    } else if (type === 'concerts') {
      fourOhFourRows.push([url, 'city', slug, 'investigate', 'city URL 404 — check route']);
    } else {
      fourOhFourRows.push([url, type, slug, 'investigate', 'unusual 404 path']);
    }
  }
  writeCsv(
    '404-redirects.csv',
    ['url', 'type', 'slug', 'recommended_action', 'reason'],
    fourOhFourRows,
  );

  // ---- Slugify unicode issues ----
  const unicodeRows: unknown[][] = [];
  const seenCitySlugs = new Set<string>();
  for (const c of cityStats) {
    if (seenCitySlugs.has(c.city)) continue;
    seenCitySlugs.add(c.city);
    const fixed = slugifyTransliterated(c.city);
    if (fixed !== c.slug) {
      unicodeRows.push([c.city, c.slug, fixed, c.lifetime, c.upcoming]);
    }
  }
  for (const v of venueStats) {
    const fixed = slugifyTransliterated(v.name);
    if (fixed !== v.slug) {
      unicodeRows.push([v.name, v.slug, fixed, v.lifetime, v.upcoming]);
    }
  }
  writeCsv(
    'slugify-unicode-issues.csv',
    ['original_name', 'current_slug', 'fixed_slug', 'lifetime_events', 'upcoming_events'],
    unicodeRows,
  );

  // ---- Summary ----
  const totalRejected = gsc.raw.size;
  const summary = `
SEO Audit — ${new Date().toISOString()}
================================================================

GSC inputs
  Crawled - not indexed:    ${crawled.length} URLs (capped at GSC's 1,000 export limit)
  Discovered - not indexed: ${discovered.length} URLs (capped at 1,000)
  Not found (404):          ${notFound.length} URLs
  Combined unique not-indexed URLs: ${totalRejected}

Distribution by path:
  /artists  ${gsc.artists.size}
  /venues   ${gsc.venues.size}
  /festivals ${gsc.festivals.size}
  /concerts ${gsc.cities.size}
  /blog     ${gsc.blog.size}
  /tours    ${gsc.tours.size}

Database surface:
  artists:  ${artistStats.length}
  venues:   ${venueStats.length}
  cities:   ${cityStats.length}
  festivals (upcoming + archived): ${upcomingFests.length + archivedFests.length}

Pruning recommendations (using thresholds at top of script):
                                 |  rule-match  |  in-GSC  |  rule ∩ GSC  | GSC phantom (no DB row)
  Artists  → action varies      |     ${String(artistsRecommended).padStart(6)}   |  ${String(artistsInGscAndInDb).padStart(5)}  |    ${String(artistsRecommendedAndInGsc).padStart(5)}    |   ${artistsGscPhantom.length}
  Venues   → noindex/drop       |     ${String(venuesRecommended).padStart(6)}   |  ${String(venuesInGscAndInDb).padStart(5)}  |    ${String(venuesRecommendedAndInGsc).padStart(5)}    |   ${venuesGscPhantom.length}
  Cities   → noindex/drop       |     ${String(citiesRecommended).padStart(6)}   |  ${String(citiesInGscAndInDb).padStart(5)}  |    ${String(citiesRecommendedAndInGsc).padStart(5)}    |   ${citiesGscPhantom.length}
  Festivals → 410/drop          |     ${String(festsRecommended).padStart(6)}   |  ${String(festsInGscAndInDb).padStart(5)}  |    ${String(festsRecommendedAndInGsc).padStart(5)}    |   ${festsGscPhantom.length}
  Slugify Unicode mismatches:   ${unicodeRows.length}

Legend:
  rule-match     = DB rows the script's threshold rule says to prune
  in-GSC         = DB rows that ALSO appear in the GSC not-indexed buckets
  rule ∩ GSC     = the high-confidence intersection (Google rejected AND threshold matched)
  GSC phantom    = URLs Google indexed/discovered that no longer exist in the DB at all
                   (these are pure 404s; either let them die or 410 explicitly)

Files written to ${OUTPUT_DIR}:
  artists-prune.csv          (rows in GSC bucket OR matching a prune rule)
  venues-prune.csv           (same filter)
  cities-prune.csv           (same filter)
  festivals-prune.csv        (rows in GSC bucket OR not-real-festival classification)
  phantom-urls.csv           (GSC URLs with no matching DB row — handle as 410 or sitemap-remove)
  404-redirects.csv          (GSC "Not found" bucket with suggested 410 / 301 / investigate action)
  slugify-unicode-issues.csv (cities/venues whose slug differs from a transliterated slug)

Thresholds in use (edit at top of scripts/seo-audit.ts to tune):
${JSON.stringify(THRESHOLDS, null, 2)}
`;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.txt'), summary);
  console.log(summary);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
