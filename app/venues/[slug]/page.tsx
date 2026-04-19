import { cache } from 'react';
import { db } from '@/db';
import { artists, events, venues, eventArtists } from '@/db/schema';
import { eq, gte, sql, and, isNotNull, ne, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateVenueMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateVenueSchema, generateVenueEventListSchema, generateFAQSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAffiliateUrl } from '@/lib/affiliate';
import { isPackage } from '@/lib/event-utils';
import { slugify } from '@/lib/slugify';
import Pagination from '@/components/Pagination';
import type { Venue } from '@/db/schema';

export const revalidate = 1800;

const EVENTS_PER_PAGE = 50;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

interface VenueMatch {
  venue: Venue;
  allVenueIds: string[];
}

const getVenueBySlug = cache(async function getVenueBySlug(venueSlug: string): Promise<VenueMatch | null> {
  // Find ALL matching venues by slug (same venue can have multiple DB records from different sources)
  const allVenues = await db
    .select({ venue: venues })
    .from(venues);

  const matches = allVenues.filter(
    (row) => slugify(row.venue.name) === venueSlug
  );

  if (matches.length === 0) return null;

  return {
    venue: matches[0].venue,
    allVenueIds: matches.map((m) => m.venue.id),
  };
});

const getVenueEvents = cache(async function getVenueEvents(venueIds: string[]) {
  const now = new Date();

  const venueEvents = await db
    .select({
      event: events,
      venue: venues,
      artistName: artists.name,
      artistSlug: artists.slug,
      artistImageUrl: artists.imageUrl,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .where(and(
      inArray(events.venueId, venueIds),
      gte(events.eventDate, now)
    ))
    .orderBy(events.eventDate);

  // Deduplicate: keep one event per artist+date, preferring non-package events
  const groups = new Map<string, typeof venueEvents[0]>();
  for (const row of venueEvents) {
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

  // Get all venues with upcoming events
  const topVenues = await db
    .select({
      venueName: venues.name,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(gte(events.eventDate, now))
    .groupBy(venues.name)
    .orderBy(sql`count(*) desc`);

  return topVenues.map((row) => ({
    slug: slugify(row.venueName),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: venueSlug } = await params;
  const match = await getVenueBySlug(venueSlug);

  if (!match) {
    return {
      title: 'Venue Not Found',
      description: 'The venue you are looking for could not be found.',
    };
  }

  const venueEvents = await getVenueEvents(match.allVenueIds);
  const artistNames = [...new Set(venueEvents.map((e) => e.artistName))];
  const nextEventDate = venueEvents.length > 0 ? new Date(venueEvents[0].event.eventDate) : null;

  return generateVenueMetadata({
    venueName: match.venue.name,
    venueSlug,
    city: match.venue.city,
    state: match.venue.state,
    eventCount: venueEvents.length,
    artistNames,
    nextEventDate,
  });
}

export default async function VenuePage({ params, searchParams }: Props) {
  const { slug: venueSlug } = await params;
  const { page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page || '1', 10) || 1);
  const match = await getVenueBySlug(venueSlug);

  if (!match) {
    notFound();
  }

  const { venue } = match;
  const allVenueEvents = await getVenueEvents(match.allVenueIds);
  const totalPages = Math.ceil(allVenueEvents.length / EVENTS_PER_PAGE);
  const venueEvents = allVenueEvents.slice(
    (currentPage - 1) * EVENTS_PER_PAGE,
    currentPage * EVENTS_PER_PAGE
  );

  const locationParts: string[] = [];
  if (venue.city) locationParts.push(venue.city);
  if (venue.state) locationParts.push(venue.state);
  const locationLabel = locationParts.join(', ');

  // Group events by date
  const eventsByDate = venueEvents.reduce((acc, row) => {
    const dateKey = new Date(row.event.eventDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(row);
    return acc;
  }, {} as Record<string, typeof venueEvents>);

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Venues', url: `${SITE_URL}/venues` },
    { name: venue.name, url: `${SITE_URL}/venues/${venueSlug}` },
  ]);

  const venueSchema = generateVenueSchema(venue);

  const eventListSchema = generateVenueEventListSchema(
    venue,
    venueSlug,
    allVenueEvents.slice(0, 50).map((row) => ({
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
    { name: 'Venues', url: '/venues' },
    { name: venue.name, url: `/venues/${venueSlug}` },
  ];

  const year = new Date().getFullYear();
  const uniqueArtistNames = [...new Set(allVenueEvents.map((e) => e.artistName))];

  // Venue stats for enrichment
  const prices = allVenueEvents
    .map((e) => e.event.minPrice)
    .filter((p): p is number => p !== null && p > 0);
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : null;
  const highestPrice = prices.length > 0 ? Math.max(...prices) : null;

  // Monthly event breakdown
  const eventsByMonth: Record<string, number> = {};
  for (const row of allVenueEvents) {
    const monthKey = new Date(row.event.eventDate).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    eventsByMonth[monthKey] = (eventsByMonth[monthKey] || 0) + 1;
  }

  // Genre breakdown from performing artists (deduplicated by artist)
  const artistGenres = new Map<string, string>();
  for (const row of allVenueEvents) {
    // Get genre from the event metadata or artist data if available
    if (!artistGenres.has(row.artistName)) {
      artistGenres.set(row.artistName, '');
    }
  }

  // Next/last event dates
  const nextEventDate = allVenueEvents.length > 0 ? new Date(allVenueEvents[0].event.eventDate) : null;
  const lastEventDate = allVenueEvents.length > 0 ? new Date(allVenueEvents[allVenueEvents.length - 1].event.eventDate) : null;

  const faqs = [
    {
      question: `What upcoming events are at ${venue.name}?`,
      answer: allVenueEvents.length > 0
        ? `There are ${allVenueEvents.length} upcoming event${allVenueEvents.length === 1 ? '' : 's'} on the ${venue.name} schedule${locationLabel ? ` in ${locationLabel}` : ''} for ${year}.${nextEventDate ? ` The next event is on ${nextEventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.` : ''}`
        : `There are currently no upcoming events scheduled at ${venue.name}. Check back for new show announcements.`,
    },
    {
      question: `What concerts are at ${venue.name} this month?`,
      answer: (() => {
        const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const thisMonthCount = eventsByMonth[currentMonth] || 0;
        return thisMonthCount > 0
          ? `There are ${thisMonthCount} concert${thisMonthCount === 1 ? '' : 's'} scheduled at ${venue.name} for ${currentMonth}. Browse the full schedule above to see all shows.`
          : `There are no concerts scheduled at ${venue.name} for ${currentMonth}. Check the full schedule for upcoming months.`;
      })(),
    },
    {
      question: `What artists are performing at ${venue.name}?`,
      answer: uniqueArtistNames.length > 0
        ? `Artists with upcoming shows at ${venue.name} include ${uniqueArtistNames.slice(0, 8).join(', ')}${uniqueArtistNames.length > 8 ? `, and ${uniqueArtistNames.length - 8} more` : ''}.`
        : `Check back for upcoming artist announcements at ${venue.name}.`,
    },
    {
      question: `Where is ${venue.name} located?`,
      answer: venue.address
        ? `${venue.name} is located at ${venue.address}${locationLabel ? `, ${locationLabel}` : ''}.${venue.capacity ? ` The venue has a capacity of ${venue.capacity.toLocaleString()}.` : ''}`
        : `${venue.name} is located${locationLabel ? ` in ${locationLabel}` : ''}.${venue.capacity ? ` The venue has a capacity of ${venue.capacity.toLocaleString()}.` : ''}`,
    },
    {
      question: `How much are tickets for events at ${venue.name}?`,
      answer: lowestPrice && highestPrice
        ? `Ticket prices for upcoming events at ${venue.name} range from $${lowestPrice} to $${highestPrice}. Prices vary by show — compare prices from Ticketmaster and SeatGeek above.`
        : `Ticket prices vary by event at ${venue.name}. Browse the schedule above and click "Get Tickets" to compare prices from Ticketmaster and SeatGeek.`,
    },
    {
      question: `How do I get tickets for concerts at ${venue.name}?`,
      answer: `Browse upcoming concerts at ${venue.name} on TourWax and click "Get Tickets" for any show. We compare prices from Ticketmaster and SeatGeek to help you find the best deals.`,
    },
  ];

  const faqSchema = generateFAQSchema(faqs);

  return (
    <>
      <StructuredData data={[breadcrumbSchema, venueSchema, eventListSchema, faqSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">{venue.name}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-gray-600">
            {locationLabel && (
              <span className="flex items-center gap-2 text-lg">
                <svg className="w-5 h-5 text-gray-400" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {venue.city ? (
                  <Link href={`/concerts/${slugify(venue.city)}`} className="hover:text-orange-600 transition-colors">{locationLabel}</Link>
                ) : (
                  locationLabel
                )}
              </span>
            )}
            {venue.address && (
              <span className="text-sm text-gray-500">{venue.address}</span>
            )}
          </div>
          <p className="text-xl text-gray-600 mt-3">
            {allVenueEvents.length > 0
              ? `${allVenueEvents.length} upcoming show${allVenueEvents.length === 1 ? '' : 's'} & concerts`
              : 'Shows, concerts & upcoming events'
            }
            {totalPages > 1 && ` — Page ${currentPage} of ${totalPages}`}
          </p>
        </div>

        {/* Venue Stats */}
        {allVenueEvents.length > 0 && (
          <section className="mb-10">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 text-center">
                <p className="text-3xl font-black text-orange-600">{allVenueEvents.length}</p>
                <p className="text-sm text-gray-500 mt-1">Upcoming Events</p>
              </div>
              <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 text-center">
                <p className="text-3xl font-black text-orange-600">{uniqueArtistNames.length}</p>
                <p className="text-sm text-gray-500 mt-1">Artists Performing</p>
              </div>
              {lowestPrice && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 text-center">
                  <p className="text-3xl font-black text-orange-600">${lowestPrice}</p>
                  <p className="text-sm text-gray-500 mt-1">Lowest Ticket Price</p>
                </div>
              )}
              {nextEventDate && lastEventDate && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 text-center">
                  <p className="text-3xl font-black text-orange-600">
                    {Object.keys(eventsByMonth).length}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Months with Shows</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Monthly Schedule Overview */}
        {Object.keys(eventsByMonth).length > 1 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{venue.name} Concert Schedule by Month</h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(eventsByMonth).map(([month, count]) => (
                <div key={month} className="bg-white rounded-lg shadow-sm border border-gray-100 px-4 py-2">
                  <span className="font-semibold text-gray-900">{month}</span>
                  <span className="text-gray-500 ml-2">{count} show{count === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Upcoming Shows & Events at {venue.name}
        </h2>

        {venueEvents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">No upcoming shows at {venue.name}.</p>
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

        <Pagination currentPage={currentPage} totalPages={totalPages} basePath={`/venues/${venueSlug}`} />

        {/* About Venue Section */}
        <section className="mt-16 max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">About {venue.name}</h2>
          <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-3">
            <p>
              {venue.name} is a concert venue{locationLabel ? ` located in ${locationLabel}` : ''}.
              {venue.capacity ? ` With a capacity of ${venue.capacity.toLocaleString()}, it is one of the popular live music destinations${venue.city ? ` in ${venue.city}` : ''}.` : ''}
              {venue.address ? ` The venue is located at ${venue.address}.` : ''}
            </p>
            {allVenueEvents.length > 0 && (
              <p>
                The {year} concert schedule at {venue.name} features {allVenueEvents.length} upcoming event{allVenueEvents.length === 1 ? '' : 's'} with {uniqueArtistNames.length} artist{uniqueArtistNames.length === 1 ? '' : 's'} performing, including {uniqueArtistNames.slice(0, 5).join(', ')}{uniqueArtistNames.length > 5 ? ` and ${uniqueArtistNames.length - 5} more` : ''}.
                {nextEventDate && ` The next event is on ${nextEventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`}
                {lowestPrice && highestPrice && lowestPrice !== highestPrice
                  ? ` Ticket prices range from $${lowestPrice} to $${highestPrice}.`
                  : lowestPrice
                    ? ` Tickets start at $${lowestPrice}.`
                    : ''
                }
              </p>
            )}
            <p>
              Compare ticket prices from Ticketmaster and SeatGeek to find the best deals on concerts at {venue.name}.
              {venue.city && (
                <> Looking for more events? Browse{' '}
                  <Link href={`/concerts/${slugify(venue.city)}`} className="text-orange-500 hover:text-orange-600 font-medium">
                    all concerts in {venue.city}
                  </Link>
                  {venue.state && (
                    <> or <Link href={`/concerts/state/${slugify(venue.state)}`} className="text-orange-500 hover:text-orange-600 font-medium">
                      all concerts in {venue.state}
                    </Link></>
                  )}.
                </>
              )}
            </p>
          </div>
        </section>

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
