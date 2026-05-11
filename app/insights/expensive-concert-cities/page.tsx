import Link from 'next/link';
import type { Metadata } from 'next';
import { generateInsightMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateArticleSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getMostExpensiveConcertCities } from '@/lib/insights';

export const dynamic = 'force-static';
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return generateInsightMetadata({
    title: 'Most Expensive Concert Cities 2026 — Highest Avg Ticket Prices',
    description: 'Which US cities have the priciest concert tickets in 2026? Cities ranked by average minimum ticket price across upcoming shows, with top artists driving demand.',
    slug: 'expensive-concert-cities',
  });
}

export default async function ExpensiveConcertCitiesPage() {
  const cities = await getMostExpensiveConcertCities();

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Insights', url: `${SITE_URL}/insights` },
    { name: 'Most Expensive Concert Cities', url: `${SITE_URL}/insights/expensive-concert-cities` },
  ]);

  const articleSchema = generateArticleSchema({
    headline: 'Most Expensive Concert Cities 2026',
    description: 'Cities ranked by the highest average starting ticket price for upcoming concerts.',
    slug: 'expensive-concert-cities',
    dateModified: new Date().toISOString(),
  });

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Insights', url: '/insights' },
    { name: 'Most Expensive Concert Cities', url: '/insights/expensive-concert-cities' },
  ];

  const year = new Date().getFullYear();

  return (
    <>
      <StructuredData data={[breadcrumbSchema, articleSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Most Expensive Concert Cities {year}</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl">
            US cities ranked by the highest average starting ticket price across upcoming concerts.
            The markets where demand, venue tier, and headliner power push prices the furthest.
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
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Why These Cities Are Pricey</h2>
          <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-3">
            <p>
              This ranking uses the average starting ticket price across upcoming concerts in each city.
              Only cities with at least five upcoming priced events are included. Prices reflect the lowest
              available tier from Ticketmaster and SeatGeek at time of indexing, not resale market prices.
            </p>
            <p>
              The cities at the top of this list usually share a few traits: a high concentration of arena
              and stadium-tier headliners, premium-venue residencies that anchor a market for a full weekend,
              and tourist-driven demand that lets venues hold the starting tier higher than secondary markets
              can. Las Vegas residencies, Manhattan venues, and major-league sports complexes pull averages up
              quickly.
            </p>
            <p>
              If you want the opposite view, see the{' '}
              <Link href="/insights/affordable-concert-cities" className="text-orange-500 hover:text-orange-600 font-medium">most affordable concert cities</Link>
              {' '}ranking. For tips on lowering your ticket cost in any market, our{' '}
              <Link href="/blog/how-to-find-cheap-concert-tickets" className="text-orange-500 hover:text-orange-600 font-medium">guide to cheap concert tickets</Link>
              {' '}covers presales, day-of releases, and price drops worth tracking.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Related Insights</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/insights/affordable-concert-cities" className="bg-white rounded-xl shadow-md hover:shadow-xl border border-gray-100 p-5 transition-all hover:-translate-y-0.5 group">
              <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors">Most Affordable Concert Cities</h3>
              <p className="text-sm text-gray-500 mt-1">The cheapest cities for live music in 2026</p>
            </Link>
            <Link href="/insights/most-toured-cities" className="bg-white rounded-xl shadow-md hover:shadow-xl border border-gray-100 p-5 transition-all hover:-translate-y-0.5 group">
              <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors">Most Toured Cities</h3>
              <p className="text-sm text-gray-500 mt-1">Cities with the most upcoming shows</p>
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
