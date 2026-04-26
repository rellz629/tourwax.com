import { cache } from 'react';
import { db } from '@/db';
import { artists, events, eventArtists, venues } from '@/db/schema';
import { eq, gte, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateCityMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateCityEventListSchema, generateFAQSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAffiliateUrl } from '@/lib/affiliate';
import { isPackage } from '@/lib/event-utils';
import { slugify } from '@/lib/slugify';
import { CITY_LONG_CONTENT } from '@/lib/city-content';
import Pagination from '@/components/Pagination';

export const revalidate = 1800;

const EVENTS_PER_PAGE = 50;

interface Props {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ page?: string }>;
}

const getCityInfo = cache(async function getCityInfo(citySlug: string) {
  // Find matching city by slug from all venues (not just those with future events)
  const allCities = await db
    .selectDistinct({
      city: venues.city,
      state: venues.state,
    })
    .from(venues);

  const match = allCities.find(
    (row) => row.city && slugify(row.city) === citySlug
  );

  return match || null;
});

const getNearbyCities = cache(async function getNearbyCities(cityName: string, state: string | null) {
  if (!state) return [];
  const now = new Date();

  const cities = await db
    .select({
      city: venues.city,
      eventCount: sql<number>`count(distinct ${events.id})`.as('eventCount'),
    })
    .from(venues)
    .innerJoin(events, eq(events.venueId, venues.id))
    .where(sql`${venues.state} = ${state} AND ${venues.city} != ${cityName} AND ${events.eventDate} >= ${now.toISOString()}`)
    .groupBy(venues.city)
    .orderBy(sql`count(distinct ${events.id}) desc`)
    .limit(8);

  return cities.filter((c) => c.city);
});

const getCityEvents = cache(async function getCityEvents(cityName: string) {
  const now = new Date();

  const cityEvents = await db
    .select({
      event: events,
      venue: venues,
      artistName: artists.name,
      artistSlug: artists.slug,
      artistImageUrl: artists.imageUrl,
      artistGenre: artists.genre,
    })
    .from(events)
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .innerJoin(venues, eq(events.venueId, venues.id))
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .where(
      sql`${venues.city} = ${cityName} AND ${events.eventDate} >= ${now.toISOString()}`
    )
    .orderBy(events.eventDate);

  // Deduplicate: keep one row per event (joint-headliner shows have multiple artist rows)
  const groups = new Map<string, typeof cityEvents[0]>();
  for (const row of cityEvents) {
    const key = row.event.id;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, row);
    } else if (isPackage(existing.event.name) && !isPackage(row.event.name)) {
      groups.set(key, row);
    }
  }
  return Array.from(groups.values());
});

