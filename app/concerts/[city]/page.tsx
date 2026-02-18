import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, gte, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateCityMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateCityEventListSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAffiliateUrl } from '@/lib/affiliate';
import { slugify } from '@/lib/slugify';

export const dynamic = 'force-static';
export const revalidate = 1800;

interface Props {
  params: Promise<{ city: string }>;
}

async function getCityInfo(citySlug: string) {
  const now = new Date();

  // Get all distinct cities with future events
  const allCities = await db
    .selectDistinct({
      city: venues.city,
      state: venues.state,
    })
    .from(venues)
    .innerJoin(events, eq(events.venueId, venues.id))
    .where(gte(events.eventDate, now));

  // Find matching city by slug
  const match = allCities.find(
    (row) => row.city && slugify(row.city) === citySlug
  );

  return match || null;
}

async function getCityEvents(cityName: string) {
  const now = new Date();

  const cityEvents = await db
    .select({
      event: events,
      venue: venues,
      artistName: artists.name,
      artistSlug: artists.slug,
      artistImageUrl: artists.imageUrl,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .innerJoin(artists, eq(events.artistId, artists.id))
    .where(
      sql`${venues.city} = ${cityName} AND ${events.eventDate} >= ${now}`
    )
    .orderBy(events.eventDate);

  return cityEvents;
}

export async function generateStaticParams() {
  const now = new Date();

  // Get top 30 cities by event count
  const topCities = await db
    .select({
      city: venues.city,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(gte(events.eventDate, now))
    .groupBy(venues.city)
    .orderBy(sql`count(*) desc`)
    .limit(30);

  return topCities
    .filter((row) => row.city)
    .map((row) => ({
      city: slugify(row.city!),
    }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: citySlug } = await params;
  const cityInfo = await getCityInfo(citySlug);

  if (!cityInfo || !cityInfo.city) {
    return {
      title: 'City Not Found',
      description: 'The city you are looking for could not be found.',
    };
  }

  const cityEvents = await getCityEvents(cityInfo.city);
  const artistNames = [...new Set(cityEvents.map((e) => e.artistName))];

  return generateCityMetadata({
    cityName: cityInfo.city,
    state: cityInfo.state,
    citySlug,
    eventCount: cityEvents.length,
    artistNames,
  });
}

export default async function CityPage({ params }: Props) {
  const { city: citySlug } = await params;
  const cityInfo = await getCityInfo(citySlug);

  if (!cityInfo || !cityInfo.city) {
    notFound();
  }

  const cityEvents = await getCityEvents(cityInfo.city);
  const locationLabel = cityInfo.state
    ? `${cityInfo.city}, ${cityInfo.state}`
    : cityInfo.city;

  // Group events by date
  const eventsByDate = cityEvents.reduce((acc, row) => {
    const dateKey = new Date(row.event.eventDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(row);
    return acc;
  }, {} as Record<string, typeof cityEvents>);

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Concerts', url: `${SITE_URL}/concerts` },
    { name: cityInfo.city, url: `${SITE_URL}/concerts/${citySlug}` },
  ]);

  const eventListSchema = generateCityEventListSchema(
    cityInfo.city,
    cityInfo.state,
    citySlug,
    cityEvents.map((row) => ({
      event: row.event,
      artist: {
        name: row.artistName,
        slug: row.artistSlug,
        imageUrl: row.artistImageUrl,
      },
      venue: row.venue,
    }))
  );

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Concerts', url: '/concerts' },
    { name: cityInfo.city, url: `/concerts/${citySlug}` },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema, eventListSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            Concerts in <span className="gradient-text">{locationLabel}</span>
          </h1>
          <p className="text-xl text-gray-600">
            {cityEvents.length} upcoming show{cityEvents.length === 1 ? '' : 's'}
          </p>
        </div>

        {cityEvents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">No upcoming concerts in {locationLabel}.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(eventsByDate).map(([date, dateEvents]) => (
              <section key={date}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-1 w-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
                  <h2 className="text-xl font-bold text-gray-900">{date}</h2>
                  <div className="h-px flex-1 bg-gray-200"></div>
                </div>
                <div className="space-y-4">
                  {dateEvents.map((row) => (
                    <div
                      key={row.event.id}
                      className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover p-6 border border-gray-100"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                        <div className="flex items-start gap-4 flex-1">
                          <Link
                            href={`/artists/${row.artistSlug}`}
                            className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-500 to-red-500"
                          >
                            {row.artistImageUrl ? (
                              <Image
                                src={row.artistImageUrl}
                                alt={row.artistName}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                                sizes="64px"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold">
                                {row.artistName.charAt(0)}
                              </div>
                            )}
                          </Link>
                          <div className="flex-1">
                            <Link
                              href={`/artists/${row.artistSlug}`}
                              className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors text-lg"
                            >
                              {row.artistName}
                            </Link>
                            <h3 className="text-sm text-gray-600 mt-1">{row.event.name}</h3>
                            {row.venue && (
                              <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="font-medium">{row.venue.name}</span>
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {new Date(row.event.eventDate).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                              {(row.event.minPrice || row.event.maxPrice) && (
                                <>
                                  <span className="text-gray-300">|</span>
                                  <span className="font-semibold text-orange-600">
                                    From {row.event.currency} {row.event.minPrice || row.event.maxPrice}
                                    {row.event.maxPrice && row.event.minPrice !== row.event.maxPrice &&
                                      ` - ${row.event.currency} ${row.event.maxPrice}`}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          {row.event.ticketUrl && (
                            <a
                              href={getAffiliateUrl(row.event.ticketUrl, row.event.source)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-primary whitespace-nowrap"
                            >
                              Get Tickets
                            </a>
                          )}
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                            via {row.event.source}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
