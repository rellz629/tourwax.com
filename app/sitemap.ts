import { MetadataRoute } from 'next';
import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SITE_URL } from '@/lib/seo';

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

  return [...staticRoutes, ...artistRoutes];
}
