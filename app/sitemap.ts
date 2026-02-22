import { MetadataRoute } from 'next';
import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, gte, isNotNull, and } from 'drizzle-orm';
import { SITE_URL } from '@/lib/seo';
import { slugify } from '@/lib/slugify';
import { normalizeGenre, genreSlug } from '@/lib/genres';

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

  const cityRoutes: MetadataRoute.Sitemap = citiesWithEvents
    .filter((row) => row.city)
    .map((row) => ({
      url: `${SITE_URL}/concerts/${slugify(row.city!)}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

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
  ];

  return [...staticRoutes, ...artistRoutes, ...cityRoutes, ...genreRoutes, ...venueRoutes];
}
