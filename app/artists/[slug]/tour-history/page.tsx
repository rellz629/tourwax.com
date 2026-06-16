import { cache } from 'react';
import { db } from '@/db';
import { artists, events, eventArtists, venues } from '@/db/schema';
import { eq, lt, and, desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { generateTourHistoryMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generatePersonSchema } from '@/lib/schema';
import { normalizeGenre, genreSlug } from '@/lib/genres';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { isPackage } from '@/lib/event-utils';
import { slugify, eventSlug } from '@/lib/slugify';
import type { Metadata } from 'next';

export const dynamic = 'force-static';
export const revalidate = 86400; // Revalidate every 24 hours (past data rarely changes)

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string }>;
}

// Tour-history pages are deep, rarely an entry point, and duplicated the full
// ~3K artist set at build time. Render them all on-demand instead
// (dynamicParams = true), ISR-cached for `revalidate` (24h).
export async function generateStaticParams() {
  return [];
}

const getArtist = cache(async function getArtist(slug: string) {
  const artist = await db.query.artists.findFirst({
    where: eq(artists.slug, slug),
  });
  return artist ?? null;
});

interface PastEvent {
  id: string;
  name: string;
  eventDate: Date;
  source: string;
  venueName: string | null;
  venueSlug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

const getPastEvents = cache(async function getPastEvents(artistId: string): Promise<PastEvent[]> {
  const now = new Date();

  const results = await db
    .select({
      id: events.id,
      name: events.name,
      eventDate: events.eventDate,
      source: events.source,
      venueName: venues.name,
      venueCity: venues.city,
      venueState: venues.state,
      venueCountry: venues.country,
    })
    .from(events)
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(
      eq(eventArtists.artistId, artistId),
      lt(events.eventDate, now),
    ))
    .orderBy(desc(events.eventDate));

  // Deduplicate: one event per city+date, preferring non-package events
  const groups = new Map<string, PastEvent>();
  for (const row of results) {
    const dateKey = new Date(row.eventDate).toISOString().slice(0, 10);
    const city = row.venueCity || 'unknown';
    const key = `${city}_${dateKey}`;

    const mapped: PastEvent = {
      id: row.id,
      name: row.name,
      eventDate: new Date(row.eventDate),
      source: row.source,
      venueName: row.venueName,
      venueSlug: row.venueName ? slugify(row.venueName) : null,
      city: row.venueCity,
      state: row.venueState,
      country: row.venueCountry,
    };

    if (!groups.has(key)) {
      groups.set(key, mapped);
    } else if (isPackage(groups.get(key)!.name) && !isPackage(row.name)) {
      groups.set(key, mapped);
    }
  }

  return Array.from(groups.values());
});

