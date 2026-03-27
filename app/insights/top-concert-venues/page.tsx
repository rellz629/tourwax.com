import Link from 'next/link';
import type { Metadata } from 'next';
import { generateInsightMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateArticleSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getTopConcertVenues } from '@/lib/insights';
import { slugify } from '@/lib/slugify';

export const dynamic = 'force-static';
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return generateInsightMetadata({
    title: 'Top 50 Concert Venues of 2026',
    description: 'The busiest concert venues in 2026 ranked by upcoming event count. See which venues are hosting the most shows, who is performing, and get tickets.',
    slug: 'top-concert-venues',
  });
}

export default async function TopConcertVenuesPage() {
  const venueInsights = await getTopConcertVenues();

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Insights', url: `${SITE_URL}/insights` },
    { name: 'Top Concert Venues', url: `${SITE_URL}/insights/top-concert-venues` },
  ]);

  const articleSchema = generateArticleSchema({
    headline: 'Top 50 Concert Venues of 2026',
    description: 'The busiest concert venues ranked by upcoming event count.',
    slug: 'top-concert-venues',
    dateModified: new Date().toISOString(),
  });

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Insights', url: '/insights' },
    { name: 'Top Concert Venues', url: '/insights/top-concert-venues' },
  ];

  const totalEvents = venueInsights.reduce((sum, v) => sum + v.eventCount, 0);

  return (
    <>
      <StructuredData data={[breadcrumbSchema, articleSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Top Concert Venues of 2026</span>
          </h1>
          <p className="text-xl text-gray-600">
            The {venueInsights.length} busiest venues with {totalEvents.toLocaleString()} upcoming shows combined
          </p>
        </div>

        {venueInsights.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No event data available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {venueInsights.map((venue) => {
              const location = [venue.city, venue.state].filter(Boolean).join(', ');

              return (
                <div
                  key={venue.venueSlug}
                  className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {venue.rank}
                      </div>
                      <div>
                        <Link
                          href={`/venues/${venue.venueSlug}`}
                          className="text-xl font-bold text-gray-900 hover:text-orange-600 transition-colors"
                        >
                          {venue.venueName}
                        </Link>
                        <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                          <span className="font-semibold text-orange-600">
                            {venue.eventCount} show{venue.eventCount === 1 ? '' : 's'}
                          </span>
                          <span>
                            {venue.artistCount} artist{venue.artistCount === 1 ? '' : 's'}
                          </span>
                          {location && venue.city && (
                            <Link
                              href={`/concerts/${slugify(venue.city)}`}
                              className="hover:text-orange-600 transition-colors"
                            >
                              {location}
                            </Link>
                          )}
                        </div>
                        {venue.topArtists.length > 0 && (
                          <p className="mt-1 text-sm text-gray-400">
                            {venue.topArtists.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/venues/${venue.venueSlug}`}
                      className="btn-primary whitespace-nowrap text-center"
                    >
                      View Schedule
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SEO Content */}
        <section className="mt-12 max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">About This Ranking</h2>
          <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-3">
            <p>
              This ranking shows the top {venueInsights.length} concert venues in 2026 by number of upcoming events.
              Data is sourced from Ticketmaster and SeatGeek and updated daily.
              {venueInsights.length > 0 && (
                <> {venueInsights[0].venueName} leads with {venueInsights[0].eventCount} scheduled shows.</>
              )}
            </p>
            <p>
              Looking for shows at a specific venue? Browse all <Link href="/venues" className="text-orange-500 hover:text-orange-600 font-medium">concert venues</Link> or
              find <Link href="/concerts/tonight" className="text-orange-500 hover:text-orange-600 font-medium">concerts tonight</Link> and <Link href="/concerts/this-weekend" className="text-orange-500 hover:text-orange-600 font-medium">shows this weekend</Link>.
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
              Busiest Touring Artists &rarr;
            </Link>
            <Link
              href="/insights/most-toured-cities"
              className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
            >
              Most Toured Cities &rarr;
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
