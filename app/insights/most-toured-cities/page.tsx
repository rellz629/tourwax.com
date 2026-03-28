import Link from 'next/link';
import type { Metadata } from 'next';
import { generateInsightMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateArticleSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getMostTouredCities } from '@/lib/insights';

export const dynamic = 'force-static';
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return generateInsightMetadata({
    title: 'Most Toured Cities of 2026',
    description: 'Ranked list of the top 50 most toured cities in 2026 by concert count. See which metro areas are hosting the most live music events this year.',
    slug: 'most-toured-cities',
  });
}

export default async function MostTouredCitiesPage() {
  const cities = await getMostTouredCities();

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Insights', url: `${SITE_URL}/insights` },
    { name: 'Most Toured Cities', url: `${SITE_URL}/insights/most-toured-cities` },
  ]);

  const articleSchema = generateArticleSchema({
    headline: 'Most Toured Cities of 2026',
    description: 'Ranked list of the top 50 most toured cities by concert count.',
    slug: 'most-toured-cities',
    dateModified: new Date().toISOString(),
  });

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Insights', url: '/insights' },
    { name: 'Most Toured Cities', url: '/insights/most-toured-cities' },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema, articleSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Most Toured Cities of 2026</span>
          </h1>
          <p className="text-xl text-gray-600">
            The top {cities.length} cities ranked by upcoming concert count
          </p>
        </div>

        {cities.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No event data available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cities.map((city) => (
              <div
                key={city.citySlug}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {city.rank}
                    </div>
                    <div>
                      <Link
                        href={`/concerts/${city.citySlug}`}
                        className="text-xl font-bold text-gray-900 hover:text-orange-600 transition-colors"
                      >
                        {city.city}{city.state ? `, ${city.state}` : ''}
                      </Link>
                      <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-500">
                        <span className="font-semibold text-orange-600">
                          {city.eventCount} event{city.eventCount === 1 ? '' : 's'}
                        </span>
                        <span>
                          {city.artistCount} artist{city.artistCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      {city.topArtists.length > 0 && (
                        <p className="text-sm text-gray-600 mt-2">
                          Top artists: {city.topArtists.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/concerts/${city.citySlug}`}
                    className="btn-primary whitespace-nowrap text-center"
                  >
                    View Concerts
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 bg-white rounded-xl shadow-md p-8 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-2">More Insights</h2>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/insights/busiest-touring-artists"
              className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
            >
              Busiest Touring Artists →
            </Link>
            <Link
              href="/insights/top-concert-venues"
              className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
            >
              Top Concert Venues →
            </Link>
            <Link
              href="/insights/busiest-touring-months"
              className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
            >
              Busiest Touring Months →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
