import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, gte, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateVenueMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateVenueSchema, generateVenueEventListSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAffiliateUrl } from '@/lib/affiliate';
import { slugify } from '@/lib/slugify';
import type { Venue } from '@/db/schema';

export const dynamic = 'force-static';
export const revalidate = 1800;

interface Props {
  params: Promise<{ slug: string }>;
}

interface VenueMatch {
  venue: Venue;
  allVenueIds: string[];
}

async function getVenueBySlug(venueSlug: string): Promise<VenueMatch | null> {
  const now = new Date();

  // Get all venues with future events
  const venuesWithEvents = await db
    .selectDistinct({
      venue: venues,
    })
    .from(venues)
    .innerJoin(events, eq(events.venueId, venues.id))
    .where(gte(events.eventDate, now));

  // Find ALL matching venues by slug (same venue can have multiple DB records from different sources)
  const matches = venuesWithEvents.filter(
    (row) => slugify(row.venue.name) === venueSlug
  );

  if (matches.length === 0) return null;

  return {
    venue: matches[0].venue,
    allVenueIds: matches.map((m) => m.venue.id),
  };
}

async function getVenueEvents(venueIds: string[]) {
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
    .innerJoin(artists, eq(events.artistId, artists.id))
    .where(
      sql`${events.venueId} IN ${venueIds} AND ${events.eventDate} >= ${now}`
    )
    .orderBy(events.eventDate);

  // Deduplicate: keep one event per artist+date, preferring non-package events
  const packageKeywords = ['vip', 'package', 'upgrade', 'comfort seat', 'suite',
    'box seat', 'vinyl room', 'premium', 'platinum', 'hospitality', 'club level',
    'logen-seat', 'payment plan', 'upsell', 'excluding concert ticket'];
  const isPackage = (name: string) =>
    packageKeywords.some(kw => name.toLowerCase().includes(kw));

  const groups = new Map<string, typeof venueEvents[0]>();
  for (const row of venueEvents) {
    const dateKey = new Date(row.event.eventDate).toISOString().slice(0, 10);
    const key = `${row.event.artistId}_${dateKey}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, row);
    } else if (isPackage(existing.event.name) && !isPackage(row.event.name)) {
      groups.set(key, row);
    }
  }
  return Array.from(groups.values());
}

export async function generateStaticParams() {
  const now = new Date();

  // Get top 50 venues by event count
  const topVenues = await db
    .select({
      venueName: venues.name,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(gte(events.eventDate, now))
    .groupBy(venues.name)
    .orderBy(sql`count(*) desc`)
    .limit(50);

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

  return generateVenueMetadata({
    venueName: match.venue.name,
    venueSlug,
    city: match.venue.city,
    state: match.venue.state,
    eventCount: venueEvents.length,
    artistNames,
  });
}

export default async function VenuePage({ params }: Props) {
  const { slug: venueSlug } = await params;
  const match = await getVenueBySlug(venueSlug);

  if (!match) {
    notFound();
  }

  const { venue } = match;
  const venueEvents = await getVenueEvents(match.allVenueIds);

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
    venueEvents.map((row) => ({
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

  return (
    <>
      <StructuredData data={[breadcrumbSchema, venueSchema, eventListSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">{venue.name}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-gray-600">
            {locationLabel && (
              <span className="flex items-center gap-2 text-lg">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {venueEvents.length} upcoming show{venueEvents.length === 1 ? '' : 's'}
          </p>
        </div>

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