export async function generateStaticParams() {
  const now = new Date();

  // Get all cities with upcoming events
  const topCities = await db
    .select({
      city: venues.city,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(gte(events.eventDate, now))
    .groupBy(venues.city)
    .orderBy(sql`count(*) desc`);

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
  const venueNames = [...new Set(cityEvents.filter((e) => e.venue).map((e) => e.venue!.name))];
  const nextEventDate = cityEvents.length > 0 ? new Date(cityEvents[0].event.eventDate) : null;

  return generateCityMetadata({
    cityName: cityInfo.city,
    state: cityInfo.state,
    citySlug,
    eventCount: cityEvents.length,
    artistNames,
    venueNames,
    nextEventDate,
  });
}

export default async function CityPage({ params, searchParams }: Props) {
  const { city: citySlug } = await params;
  const { page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page || '1', 10) || 1);
  const cityInfo = await getCityInfo(citySlug);

  if (!cityInfo || !cityInfo.city) {
    notFound();
  }

  const [allCityEvents, nearbyCities] = await Promise.all([
    getCityEvents(cityInfo.city),
    getNearbyCities(cityInfo.city, cityInfo.state),
  ]);

  const totalPages = Math.ceil(allCityEvents.length / EVENTS_PER_PAGE);
  const cityEvents = allCityEvents.slice(
    (currentPage - 1) * EVENTS_PER_PAGE,
    currentPage * EVENTS_PER_PAGE
  );
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
    allCityEvents.slice(0, 50).map((row) => ({
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

  const year = new Date().getFullYear();
  const uniqueArtistNames = [...new Set(allCityEvents.map((e) => e.artistName))];
  const uniqueVenueNames = [...new Set(allCityEvents.filter((e) => e.venue).map((e) => e.venue!.name))];

  // Venue stats: name, slug, event count
  const venueStats = Object.values(
    allCityEvents.reduce((acc, row) => {
      if (!row.venue) return acc;
      const name = row.venue.name;
      if (!acc[name]) {
        acc[name] = { name, slug: slugify(name), count: 0, address: row.venue.address };
      }
      acc[name].count++;
      return acc;
    }, {} as Record<string, { name: string; slug: string; count: number; address: string | null }>)
  ).sort((a, b) => b.count - a.count);

  // Genre breakdown from artists
  const genreCounts = allCityEvents.reduce((acc, row) => {
    const genre = row.artistGenre || 'Other';
    acc[genre] = (acc[genre] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Date range for content
  const nextEventDate = allCityEvents.length > 0 ? new Date(allCityEvents[0].event.eventDate) : null;
  const lastEventDate = allCityEvents.length > 0 ? new Date(allCityEvents[allCityEvents.length - 1].event.eventDate) : null;

  // Price range across all events
  const prices = allCityEvents
    .map((e) => e.event.minPrice)
    .filter((p): p is number => p !== null && p > 0);
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : null;
  const highestPrice = prices.length > 0 ? Math.max(...prices) : null;

  // Group events by month for calendar section
  const eventsByMonth = allCityEvents.reduce((acc, row) => {
    const monthKey = new Date(row.event.eventDate).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(row);
    return acc;
  }, {} as Record<string, typeof cityEvents>);

  const faqs = [
    {
      question: `How many concerts are coming to ${locationLabel} in ${year}?`,
      answer: `There are currently ${allCityEvents.length} upcoming concert${allCityEvents.length === 1 ? '' : 's'} scheduled in ${locationLabel}. Check back regularly as new shows are added daily.`,
    },
    {
      question: `What artists are performing in ${cityInfo.city} soon?`,
      answer: uniqueArtistNames.length > 0
        ? `Artists with upcoming shows in ${cityInfo.city} include ${uniqueArtistNames.slice(0, 5).join(', ')}${uniqueArtistNames.length > 5 ? `, and ${uniqueArtistNames.length - 5} more` : ''}.`
        : `Check back soon for upcoming artist announcements in ${cityInfo.city}.`,
    },
    {
      question: `What are the main concert venues in ${cityInfo.city}?`,
      answer: uniqueVenueNames.length > 0
        ? `Popular concert venues in ${cityInfo.city} include ${uniqueVenueNames.slice(0, 5).join(', ')}${uniqueVenueNames.length > 5 ? ', and more' : ''}.`
        : `Check our venues page for concert venues in ${cityInfo.city}.`,
    },
    {
      question: `How do I find cheap concert tickets in ${cityInfo.city}?`,
      answer: `Compare ticket prices for ${cityInfo.city} concerts on TourWax. We show prices from Ticketmaster and SeatGeek so you can find the best deal. Prices often drop closer to the show date.`,
    },
    {
      question: `Are there concerts in ${cityInfo.city} tonight or this weekend?`,
      answer: `Check our concerts tonight and this weekend pages for last-minute shows in ${locationLabel}. This page is updated every 30 minutes with the latest schedules.`,
    },
    {
      question: `Where can I find a live music calendar for ${cityInfo.city}?`,
      answer: `This page is your ${cityInfo.city} live music calendar. We list all upcoming concerts, shows, and music events${uniqueVenueNames.length > 0 ? ` at venues like ${uniqueVenueNames.slice(0, 3).join(', ')}` : ''}. Bookmark it to stay up to date.`,
    },
    {
      question: `What bands are coming to ${cityInfo.city} in ${year}?`,
      answer: uniqueArtistNames.length > 0
        ? `Bands and artists touring through ${cityInfo.city} in ${year} include ${uniqueArtistNames.slice(0, 8).join(', ')}${uniqueArtistNames.length > 8 ? `, and ${uniqueArtistNames.length - 8} more` : ''}. New tours are announced regularly.`
        : `No tours have been announced for ${cityInfo.city} yet. Check back as new shows are added daily.`,
    },
  ];

  const faqSchema = generateFAQSchema(faqs);
  const longContent = CITY_LONG_CONTENT[cityInfo.city];

  return (
    <>
      <StructuredData data={[breadcrumbSchema, eventListSchema, faqSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            Concerts in <span className="gradient-text">{locationLabel}</span>
          </h1>
          <p className="text-xl text-gray-600">
            {allCityEvents.length > 0
              ? `${allCityEvents.length} upcoming concert${allCityEvents.length === 1 ? '' : 's'} & shows`
              : 'Upcoming concerts & shows'
            }
            {totalPages > 1 && ` — Page ${currentPage} of ${totalPages}`}
          </p>
        </div>

        {longContent && (
          <section className="mb-12 max-w-4xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{longContent.headline}</h2>
            <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-3">
              {longContent.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        )}

        {/* Quick Stats Bar */}
        {allCityEvents.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{allCityEvents.length}</p>
              <p className="text-sm text-gray-500">Upcoming Shows</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{uniqueVenueNames.length}</p>
              <p className="text-sm text-gray-500">Venues</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {nextEventDate
                  ? nextEventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : '—'}
              </p>
              <p className="text-sm text-gray-500">Next Show</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {lowestPrice ? `$${lowestPrice}` : 'See listing'}
              </p>
              <p className="text-sm text-gray-500">Tickets From</p>
            </div>
          </div>
        )}

        {/* Monthly Calendar Breakdown */}
        {Object.keys(eventsByMonth).length > 1 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{cityInfo.city} Concert Calendar {year}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(eventsByMonth).map(([month, monthEvents]) => {
                const monthArtists = [...new Set(monthEvents.map((e) => e.artistName))];
                return (
                  <div key={month} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <h3 className="font-semibold text-gray-900 text-sm">{month}</h3>
                    <p className="text-2xl font-bold text-orange-500 my-1">{monthEvents.length}</p>
                    <p className="text-xs text-gray-500">
                      {monthArtists.slice(0, 2).join(', ')}{monthArtists.length > 2 ? ` +${monthArtists.length - 2}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
                                <svg className="w-4 h-4 text-gray-400" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <Link href={`/venues/${slugify(row.venue.name)}`} className="font-medium hover:text-orange-600 transition-colors">{row.venue.name}</Link>
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
                          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
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

        <Pagination currentPage={currentPage} totalPages={totalPages} basePath={`/concerts/${citySlug}`} />

        {/* Popular Venues Section */}
        {venueStats.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Concert Venues in {cityInfo.city}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {venueStats.slice(0, 12).map((venue) => (
                <Link
                  key={venue.slug}
                  href={`/venues/${venue.slug}`}
                  className="bg-white rounded-xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-shadow"
                >
                  <h3 className="font-semibold text-gray-900 hover:text-orange-600 transition-colors text-sm leading-tight mb-2">{venue.name}</h3>
                  <p className="text-sm text-gray-500">{venue.count} upcoming event{venue.count === 1 ? '' : 's'}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Genre Breakdown */}
        {topGenres.length > 1 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Music Genres in {cityInfo.city}</h2>
            <div className="flex flex-wrap gap-3">
              {topGenres.map(([genre, count]) => (
                <span key={genre} className="bg-white rounded-full px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 shadow-sm">
                  {genre} <span className="text-gray-400 ml-1">{count}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* About Section */}
        <section className="mt-16 max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Live Music in {locationLabel}</h2>
          <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-3">
            <p>
              {allCityEvents.length > 0
                ? `${locationLabel} has ${allCityEvents.length} upcoming concert${allCityEvents.length === 1 ? '' : 's'}${nextEventDate && lastEventDate ? ` from ${nextEventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} through ${lastEventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}. Artists performing include ${uniqueArtistNames.slice(0, 6).join(', ')}${uniqueArtistNames.length > 6 ? ` and ${uniqueArtistNames.length - 6} more` : ''}.`
                : `No concerts are currently scheduled in ${locationLabel}. Check back regularly — we update tour schedules daily.`
              }
            </p>
            {uniqueVenueNames.length > 0 && (
              <p>
                {`Popular concert venues in ${cityInfo.city} include ${uniqueVenueNames.slice(0, 5).join(', ')}${uniqueVenueNames.length > 5 ? ` and ${uniqueVenueNames.length - 5} more` : ''}. From intimate clubs to large amphitheaters, ${cityInfo.city} offers live music for every taste.`}
              </p>
            )}
            {lowestPrice && (
              <p>
                Ticket prices for concerts in {cityInfo.city} start at ${lowestPrice}{highestPrice && highestPrice !== lowestPrice ? ` and go up to $${highestPrice}` : ''}.
                Prices vary by artist, venue, and seat location.
              </p>
            )}
            <p>
              TourWax compares ticket prices from Ticketmaster and SeatGeek so you can find the best deals on {cityInfo.city} concert tickets.
              {cityInfo.state && (
                <> Looking for more options? Browse{' '}
                  <Link href={`/concerts/state/${slugify(cityInfo.state)}`} className="text-orange-500 hover:text-orange-600 font-medium">
                    all concerts in {cityInfo.state}
                  </Link>{' '}
                  or explore{' '}
                </>
              )}
              {!cityInfo.state && <> Explore{' '}</>}
              <Link href="/concerts/tonight" className="text-orange-500 hover:text-orange-600 font-medium">concerts tonight</Link>,{' '}
              <Link href="/concerts/this-weekend" className="text-orange-500 hover:text-orange-600 font-medium">shows this weekend</Link>, or{' '}
              <Link href="/concerts/this-week" className="text-orange-500 hover:text-orange-600 font-medium">concerts this week</Link>.
            </p>
          </div>
        </section>

        {/* Nearby Cities */}
        {nearbyCities.length > 0 && cityInfo.state && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">More Concerts in {cityInfo.state}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {nearbyCities.map((c) => (
                <Link
                  key={c.city}
                  href={`/concerts/${slugify(c.city!)}`}
                  className="bg-white rounded-lg border border-gray-200 px-4 py-3 hover:border-orange-300 hover:shadow-sm transition-all"
                >
                  <span className="font-medium text-gray-900 text-sm">{c.city}</span>
                  <span className="text-xs text-gray-500 ml-2">{c.eventCount} shows</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FAQ Section */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group bg-white rounded-xl shadow-md border border-gray-100">
                <summary className="cursor-pointer p-5 font-semibold text-gray-900 hover:text-orange-600 transition-colors list-none flex justify-between items-center">
                  {faq.question}
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-2" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-5 pb-5 text-gray-600">{faq.answer}</div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
