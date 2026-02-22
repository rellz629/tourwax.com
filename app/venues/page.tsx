import { db } from '@/db';
import { events, venues } from '@/db/schema';
import { eq, gte, sql } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { generateVenuesIndexMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { slugify } from '@/lib/slugify';

export const dynamic = 'force-static';
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return generateVenuesIndexMetadata();
}

export default async function VenuesPage() {
  const now = new Date();

  const venuesWithCounts = await db
    .select({
      venueName: sql<string>`max(${venues.name})`,
      city: sql<string>`min(${venues.city})`,
      state: sql<string>`min(${venues.state})`,
      eventCount: sql<number>`count(*)::int`,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(gte(events.eventDate, now))
    .groupBy(sql`lower(${venues.name})`)
    .orderBy(sql`count(*) desc`);

  // Group venues by city
  const venuesByCity = new Map<string, typeof venuesWithCounts>();
  for (const row of venuesWithCounts) {
    const cityKey = row.state ? `${row.city}, ${row.state}` : (row.city || 'Other');
    if (!venuesByCity.has(cityKey)) {
      venuesByCity.set(cityKey, []);
    }
    venuesByCity.get(cityKey)!.push(row);
  }

  // Sort cities alphabetically
  const sortedCities = Array.from(venuesByCity.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Venues', url: `${SITE_URL}/venues` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Venues', url: '/venues' },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Concert Venues</span>
          </h1>
          <p className="text-xl text-gray-600">
            Browse {venuesWithCounts.length} venues with upcoming shows
          </p>
        </div>

        {sortedCities.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">No venues with upcoming shows found. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-10">
            {sortedCities.map(([cityLabel, cityVenues]) => (
              <section key={cityLabel}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-1 w-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
                  <h2 className="text-xl font-bold text-gray-900">{cityLabel}</h2>
                  <div className="h-px flex-1 bg-gray-200"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cityVenues.map((row) => {
                    const venueSlug = slugify(row.venueName);
                    return (
                      <Link
                        key={venueSlug}
                        href={`/venues/${venueSlug}`}
                        className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover overflow-hidden border border-gray-100"
                      >
                        <div className="h-2 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600"></div>
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-bold text-gray-900 group-hover:text-orange-500 transition-colors truncate">
                                {row.venueName}
                              </h3>
                            </div>
                            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white">
                              <span className="font-bold text-sm">{row.eventCount}</span>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-gray-600">
                            {row.eventCount} upcoming show{row.eventCount === 1 ? '' : 's'}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