const getAvailableYears = cache(async function getAvailableYears(artistId: string): Promise<number[]> {
  const now = new Date();

  const results = await db
    .select({
      year: sql<number>`EXTRACT(YEAR FROM ${events.eventDate})`.as('year'),
    })
    .from(events)
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .where(and(
      eq(eventArtists.artistId, artistId),
      lt(events.eventDate, now),
    ))
    .groupBy(sql`EXTRACT(YEAR FROM ${events.eventDate})`)
    .orderBy(desc(sql`EXTRACT(YEAR FROM ${events.eventDate})`));

  return results.map(r => Number(r.year));
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtist(slug);

  if (!artist) {
    return { title: 'Artist Not Found' };
  }

  const pastEvents = await getPastEvents(artist.id);
  const years = await getAvailableYears(artist.id);

  const cities = new Set<string>();
  pastEvents.forEach(e => { if (e.city) cities.add(e.city); });

  return generateTourHistoryMetadata({
    artistName: artist.name,
    slug: artist.slug,
    totalShows: pastEvents.length,
    cityCount: cities.size,
    years,
    imageUrl: artist.imageUrl,
  });
}

export default async function TourHistoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { year: yearParam } = await searchParams;

  const artist = await getArtist(slug);
  if (!artist) notFound();

  const [allPastEvents, years] = await Promise.all([
    getPastEvents(artist.id),
    getAvailableYears(artist.id),
  ]);

  // Filter by year if specified
  const selectedYear = yearParam ? parseInt(yearParam) : null;
  const pastEvents = selectedYear
    ? allPastEvents.filter(e => e.eventDate.getFullYear() === selectedYear)
    : allPastEvents;

  // Group events by year for display
  const eventsByYear = new Map<number, PastEvent[]>();
  for (const event of pastEvents) {
    const year = event.eventDate.getFullYear();
    if (!eventsByYear.has(year)) eventsByYear.set(year, []);
    eventsByYear.get(year)!.push(event);
  }

  // Stats
  const uniqueCities = new Set(allPastEvents.map(e => e.city).filter(Boolean));
  const uniqueVenues = new Set(allPastEvents.map(e => e.venueName).filter(Boolean));

  const personSchema = generatePersonSchema(artist);
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Artists', url: `${SITE_URL}/artists` },
    { name: artist.name, url: `${SITE_URL}/artists/${artist.slug}` },
    { name: 'Tour History', url: `${SITE_URL}/artists/${artist.slug}/tour-history` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Artists', url: '/artists' },
    { name: artist.name, url: `/artists/${artist.slug}` },
    { name: 'Tour History', url: `/artists/${artist.slug}/tour-history` },
  ];

  return (
    <>
      <StructuredData data={[personSchema, breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-500 to-red-500 shadow-lg">
              {artist.imageUrl ? (
                <Image
                  src={artist.imageUrl}
                  alt={artist.name}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                  sizes="80px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                  {artist.name.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black">
                <Link href={`/artists/${artist.slug}`} className="hover:text-orange-600 transition-colors">
                  <span className="gradient-text">{artist.name}</span>
                </Link>
                {' '}Tour History
              </h1>
              {artist.genre && (
                <Link
                  href={`/tours/${genreSlug(normalizeGenre(artist.genre))}`}
                  className="inline-block mt-2 px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-full hover:from-orange-600 hover:to-red-600 transition-all"
                >
                  {artist.genre}
                </Link>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 text-center">
              <p className="text-3xl font-black text-orange-500">{allPastEvents.length}</p>
              <p className="text-sm text-gray-500 mt-1">Past Shows</p>
            </div>
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 text-center">
              <p className="text-3xl font-black text-orange-500">{uniqueCities.size}</p>
              <p className="text-sm text-gray-500 mt-1">Cities Visited</p>
            </div>
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 text-center">
              <p className="text-3xl font-black text-orange-500">{uniqueVenues.size}</p>
              <p className="text-sm text-gray-500 mt-1">Venues Played</p>
            </div>
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 text-center">
              <p className="text-3xl font-black text-orange-500">{years.length}</p>
              <p className="text-sm text-gray-500 mt-1">Years Touring</p>
            </div>
          </div>

          {/* Year Filter */}
          {years.length > 1 && (
            <nav aria-label="Filter by year" className="flex flex-wrap items-center gap-2 mb-8">
              <span className="text-sm font-semibold text-gray-700 mr-1">Filter by year:</span>
              <Link
                href={`/artists/${artist.slug}/tour-history`}
                aria-current={!selectedYear ? 'page' : undefined}
                className={`px-4 py-2.5 min-h-[44px] inline-flex items-center rounded-lg text-sm font-medium transition-all ${
                  !selectedYear
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-orange-300 hover:text-orange-600'
                }`}
              >
                All
              </Link>
              {years.map(year => (
                <Link
                  key={year}
                  href={`/artists/${artist.slug}/tour-history?year=${year}`}
                  aria-current={selectedYear === year ? 'page' : undefined}
                  className={`px-4 py-2.5 min-h-[44px] inline-flex items-center rounded-lg text-sm font-medium transition-all ${
                    selectedYear === year
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-orange-300 hover:text-orange-600'
                  }`}
                >
                  {year}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Events List */}
        {pastEvents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">
              {selectedYear
                ? `No past shows found for ${selectedYear}.`
                : 'No past tour dates recorded yet.'}
            </p>
            <Link
              href={`/artists/${artist.slug}`}
              className="inline-block mt-4 text-orange-500 hover:text-orange-600 font-semibold transition-colors"
            >
              View upcoming shows
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            {Array.from(eventsByYear.entries()).map(([year, yearEvents]) => (
              <div key={year}>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                  <span className="gradient-text">{year}</span>
                  <span className="text-sm font-normal text-gray-500">
                    {yearEvents.length} show{yearEvents.length === 1 ? '' : 's'}
                  </span>
                </h2>
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                  <div className="divide-y divide-gray-100">
                    {yearEvents.map((event) => {
                      const evSlug = eventSlug(artist.name, event.venueName, event.eventDate);
                      return (
                      <Link key={event.id} href={`/events/${evSlug}`} aria-label={`${event.venueName || event.name}, ${[event.city, event.state].filter(Boolean).join(', ')} — ${event.eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`} className="block p-4 md:p-5 hover:bg-gray-50 transition-colors group">
                        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                          {/* Date */}
                          <time
                            dateTime={event.eventDate.toISOString()}
                            className="flex items-center gap-3 md:w-36 flex-shrink-0"
                          >
                            <div className="w-11 h-11 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold uppercase text-gray-600">
                                {event.eventDate.toLocaleDateString('en-US', { month: 'short' })}
                              </span>
                              <span className="text-sm font-bold text-gray-800">
                                {event.eventDate.toLocaleDateString('en-US', { day: 'numeric' })}
                              </span>
                            </div>
                            <span className="text-sm text-gray-500">
                              {event.eventDate.toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                          </time>

                          {/* Venue & Location */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors text-sm">
                              {event.venueName || event.name}
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {event.city}
                              {event.city && (event.state || event.country) ? ', ' : ''}
                              {[event.state, event.country].filter(Boolean).join(', ')}
                            </p>
                          </div>

                          {/* Arrow indicator */}
                          <svg className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition-colors flex-shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Back to artist + SEO content */}
        <div className="mt-12 space-y-8">
          <div className="flex flex-wrap gap-4">
            <Link
              href={`/artists/${artist.slug}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-600 hover:to-red-600 transition-all shadow-md"
            >
              <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              View Upcoming Shows
            </Link>
          </div>

          {/* SEO paragraph */}
          <section className="max-w-4xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {artist.name} Concert History
            </h2>
            <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-3">
              <p>
                {allPastEvents.length > 0 ? (
                  <>
                    {artist.name} has performed {allPastEvents.length} recorded show{allPastEvents.length === 1 ? '' : 's'}
                    {' '}across {uniqueCities.size} cities and {uniqueVenues.size} venues
                    {years.length > 0 ? ` from ${years[years.length - 1]} to ${years[0]}` : ''}.
                    {' '}Browse the full tour archive above to see every past concert date and venue.
                  </>
                ) : (
                  <>No past concert dates have been recorded for {artist.name} yet.</>
                )}
              </p>
              <p>
                Looking for upcoming shows? Check{' '}
                <Link href={`/artists/${artist.slug}`} className="text-orange-500 hover:text-orange-600 font-medium">
                  {artist.name} tour dates
                </Link>
                {' '}for the latest schedule and ticket prices.
                {artist.genre && (
                  <>
                    {' '}Or browse more{' '}
                    <Link href={`/tours/${genreSlug(normalizeGenre(artist.genre))}`} className="text-orange-500 hover:text-orange-600 font-medium">
                      {normalizeGenre(artist.genre)} tours
                    </Link>.
                  </>
                )}
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
