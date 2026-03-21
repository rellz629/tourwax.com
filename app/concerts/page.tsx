import { db } from '@/db';
import { events, venues } from '@/db/schema';
import { eq, gte, isNotNull, sql } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { generateConcertsIndexMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { slugify } from '@/lib/slugify';

export const dynamic = 'force-static';
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return generateConcertsIndexMetadata();
}

export default async function ConcertsPage() {
  const now = new Date();

  const citiesWithCounts = await db
    .select({
      city: venues.city,
      state: venues.state,
      eventCount: sql<number>`count(*)::int`,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(
      gte(events.eventDate, now)
    )
    .groupBy(venues.city, venues.state)
    .orderBy(sql`count(*) desc`);

  const cities = citiesWithCounts.filter((row) => row.city);

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Concerts', url: `${SITE_URL}/concerts` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Concerts', url: '/concerts' },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Upcoming Concerts</span>
          </h1>
          <p className="text-xl text-gray-600">
            Browse concerts in {cities.length} cities
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Link href="/concerts/tonight" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-4 py-2 rounded-lg transition-colors">Tonight</Link>
            <Link href="/concerts/this-weekend" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-4 py-2 rounded-lg transition-colors">This Weekend</Link>
            <Link href="/concerts/this-week" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-4 py-2 rounded-lg transition-colors">This Week</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cities.map((row) => {
            const citySlug = slugify(row.city!);
            const location = row.state ? `${row.city}, ${row.state}` : row.city!;

            return (
              <Link
                key={`${row.city}-${row.state}`}
                href={`/concerts/${citySlug}`}
                className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover overflow-hidden border border-gray-100"
              >
                <div className="h-3 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-gray-900 group-hover:text-orange-500 transition-colors">
                        {row.city}
                      </h2>
                      {row.state && (
                        <p className="text-sm text-gray-500">{row.state}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-white">
                      <span className="font-bold text-lg">{row.eventCount}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    {row.eventCount} upcoming show{row.eventCount === 1 ? '' : 's'}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {cities.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">No upcoming concerts found. Check back soon!</p>
          </div>
        )}
      </div>
    </>
  );
}
