import { MetadataRoute } from 'next';
import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, gte, isNotNull, and } from 'drizzle-orm';
import { SITE_URL } from '@/lib/seo';
import { slugify } from '@/lib/slugify';
import { normalizeGenre, genreSlug } from '@/lib/genres';
import { getAllPosts } from '@/lib/blog';
import { getAllFestivals, getArchivedFestivals, findBrandFestival } from '@/lib/festivals';
import {
  shouldNoindexArtist,
  shouldNoindexVenue,
  shouldNoindexCity,
  shouldNoindexFestival,
} from '@/lib/seo-pruning';
import {
  getAllArtistIndexCounts,
  getAllVenueIndexCounts,
  getAllCityIndexCounts,
} from '@/lib/event-counts';

// Regenerate on the same cadence as the pages. A build-time-only sitemap
// drifts out of sync with the pages' noindex decisions as event dates pass.
export const revalidate = 1800;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // ---- Aggregate event counts (per-artist, per-venue, per-city) ----
  // lib/event-counts.ts is the shared source of truth: the same queries drive
  // the pages' noindex decisions, so sitemap inclusion and page robots meta
  // can never disagree.
  const [
    artistRows,
    countsByArtistId,
    countsByVenueSlug,
    countsByCitySlug,
  ] = await Promise.all([
    db.select({
      id: artists.id,
      slug: artists.slug,
      updatedAt: artists.updatedAt,
    }).from(artists).where(eq(artists.isActive, true)),
    getAllArtistIndexCounts(now),
    getAllVenueIndexCounts(now),
    getAllCityIndexCounts(now),
  ]);

  // ---- Static routes ----
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/artists`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
  ];

  // ---- Artists (drop thin pages) ----
  const artistRoutes: MetadataRoute.Sitemap = artistRows
    .filter((a) => {
      const counts = countsByArtistId.get(a.id) ?? { lifetime: 0, upcoming: 0 };
      return !shouldNoindexArtist(counts);
    })
    .map((a) => ({
      url: `${SITE_URL}/artists/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

  // ---- Cities (drop thin pages) ----
  const cityRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/concerts`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    ...Array.from(countsByCitySlug.entries())
      .filter(([, counts]) => !shouldNoindexCity(counts))
      .map(([slug]) => ({
        url: `${SITE_URL}/concerts/${slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
  ];

  // ---- Genres ----
  const allGenreArtists = await db
    .select({ genre: artists.genre })
    .from(artists)
    .where(eq(artists.isActive, true));
  const genreSlugs = new Set<string>();
  for (const a of allGenreArtists) {
    genreSlugs.add(genreSlug(normalizeGenre(a.genre)));
  }
  const genreRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/tours`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    ...Array.from(genreSlugs).map((slug) => ({
      url: `${SITE_URL}/tours/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];

  // ---- Venues (drop thin pages, keep archived treatment for surviving ones) ----
  const venueEntries = Array.from(countsByVenueSlug.entries())
    .filter(([, counts]) => !shouldNoindexVenue(counts));

  const venueRoutes: MetadataRoute.Sitemap = [
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

  // ---- Blog ----
  const blogPosts = getAllPosts();
  const blogRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    ...blogPosts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];

  // ---- Insights ----
  const insightsRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/insights`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/insights/most-toured-cities`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/insights/busiest-touring-artists`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/insights/top-concert-venues`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/insights/busiest-touring-months`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/insights/rising-artists`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/insights/affordable-concert-cities`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/insights/expensive-concert-cities`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
  ];

  // ---- Festivals (drop tour-stops and ad-hoc venue+date "festivals") ----
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

  const festivalRoutes: MetadataRoute.Sitemap = [
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

  // ---- Time-based ----
  const timeRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/concerts/tonight`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: `${SITE_URL}/concerts/this-weekend`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/concerts/this-week`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/concerts/near-me`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/concerts/on-sale-today`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
  ];

  // ---- States ----
  const statesWithEvents = await db
    .selectDistinct({ state: venues.state })
    .from(venues)
    .innerJoin(events, eq(events.venueId, venues.id))
    .where(and(isNotNull(venues.state), gte(events.eventDate, now)));
  const stateRoutes: MetadataRoute.Sitemap = statesWithEvents
    .filter((row) => row.state)
    .map((row) => ({
      url: `${SITE_URL}/concerts/state/${slugify(row.state!)}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

  // ---- Search ----
  const searchRoute: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/search`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  ];

  return [
    ...staticRoutes,
    ...artistRoutes,
    ...cityRoutes,
    ...genreRoutes,
    ...venueRoutes,
    ...blogRoutes,
    ...insightsRoutes,
    ...festivalRoutes,
    ...timeRoutes,
    ...stateRoutes,
    ...searchRoute,
  ];
}
