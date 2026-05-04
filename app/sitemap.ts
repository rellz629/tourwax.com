import { MetadataRoute } from 'next';
import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, gte, isNotNull, and, sql } from 'drizzle-orm';
import { SITE_URL } from '@/lib/seo';
import { slugify } from '@/lib/slugify';
import { normalizeGenre, genreSlug } from '@/lib/genres';
import { getAllPosts } from '@/lib/blog';
import { getAllFestivals, getArchivedFestivals } from '@/lib/festivals';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Get all active artists
  const allArtists = await db
    .select({
      slug: artists.slug,
      updatedAt: artists.updatedAt,
    })
    .from(artists)
    .where(eq(artists.isActive, true));

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/artists`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ];

  // Dynamic artist routes
  const artistRoutes: MetadataRoute.Sitemap = allArtists.map((artist) => ({
    url: `${SITE_URL}/artists/${artist.slug}`,
    lastModified: artist.updatedAt,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // Get distinct cities with future events
  const now = new Date();
  const citiesWithEvents = await db
    .selectDistinct({ city: venues.city })
    .from(venues)
    .innerJoin(events, eq(events.venueId, venues.id))
    .where(and(
      isNotNull(venues.city),
      gte(events.eventDate, now)
    ));

  const cityRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/concerts`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...citiesWithEvents
    .filter((row) => row.city)
    .map((row) => ({
      url: `${SITE_URL}/concerts/${slugify(row.city!)}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];

  // Get distinct normalized genres from active artists
  const allGenreArtists = await db
    .select({ genre: artists.genre })
    .from(artists)
    .where(eq(artists.isActive, true));

  const genreSlugs = new Set<string>();
  for (const a of allGenreArtists) {
    genreSlugs.add(genreSlug(normalizeGenre(a.genre)));
  }

  const genreRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/tours`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...Array.from(genreSlugs).map((slug) => ({
      url: `${SITE_URL}/tours/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];

  // Get distinct venues with future events
  const venuesWithEvents = await db
    .selectDistinct({ venueName: venues.name })
    .from(venues)
    .innerJoin(events, eq(events.venueId, venues.id))
    .where(gte(events.eventDate, now));

  // Get venues with archived events (last 18 months) but no future events
  const archiveCutoff = new Date();
  archiveCutoff.setMonth(archiveCutoff.getMonth() - 18);
  const venuesWithPastEvents = await db
    .selectDistinct({ venueName: venues.name })
    .from(venues)
    .innerJoin(events, eq(events.venueId, venues.id))
    .where(and(gte(events.eventDate, archiveCutoff), sql`${events.eventDate} < ${now.toISOString()}`));

  const upcomingVenueSlugs = new Set(venuesWithEvents.map((r) => slugify(r.venueName)));

  const venueRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/venues`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...venuesWithEvents.map((row) => ({
      url: `${SITE_URL}/venues/${slugify(row.venueName)}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...venuesWithPastEvents
      .filter((row) => !upcomingVenueSlugs.has(slugify(row.venueName)))
      .map((row) => ({
        url: `${SITE_URL}/venues/${slugify(row.venueName)}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.4,
      })),
  ];

  // Blog routes
  const blogPosts = getAllPosts();
  const blogRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...blogPosts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];

  // Insights routes
  const insightsRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/insights`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/insights/most-toured-cities`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/insights/busiest-touring-artists`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/insights/top-concert-venues`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  // Festival routes (upcoming + archived)
  const [upcomingFestivals, archivedFestivals] = await Promise.all([
    getAllFestivals(),
    getArchivedFestivals(),
  ]);
  const archivedSeen = new Set(upcomingFestivals.map((f) => f.slug));
  const festivalRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/festivals`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...upcomingFestivals.map((festival) => ({
      url: `${SITE_URL}/festivals/${festival.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...archivedFestivals
      .filter((festival) => !archivedSeen.has(festival.slug))
      .map((festival) => ({
        url: `${SITE_URL}/festivals/${festival.slug}`,
        lastModified: new Date(festival.date + 'T12:00:00'),
        changeFrequency: 'yearly' as const,
        priority: 0.4,
      })),
  ];

  // Time-based routes
  const timeRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/concerts/tonight`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/concerts/this-weekend`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/concerts/this-week`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // State routes
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

  // Search route
  const searchRoute: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];

  return [...staticRoutes, ...artistRoutes, ...cityRoutes, ...genreRoutes, ...venueRoutes, ...blogRoutes, ...insightsRoutes, ...festivalRoutes, ...timeRoutes, ...stateRoutes, ...searchRoute];
}
