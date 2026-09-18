import type { MetadataRoute } from 'next';
import { db } from '@/db';
import { artists, events, venues, eventArtists } from '@/db/schema';
import { eq, gte, isNotNull, and } from 'drizzle-orm';
import { SITE_URL } from '@/lib/seo';
import { slugify } from '@/lib/slugify';
import { normalizeGenre, genreSlug } from '@/lib/genres';
import { getAllPosts } from '@/lib/blog';
import { getAllFestivals, getArchivedFestivals, findBrandFestival } from '@/lib/festivals';
import {
  shouldNoindexFestival,
  shouldNoindexGenre,
  shouldOmitArtistFromSitemap,
  shouldOmitVenueFromSitemap,
  shouldOmitCityFromSitemap,
} from '@/lib/seo-pruning';
import {
  getAllArtistIndexCounts,
  getAllVenueIndexCounts,
  getAllCityIndexCounts,
} from '@/lib/event-counts';

/**
 * Sitemap sections. /sitemap.xml is a sitemap index pointing at one file per
 * section (/sitemaps/<section>.xml), each an independent ISR entry.
 *
 * Why split: the single sitemap was ~700 KB and ISR bills reads and writes
 * per 8 KB unit, so every 30-minute regeneration cost ~87 units even when a
 * crawler only wanted the blog URLs. Sections regenerate independently and
 * only when requested. Google also prefers indexes once a site passes a few
 * thousand URLs.
 *
 * The noindex/omit predicates here are shared with the pages (lib/event-counts,
 * lib/seo-pruning) so sitemap inclusion and page robots meta never disagree.
 */
export const SITEMAP_SECTIONS = [
  'core',
  'artists',
  'cities',
  'genres',
  'venues',
  'festivals',
  'blog',
] as const;
export type SitemapSection = (typeof SITEMAP_SECTIONS)[number];

export function isSitemapSection(value: string): value is SitemapSection {
  return (SITEMAP_SECTIONS as readonly string[]).includes(value);
}

type Entries = MetadataRoute.Sitemap;

