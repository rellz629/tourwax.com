import { cache } from 'react';
import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, and, sql, gte, lt } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { generateEventPageMetadata, SITE_URL } from '@/lib/seo';
import { generateMusicEventSchema, generateBreadcrumbSchema, generatePersonSchema } from '@/lib/schema';
import { normalizeGenre, genreSlug } from '@/lib/genres';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import ShareButtons from '@/components/ShareButtons';
import { getAffiliateUrl } from '@/lib/affiliate';
import { isPackage } from '@/lib/event-utils';
import { slugify, eventSlug, parseDateFromEventSlug } from '@/lib/slugify';
import type { Metadata } from 'next';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours — past events don't change

interface Props {
  params: Promise<{ slug: string }>;
}

// Generate static params for past events (the long-tail SEO pages)
export async function generateStaticParams() {
  const now = new Date();

  // Get past events with artist and venue info to generate slugs
  const pastEvents = await db
    .select({
      artistName: artists.name,
      eventName: events.name,
      venueName: venues.name,
      eventDate: events.eventDate,
    })
    .from(events)
    .innerJoin(artists, eq(events.artistId, artists.id))
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(lt(events.eventDate, now));

  // Deduplicate slugs (multiple source events produce the same slug)
  const slugSet = new Set<string>();
  const params: { slug: string }[] = [];

  for (const row of pastEvents) {
    if (isPackage(row.eventName)) continue;
    const slug = eventSlug(row.artistName, row.venueName, new Date(row.eventDate));
    if (slug && !slugSet.has(slug)) {
      slugSet.add(slug);
      params.push({ slug });
    }
  }

  return params;
}

interface EventData {
  event: typeof events.$inferSelect;
  artist: typeof artists.$inferSelect;
  venue: typeof venues.$inferSelect | null;
  otherSources: Array<{
    source: string;
    ticketUrl: string | null;
    minPrice: number | null;
    maxPrice: number | null;
  }>;
}

const getEventBySlug = cache(async function getEventBySlug(slug: string): Promise<EventData | null> {
  // Parse the date from the slug
  const dateStr = parseDateFromEventSlug(slug);
  if (!dateStr) return null;

  const date = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(date.getTime())) return null;
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

  // Query events on this date with artist and venue
  const results = await db
    .select({
      event: events,
      artist: artists,
      venue: venues,
    })
    .from(events)
    .innerJoin(artists, eq(events.artistId, artists.id))
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(
      gte(events.eventDate, date),
      lt(events.eventDate, nextDate),
    ))
    .limit(500);

  // Find the event whose generated slug matches
  let primaryEvent: EventData | null = null;

  for (const row of results) {
    const generatedSlug = eventSlug(row.artist.name, row.venue?.name ?? null, new Date(row.event.eventDate));
    if (generatedSlug === slug) {
      if (!primaryEvent || (isPackage(primaryEvent.event.name) && !isPackage(row.event.name))) {
        primaryEvent = {
          event: row.event,
          artist: row.artist,
          venue: row.venue,
          otherSources: [],
        };
      } else if (primaryEvent.event.id !== row.event.id) {
        // Different source for the same concert — add as alternate ticket source
        primaryEvent.otherSources.push({
          source: row.event.source,
          ticketUrl: row.event.ticketUrl,
          minPrice: row.event.minPrice,
          maxPrice: row.event.maxPrice,
        });
      }
    }
  }

  return primaryEvent;
});

