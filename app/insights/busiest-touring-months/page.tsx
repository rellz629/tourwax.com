import Link from 'next/link';
import type { Metadata } from 'next';
import { generateInsightMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateArticleSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getBusiestTouringMonths } from '@/lib/insights';
import { slugify } from '@/lib/slugify';

export const dynamic = 'force-static';
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return generateInsightMetadata({
    title: 'Busiest Touring Months of 2026',
    description: 'Which months have the most concerts in 2026? See the busiest months for live music ranked by event count, with top artists and cities for each month.',
    slug: 'busiest-touring-months',
  });
}

export default async function BusiestTouringMonthsPage() {
  const monthInsights = await getBusiestTouringMonths();

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Insights', url: `${SITE_URL}/insights` },
    { name: 'Busiest Touring Months', url: `${SITE_URL}/insights/busiest-touring-months` },
  ]);

  const articleSchema = generateArticleSchema({
    headline: 'Busiest Touring Months of 2026',
    description: 'The busiest months for live music ranked by upcoming event count.',
    slug: 'busiest-touring-months',
    dateModified: new Date().toISOString(),
  });

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Insights', url: '/insights' },
    { name: 'Busiest Touring Months', url: '/insights/busiest-touring-months' },
  ];

  const totalEvents = monthInsights.reduce((sum, m) => sum + m.eventCount, 0);
  const peakMonth = monthInsights.length > 0 ? monthInsights[0] : null;

  // Sort chronologically for the chart-like display
  const chronological = [...monthInsights].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const maxEvents = peakMonth ? peakMonth.eventCount : 1;

  return (
    <>
      <StructuredData data={[breadcrumbSchema, articleSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Busiest Touring Months of 2026</span>
          </h1>
          <p className="text-xl text-gray-600">
            {totalEvents.toLocaleString()} upcoming shows across {monthInsights.length} months
            {peakMonth && <> — {peakMonth.month} leads with {peakMonth.eventCount.toLocaleString()} events</>}
          </p>
        </div>

        {/* Visual bar chart */}
        {chronological.length > 0 && (
          <section className="mb-12 bg-white rounded-xl shadow-md border border-gray-100 p-6 md:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Concert Activity by Month</h2>
            <div className="space-y-3">
              {chronological.map((month) => {
                const pct = Math.round((month.eventCount / maxEvents) * 100);
                return (
                  <div key={month.monthKey} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600 w-28 flex-shrink-0 text-right">
                      {month.month.split(' ')[0]}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, 8)}%` }}
                      >
                        <span className="text-xs font-bold text-white">{month.eventCount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Ranked list */}
        {monthInsights.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No event data available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {monthInsights.map((month) => (
              <div
                key={month.monthKey}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {month.rank}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {month.month}
                      </h3>
                      <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                        <span className="font-semibold text-orange-600">
                          {month.eventCount.toLocaleString()} show{month.eventCount === 1 ? '' : 's'}
                        </span>
                        <span>
                          {month.artistCount.toLocaleString()} artist{month.artistCount === 1 ? '' : 's'}
                        </span>
                        <span>
                          {month.cityCount.toLocaleString()} cit{month.cityCount === 1 ? 'y' : 'ies'}
                        </span>
                      </div>
                      {month.topArtists.length > 0 && (
                        <p className="mt-2 text-sm text-gray-500">
                          <span className="font-medium text-gray-700">Top artists:</span>{' '}
                          {month.topArtists.map((name, i) => (
                            <span key={name}>
                              {i > 0 && ', '}
                              <Link
                                href={`/artists/${slugify(name)}`}
                                className="hover:text-orange-600 transition-colors"
                              >
                                {name}
                              </Link>
                            </span>
                          ))}
                        </p>
                      )}
                      {month.topCities.length > 0 && (
                        <p className="mt-1 text-sm text-gray-400">
                          <span className="font-medium text-gray-500">Top cities:</span>{' '}
                          {month.topCities.map((city, i) => (
                            <span key={city}>
                              {i > 0 && ', '}
                              <Link
                                href={`/concerts/${slugify(city)}`}
                                className="hover:text-orange-600 transition-colors"
                              >
                                {city}
                              </Link>
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SEO Content */}
        <section className="mt-12 max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">About This Ranking</h2>
          <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-3">
            <p>
              This ranking shows the busiest months for live music in 2026 based on upcoming concert counts from
              Ticketmaster and SeatGeek. Data is updated daily as new tours are announced.
              {peakMonth && (
                <> {peakMonth.month} currently leads with {peakMonth.eventCount.toLocaleString()} scheduled shows across {peakMonth.cityCount} cities.</>
              )}
            </p>
            <p>
              Summer months typically see the highest concert activity due to outdoor amphitheater seasons, music
              festivals, and state fair concerts. Planning ahead for peak months means more options and often better
              ticket prices.
            </p>
            <p>
              Ready to find your next show? Browse <Link href="/concerts" className="text-orange-500 hover:text-orange-600 font-medium">upcoming concerts</Link>,
              check out <Link href="/festivals" className="text-orange-500 hover:text-orange-600 font-medium">music festivals</Link>,
              or find <Link href="/concerts/tonight" className="text-orange-500 hover:text-orange-600 font-medium">concerts tonight</Link> and{' '}
              <Link href="/concerts/this-weekend" className="text-orange-500 hover:text-orange-600 font-medium">shows this weekend</Link>.
            </p>
          </div>
        </section>

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
              href="/insights/most-toured-cities"
              className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
            >
              Most Toured Cities →
            </Link>
            <Link
              href="/insights/top-concert-venues"
              className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
            >
              Top Concert Venues →
            </Link>
            <Link
              href="/insights/rising-artists"
              className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
            >
              Rising Artists →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