// ---- Static, time-based, insights, states, search ----
async function coreSection(now: Date): Promise<Entries> {
  const statesWithEvents = await db
    .selectDistinct({ state: venues.state })
    .from(venues)
    .innerJoin(events, eq(events.venueId, venues.id))
    .where(and(isNotNull(venues.state), gte(events.eventDate, now)));

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/artists`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
    { url: `${SITE_URL}/concerts/tonight`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: `${SITE_URL}/concerts/this-weekend`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/concerts/this-week`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/concerts/near-me`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/concerts/on-sale-today`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/insights`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/insights/most-toured-cities`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/insights/busiest-touring-artists`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/insights/top-concert-venues`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/insights/busiest-touring-months`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/insights/rising-artists`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/insights/affordable-concert-cities`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/insights/expensive-concert-cities`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    ...statesWithEvents
      .filter((row) => row.state)
      .map((row) => ({
        url: `${SITE_URL}/concerts/state/${slugify(row.state!)}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
    { url: `${SITE_URL}/search`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  ];
}

// ---- Artists (drop thin pages and pages with no upcoming events) ----
async function artistsSection(now: Date): Promise<Entries> {
  const [artistRows, countsByArtistId] = await Promise.all([
    db.select({
      id: artists.id,
      slug: artists.slug,
      updatedAt: artists.updatedAt,
    }).from(artists).where(eq(artists.isActive, true)),
    getAllArtistIndexCounts(now),
  ]);

  return artistRows
    .filter((a) => {
      const counts = countsByArtistId.get(a.id) ?? { lifetime: 0, upcoming: 0 };
      return !shouldOmitArtistFromSitemap(counts);
    })
    .map((a) => ({
      url: `${SITE_URL}/artists/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));
}

// ---- Cities (drop thin pages) ----
async function citiesSection(now: Date): Promise<Entries> {
  const countsByCitySlug = await getAllCityIndexCounts(now);
  return [
    { url: `${SITE_URL}/concerts`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    ...Array.from(countsByCitySlug.entries())
      .filter(([, counts]) => !shouldOmitCityFromSitemap(counts))
      .map(([slug]) => ({
        url: `${SITE_URL}/concerts/${slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
  ];
}

// ---- Genres (drop genres with almost nobody on tour) ----
// Same touring-artist definition as the genre page's noindex decision:
// distinct active artists in the genre with at least one upcoming event.
async function genresSection(now: Date): Promise<Entries> {
  const [allGenreArtists, touringArtistRows] = await Promise.all([
    db
      .select({ id: artists.id, genre: artists.genre })
      .from(artists)
      .where(eq(artists.isActive, true)),
    db
      .select({ artistId: eventArtists.artistId })
      .from(eventArtists)
      .innerJoin(events, eq(events.id, eventArtists.eventId))
      .where(gte(events.eventDate, now))
      .groupBy(eventArtists.artistId),
  ]);
  const touringArtistIds = new Set(touringArtistRows.map((r) => r.artistId));
  const touringCountBySlug = new Map<string, number>();
  for (const a of allGenreArtists) {
    const slug = genreSlug(normalizeGenre(a.genre));
    if (!touringCountBySlug.has(slug)) touringCountBySlug.set(slug, 0);
    if (touringArtistIds.has(a.id)) {
      touringCountBySlug.set(slug, touringCountBySlug.get(slug)! + 1);
    }
  }
  return [
    { url: `${SITE_URL}/tours`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    ...Array.from(touringCountBySlug.entries())
      .filter(([, touringArtistCount]) => !shouldNoindexGenre({ touringArtistCount }))
      .map(([slug]) => ({
        url: `${SITE_URL}/tours/${slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
  ];
}

// ---- Venues (drop thin pages and pages with no upcoming events) ----
async function venuesSection(now: Date): Promise<Entries> {
  const countsByVenueSlug = await getAllVenueIndexCounts(now);
  const venueEntries = Array.from(countsByVenueSlug.entries())
    .filter(([, counts]) => !shouldOmitVenueFromSitemap(counts));

  return [
    { url: `${SITE_URL}/venues`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    ...venueEntries.map(([slug, counts]) => ({
      url: `${SITE_URL}/venues/${slug}`,
      lastModified: new Date(),
      // Lower priority + slower changeFreq for past-only venues, mirroring the
      // archive treatment the page itself renders.
      changeFrequency: (counts.upcoming > 0 ? 'daily' : 'monthly') as 'daily' | 'monthly',
      priority: counts.upcoming > 0 ? 0.7 : 0.4,
    })),
  ];
}

// ---- Festivals (drop tour-stops and ad-hoc venue+date "festivals") ----
async function festivalsSection(): Promise<Entries> {
  const [upcomingFestivals, archivedFestivals] = await Promise.all([
    getAllFestivals(),
    getArchivedFestivals(),
  ]);

  function festivalShape(f: { name: string; artistCount: number; days: { date: string }[] }) {
    return {
      brandKey: findBrandFestival(f.name),
      artistCount: f.artistCount,
      daysCount: f.days.length,
    };
  }

  const indexableUpcoming = upcomingFestivals.filter((f) => !shouldNoindexFestival(festivalShape(f)));
  const indexableUpcomingSlugs = new Set(indexableUpcoming.map((f) => f.slug));
  const indexableArchived = archivedFestivals.filter(
    (f) => !shouldNoindexFestival(festivalShape(f)) && !indexableUpcomingSlugs.has(f.slug),
  );

  return [
    { url: `${SITE_URL}/festivals`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    ...indexableUpcoming.map((f) => ({
      url: `${SITE_URL}/festivals/${f.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...indexableArchived.map((f) => ({
      url: `${SITE_URL}/festivals/${f.slug}`,
      lastModified: new Date(f.date + 'T12:00:00'),
      changeFrequency: 'yearly' as const,
      priority: 0.4,
    })),
  ];
}

// ---- Blog ----
function blogSection(): Entries {
  const blogPosts = getAllPosts();
  return [
    { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    ...blogPosts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}

export async function getSitemapSection(section: SitemapSection): Promise<Entries> {
  const now = new Date();
  switch (section) {
    case 'core': return coreSection(now);
    case 'artists': return artistsSection(now);
    case 'cities': return citiesSection(now);
    case 'genres': return genresSection(now);
    case 'venues': return venuesSection(now);
    case 'festivals': return festivalsSection();
    case 'blog': return blogSection();
  }
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoDate(value: MetadataRoute.Sitemap[number]['lastModified']): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Serialize entries as a <urlset> document (same shape Next's sitemap.ts emits). */
export function renderUrlset(entries: Entries): string {
  const body = entries
    .map((e) => {
      const lastmod = isoDate(e.lastModified);
      return (
        '<url>' +
        `<loc>${xmlEscape(e.url)}</loc>` +
        (lastmod ? `<lastmod>${lastmod}</lastmod>` : '') +
        (e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : '') +
        (typeof e.priority === 'number' ? `<priority>${e.priority}</priority>` : '') +
        '</url>'
      );
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    body +
    '</urlset>'
  );
}

/** Serialize the <sitemapindex> that points at every section file. */
export function renderSitemapIndex(): string {
  const now = new Date().toISOString();
  const body = SITEMAP_SECTIONS.map(
    (s) => `<sitemap><loc>${SITE_URL}/sitemaps/${s}.xml</loc><lastmod>${now}</lastmod></sitemap>`,
  ).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    body +
    '</sitemapindex>'
  );
}
