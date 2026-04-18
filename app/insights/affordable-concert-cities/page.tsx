import Link from 'next/link';
import type { Metadata } from 'next';
import { generateInsightMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateArticleSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getMostAffordableConcertCities } from '@/lib/insights';

export const dynamic = 'force-static';
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return generateInsightMetadata({
    title: 'Most Affordable Concert Cities 2026 — Cheapest Avg Ticket Prices',
    description: 'Which US cities have the cheapest concert tickets in 2026? Ranked by average minimum ticket price across all upcoming shows, with top artists and venues.',
    slug: 'affordable-concert-cities',
  });
}

export default async function AffordableConcertCitiesPage() {
  const cities = await getMostAffordableConcertCities();

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Insights', url: `${SITE_URL}/insights` },
    { name: 'Most Affordable Concert Cities', url: `${SITE_URL}/insights/affordable-concert-cities` },
  ]);

  const articleSchema = generateArticleSchema({
    headline: 'Most Affordable Concert Cities 2026',
    description: 'Cities ranked by average minimum ticket price for upcoming concerts.',
    slug: 'affordable-concert-cities',
    dateModified: new Date().toISOString(),
  });

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Insights', url: '/insights' },
    { name: 'Most Affordable Concert Cities', url: '/insights/affordable-concert-cities' },
  ];

  const year = new Date().getFullYear();

  return (
    <>
      <StructuredData data={[breadcrumbSchema, articleSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Most Affordable Concert Cities {year}</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl">
            Cities ranked by the lowest average starting ticket price across all upcoming concerts.
            The best places to see live music without breaking the bank.
          </p>
        </div>

        {cities.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No pricing data available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cities.map((city) => (
              <div
                key={city.citySlug}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
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
                      {city.topArtists.length > 0 && (
                        <p className="text-sm text-gray-500 mt-1">
                          {city.topArtists.join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 md:flex-shrink-0">
                    <div className="text-center">
                      <div className="text-2xl font-black text-orange-500">${city.avgMinPrice}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">avg starting price</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{city.eventCount}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">upcoming shows</div>
                    </div>
                    <Link
                      href={`/concerts/${city.citySlug}`}
                      className="btn-primary whitespace-nowrap"
                    >
                      Browse Shows
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <section className="mt-16 max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How We Calculate Concert Affordability</h2>
          <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-3">
            <p>
              This ranking uses the average starting ticket price across all upcoming concerts in each city.
              Only cities with at least 3 upcoming priced events are included. Prices reflect the lowest available
              ticket tier from Ticketmaster and SeatGeek at time of indexing, not resale market prices.
            </p>
            <p>
              Cities with strong local venue scenes, regional touring circuits, or college-town amphitheaters
              often appear near the top. Big markets like New York and Los Angeles tend to have higher
              starting prices due to demand, but also offer more shows per dollar if you plan ahead.
            </p>
            <p>
              Browse{' '}
              <Link href="/concerts/tonight" className="text-orange-500 hover:text-orange-600 font-medium">concerts tonight</Link>
              {' '}or{' '}
              <Link href="/concerts/this-weekend" className="text-orange-500 hover:text-orange-600 font-medium">concerts this weekend</Link>
              {' '}to find affordable last-minute shows, or check{' '}
              <Link href="/blog/how-to-find-cheap-concert-tickets" className="text-orange-500 hover:text-orange-600 font-medium">our guide to cheap concert tickets</Link>
              {' '}for tips on scoring deals.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Related Insights</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/insights/most-toured-cities" className="bg-white rounded-xl shadow-md hover:shadow-xl border border-gray-100 p-5 transition-all hover:-translate-y-0.5 group">
              <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors">Most Toured Cities</h3>
              <p className="text-sm text-gray-500 mt-1">Cities with the most upcoming shows</p>
            </Link>
            <Link href="/insights/busiest-touring-artists" className="bg-white rounded-xl shadow-md hover:shadow-xl border border-gray-100 p-5 transition-all hover:-translate-y-0.5 group">
              <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors">Busiest Touring Artists</h3>
              <p className="text-sm text-gray-500 mt-1">Artists playing the most shows in 2026</p>
            </Link>
            <Link href="/insights/top-concert-venues" className="bg-white rounded-xl shadow-md hover:shadow-xl border border-gray-100 p-5 transition-all hover:-translate-y-0.5 group">
              <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors">Top Concert Venues</h3>
              <p className="text-sm text-gray-500 mt-1">The busiest venues ranked by show count</p>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
