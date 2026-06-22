import { db } from '@/db';
import { artists, events, eventArtists } from '@/db/schema';
import { eq, gte, sql } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { generateToursIndexMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import TopStrip from '@/components/TopStrip';
import { getTopTours } from '@/lib/top-lists';
import { normalizeGenre, genreSlug } from '@/lib/genres';

export const dynamic = 'force-static';
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return generateToursIndexMetadata();
}

export default async function ToursPage() {
  const now = new Date();

  const allArtists = await db
    .select({
      id: artists.id,
      genre: artists.genre,
    })
    .from(artists)
    .where(eq(artists.isActive, true));

  // Count future events per artist
  const eventCounts = await db
    .select({
      artistId: eventArtists.artistId,
      count: sql<number>`count(*)::int`,
    })
    .from(eventArtists)
    .innerJoin(events, eq(events.id, eventArtists.eventId))
    .where(gte(events.eventDate, now))
    .groupBy(eventArtists.artistId);

  const eventCountMap = new Map(eventCounts.map((r) => [r.artistId, r.count]));

  // Group by normalized genre
  const genreData: Record<string, { artistCount: number; eventCount: number }> = {};

  for (const artist of allArtists) {
    const genre = normalizeGenre(artist.genre);
    if (!genreData[genre]) genreData[genre] = { artistCount: 0, eventCount: 0 };
    genreData[genre].artistCount++;
    genreData[genre].eventCount += eventCountMap.get(artist.id) || 0;
  }

  const genres = Object.entries(genreData)
    .sort((a, b) => b[1].eventCount - a[1].eventCount);

  const topTours = await getTopTours();

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Tours', url: `${SITE_URL}/tours` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Tours', url: '/tours' },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Tours by Genre</span>
          </h1>
          <p className="text-xl text-gray-600">
            Browse upcoming tours across {genres.length} genres
          </p>
        </div>

        <TopStrip
          title="Top Tours"
          subtitle="Artists with the most dates in the next 60 days"
          items={topTours.map((t) => ({
            href: `/artists/${t.slug}`,
            title: t.name,
            subtitle: t.genre ? normalizeGenre(t.genre) : undefined,
            badgeValue: t.dateCount,
            badgeLabel: t.dateCount === 1 ? 'date' : 'dates',
          }))}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {genres.map(([genre, data]) => {
            const slug = genreSlug(genre);

            return (
              <Link
                key={genre}
                href={`/tours/${slug}`}
                className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover overflow-hidden border border-gray-100"
              >
                <div className="h-3 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-gray-900 group-hover:text-orange-500 transition-colors">
                        {genre}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {data.artistCount} artist{data.artistCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-white">
                      <span className="font-bold text-lg">{data.eventCount}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    {data.eventCount} upcoming show{data.eventCount === 1 ? '' : 's'}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {genres.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">No tours found. Check back soon!</p>
          </div>
        )}
      </div>
    </>
  );
}