// Get other events by this artist near this date (for internal linking)
const getNearbyEvents = cache(async function getNearbyEvents(
  artistId: string,
  eventDate: Date,
  eventId: string
) {
  const start = new Date(eventDate);
  start.setDate(start.getDate() - 30);
  const end = new Date(eventDate);
  end.setDate(end.getDate() + 30);

  const results = await db
    .select({
      event: events,
      venue: venues,
      artistName: artists.name,
      artistSlug: artists.slug,
    })
    .from(events)
    .innerJoin(artists, eq(events.artistId, artists.id))
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(
      eq(events.artistId, artistId),
      gte(events.eventDate, start),
      lt(events.eventDate, end),
      sql`${events.id} != ${eventId}`,
    ))
    .orderBy(events.eventDate)
    .limit(8);

  // Deduplicate by city+date
  const seen = new Set<string>();
  return results.filter(row => {
    if (isPackage(row.event.name)) return false;
    const key = `${row.venue?.city || 'unknown'}_${new Date(row.event.eventDate).toISOString().slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getEventBySlug(slug);

  if (!data) {
    return { title: 'Event Not Found' };
  }

  const { event, artist, venue } = data;
  const isPast = new Date(event.eventDate) < new Date();

  return generateEventPageMetadata({
    artistName: artist.name,
    artistSlug: artist.slug,
    venueName: venue?.name ?? null,
    city: venue?.city ?? null,
    state: venue?.state ?? null,
    eventDate: new Date(event.eventDate),
    slug,
    isPast,
    imageUrl: artist.imageUrl,
    minPrice: event.minPrice,
  });
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const data = await getEventBySlug(slug);

  if (!data) notFound();

  const { event, artist, venue, otherSources } = data;
  const eventDate = new Date(event.eventDate);
  const isPast = eventDate < new Date();

  const nearbyEvents = await getNearbyEvents(artist.id, eventDate, event.id);

  // All ticket sources
  const allSources = [
    { source: event.source, ticketUrl: event.ticketUrl, minPrice: event.minPrice, maxPrice: event.maxPrice },
    ...otherSources,
  ].filter(s => s.ticketUrl && !isPackage(event.name));

  // Structured data
  const eventSchema = generateMusicEventSchema(event, artist, venue);
  if (isPast) {
    eventSchema.eventStatus = 'https://schema.org/EventMovedOnline'; // Google doesn't have "EventCompleted" — closest is removing offers
    delete eventSchema.offers;
  }
  const personSchema = generatePersonSchema(artist);
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Artists', url: `${SITE_URL}/artists` },
    { name: artist.name, url: `${SITE_URL}/artists/${artist.slug}` },
    { name: `${venue?.city || 'Concert'} ${eventDate.getFullYear()}`, url: `${SITE_URL}/events/${slug}` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Artists', url: '/artists' },
    { name: artist.name, url: `/artists/${artist.slug}` },
    { name: `${venue?.city || 'Concert'} ${eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, url: `/events/${slug}` },
  ];

  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: venue?.timezone ?? 'UTC',
  });

  const formattedTime = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: venue?.timezone ?? 'UTC',
  });

  const timezoneAbbr = venue?.timezone
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: venue.timezone,
        timeZoneName: 'short',
      }).formatToParts(eventDate).find(p => p.type === 'timeZoneName')?.value
    : null;

  const location = [venue?.city, venue?.state].filter(Boolean).join(', ');

  return (
    <>
      <StructuredData data={[eventSchema, personSchema, breadcrumbSchema]} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        {/* Past event badge */}
        {isPast && (
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">
            <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            This concert has already taken place
          </div>
        )}

        {/* Event Header */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 mb-8">
          <div className="relative h-32 bg-gradient-to-br from-orange-500 via-red-500 to-pink-600">
            <div className="absolute inset-0 bg-black/20"></div>
          </div>
          <div className="px-6 md:px-8 pb-8 -mt-16 relative z-10">
            <div className="flex flex-col md:flex-row items-start gap-6">
              {/* Artist Image */}
              <div className="w-32 h-32 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-500 to-red-500 ring-4 ring-white shadow-xl">
                {artist.imageUrl ? (
                  <Image
                    src={artist.imageUrl}
                    alt={artist.name}
                    width={128}
                    height={128}
                    priority
                    className="w-full h-full object-cover"
                    sizes="128px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                    {artist.name.charAt(0)}
                  </div>
                )}
              </div>

              {/* Event Info */}
              <div className="flex-1 md:pt-12">
                <h1 className="text-3xl md:text-4xl font-black mb-2">
                  <Link href={`/artists/${artist.slug}`} className="hover:text-orange-600 transition-colors">
                    <span className="gradient-text">{artist.name}</span>
                  </Link>
                </h1>
                <p className="text-lg text-gray-700 font-medium mb-1">{event.name}</p>
                {artist.genre && (
                  <Link
                    href={`/tours/${genreSlug(normalizeGenre(artist.genre))}`}
                    className="inline-block mb-4 px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-full hover:from-orange-600 hover:to-red-600 transition-all"
                  >
                    {artist.genre}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Event Details Card */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 md:p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date & Time */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0 shadow-lg">
                <span className="text-xs font-semibold uppercase">
                  {eventDate.toLocaleDateString('en-US', { month: 'short', timeZone: venue?.timezone ?? 'UTC' })}
                </span>
                <span className="text-xl font-bold">
                  {eventDate.toLocaleDateString('en-US', { day: 'numeric', timeZone: venue?.timezone ?? 'UTC' })}
                </span>
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Date & Time</h2>
                <p className="text-gray-700">
                  <time dateTime={eventDate.toISOString()}>{formattedDate}</time>
                </p>
                <p className="text-gray-500 text-sm">{formattedTime}{timezoneAbbr ? ` ${timezoneAbbr}` : ''}</p>
              </div>
            </div>

            {/* Venue & Location */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-lg">
                <svg className="w-7 h-7" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Venue</h2>
                {venue ? (
                  <>
                    <Link
                      href={`/venues/${slugify(venue.name)}`}
                      className="text-gray-700 hover:text-orange-600 font-medium transition-colors"
                    >
                      {venue.name}
                    </Link>
                    {location && (
                      <p className="text-gray-500 text-sm">
                        {venue.city ? (
                          <Link href={`/concerts/${slugify(venue.city)}`} className="hover:text-orange-600 transition-colors">
                            {location}
                          </Link>
                        ) : (
                          <span>{location}</span>
                        )}
                        {venue.country && venue.country !== 'US' ? `, ${venue.country}` : ''}
                      </p>
                    )}
                    {venue.address && (
                      <p className="text-gray-400 text-xs mt-0.5">{venue.address}</p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500">Venue TBA</p>
                )}
              </div>
            </div>
          </div>

          {/* Ticket Buttons */}
          {!isPast && allSources.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h2 className="font-bold text-gray-900 mb-3">Buy Tickets</h2>
              <div className="flex flex-wrap gap-3">
                {allSources.map((ts, i) => (
                  ts.ticketUrl && (
                    <a
                      key={i}
                      href={getAffiliateUrl(ts.ticketUrl, ts.source)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm text-white transition-all shadow-md hover:shadow-lg ${
                        ts.source.toLowerCase() === 'seatgeek'
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                          : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                      }`}
                    >
                      {ts.minPrice ? (
                        <span>From ${ts.minPrice}</span>
                      ) : (
                        <span>Get Tickets</span>
                      )}
                      <span className="text-white/80">—</span>
                      <span className="capitalize">{ts.source}</span>
                      <span className="sr-only">(opens in new tab)</span>
                    </a>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Share */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <ShareButtons
              url={`${SITE_URL}/events/${slug}`}
              title={`${artist.name} at ${venue?.name || 'Concert'} — ${formattedDate}`}
            />
          </div>
        </div>

        {/* Nearby Events on This Tour */}
        {nearbyEvents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              More <span className="gradient-text">{artist.name}</span> Shows
            </h2>
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {nearbyEvents.map(({ event: nearEvent, venue: nearVenue, artistName, artistSlug: aSlug }) => {
                  const nearDate = new Date(nearEvent.eventDate);
                  const nearSlug = eventSlug(artistName, nearVenue?.name ?? null, nearDate);
                  const nearIsPast = nearDate < new Date();
                  return (
                    <Link
                      key={nearEvent.id}
                      href={`/events/${nearSlug}`}
                      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors group"
                    >
                      <time
                        dateTime={nearDate.toISOString()}
                        className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center flex-shrink-0 ${
                          nearIsPast
                            ? 'bg-gray-200 text-gray-600'
                            : 'bg-gradient-to-br from-orange-500 to-red-500 text-white'
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase">
                          {nearDate.toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-sm font-bold">
                          {nearDate.toLocaleDateString('en-US', { day: 'numeric' })}
                        </span>
                      </time>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors text-sm truncate">
                          {nearVenue?.name || nearEvent.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {[nearVenue?.city, nearVenue?.state].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      {nearIsPast && (
                        <span className="text-xs text-gray-400 flex-shrink-0">Past</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 text-center">
              <Link
                href={`/artists/${artist.slug}/tour-history`}
                className="text-sm text-orange-500 hover:text-orange-600 font-semibold transition-colors"
              >
                View full tour history
              </Link>
            </div>
          </div>
        )}

        {/* SEO Content */}
        <section className="max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {artist.name} {isPast ? 'Concert' : 'Live'} at {venue?.name || 'This Venue'}
          </h2>
          <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-3">
            <p>
              {isPast ? (
                <>
                  {artist.name} performed at {venue?.name || 'this venue'}{location ? ` in ${location}` : ''} on {formattedDate}.
                  {nearbyEvents.length > 0 && ` This was part of a tour with ${nearbyEvents.length} other shows in the area.`}
                  {' '}Browse the{' '}
                  <Link href={`/artists/${artist.slug}/tour-history`} className="text-orange-500 hover:text-orange-600 font-medium">
                    complete {artist.name} tour history
                  </Link>
                  {' '}or check{' '}
                  <Link href={`/artists/${artist.slug}`} className="text-orange-500 hover:text-orange-600 font-medium">
                    upcoming {artist.name} tour dates
                  </Link>.
                </>
              ) : (
                <>
                  {artist.name} is performing at {venue?.name || 'this venue'}{location ? ` in ${location}` : ''} on {formattedDate}.
                  {allSources.length > 0 && ' Compare ticket prices above from multiple sources to find the best deal.'}
                  {' '}See all{' '}
                  <Link href={`/artists/${artist.slug}`} className="text-orange-500 hover:text-orange-600 font-medium">
                    {artist.name} tour dates
                  </Link>.
                </>
              )}
            </p>
            {venue?.city && (
              <p>
                Looking for more concerts{location ? ` in ${location}` : ''}? Browse{' '}
                <Link href={`/concerts/${slugify(venue.city)}`} className="text-orange-500 hover:text-orange-600 font-medium">
                  all shows in {venue.city}
                </Link>
                {artist.genre && (
                  <>
                    {' '}or explore{' '}
                    <Link href={`/tours/${genreSlug(normalizeGenre(artist.genre))}`} className="text-orange-500 hover:text-orange-600 font-medium">
                      {normalizeGenre(artist.genre)} tours
                    </Link>
                  </>
                )}.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
