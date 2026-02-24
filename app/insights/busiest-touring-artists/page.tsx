import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateInsightMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateArticleSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getBusiestTouringArtists } from '@/lib/insights';
import { normalizeGenre, genreSlug } from '@/lib/genres';

export const dynamic = 'force-static';
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return generateInsightMetadata({
    title: 'Busiest Touring Artists of 2026',
    description: 'Ranked list of the top 50 busiest touring artists in 2026 by upcoming show count. See who is playing the most concerts this year.',
    slug: 'busiest-touring-artists',
  });
}

export default async function BusiestTouringArtistsPage() {
  const artistInsights = await getBusiestTouringArtists();

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Insights', url: `${SITE_URL}/insights` },
    { name: 'Busiest Touring Artists', url: `${SITE_URL}/insights/busiest-touring-artists` },
  ]);

  const articleSchema = generateArticleSchema({
    headline: 'Busiest Touring Artists of 2026',
    description: 'Ranked list of the top 50 busiest touring artists by upcoming show count.',
    slug: 'busiest-touring-artists',
    dateModified: new Date().toISOString(),
  });

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Insights', url: '/insights' },
    { name: 'Busiest Touring Artists', url: '/insights/busiest-touring-artists' },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema, articleSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Busiest Touring Artists of 2026</span>
          </h1>
          <p className="text-xl text-gray-600">
            The top {artistInsights.length} artists ranked by upcoming show count
          </p>
        </div>

        {artistInsights.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No event data available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {artistInsights.map((artist) => {
              const genre = normalizeGenre(artist.genre);
              const gSlug = genreSlug(genre);

              return (
                <div
                  key={artist.artistSlug}
                  className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {artist.rank}
                      </div>
                      <Link
                        href={`/artists/${artist.artistSlug}`}
                        className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-500 to-red-500"
                      >
                        {artist.imageUrl ? (
                          <Image
                            src={artist.imageUrl}
                            alt={artist.artistName}
                            width={56}
                            height={56}
                            className="w-full h-full object-cover"
                            sizes="56px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold">
                            {artist.artistName.charAt(0)}
                          </div>
                        )}
                      </Link>
                      <div>
                        <Link
                          href={`/artists/${artist.artistSlug}`}
                          className="text-xl font-bold text-gray-900 hover:text-orange-600 transition-colors"
                        >
                          {artist.artistName}
                        </Link>
                        <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                          <span className="font-semibold text-orange-600">
                            {artist.eventCount} show{artist.eventCount === 1 ? '' : 's'}
                          </span>
                          <span>
                            {artist.cityCount} {artist.cityCount === 1 ? 'city' : 'cities'}
                          </span>
                          {artist.genre && (
                            <Link
                              href={`/tours/${gSlug}`}
                              className="inline-block px-2 py-0.5 text-xs font-semibold text-orange-600 bg-orange-50 rounded-full hover:bg-orange-100 transition-colors"
                            >
                              {genre}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/artists/${artist.artistSlug}`}
                      className="btn-primary whitespace-nowrap text-center"
                    >
                      View Tour Dates
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 bg-white rounded-xl shadow-md p-8 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-2">More Insights</h2>
          <p className="text-gray-600 mb-4">
            See which cities are hosting the most concerts this year.
          </p>
          <Link
            href="/insights/most-toured-cities"
            className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
          >
            Most Toured Cities of 2026 →
          </Link>
        </div>
      </div>
    </>
  );
}
