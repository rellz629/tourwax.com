import { cache } from 'react';
import { db } from '@/db';
import { artists, events, venues, newsArticles } from '@/db/schema';
import { eq, gte, and, desc, ne, sql, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ARTIST_TWITTER_HANDLES } from '@/lib/twitter';
import { generateArtistMetadata, SITE_URL, extractCitiesFromEvents } from '@/lib/seo';
import { generatePersonSchema, generateMusicEventSchema, generateBreadcrumbSchema, generateNewsArticleSchema, generateFAQSchema } from '@/lib/schema';
import { normalizeGenre, genreSlug } from '@/lib/genres';
import ShareButtons from '@/components/ShareButtons';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAffiliateUrl } from '@/lib/affiliate';
import { isPackage } from '@/lib/event-utils';
import { slugify } from '@/lib/slugify';
import { getArtistSetlists } from '@/lib/setlistfm';
import AddToCalendarButton from '@/components/AddToCalendarButton';
import type { Metadata } from 'next';

// Use Static Site Generation with ISR
export const dynamic = 'force-static';
export const revalidate = 1800; // Revalidate every 30 minutes

interface Props {
  params: Promise<{ slug: string }>;
}

// Generate static params for all artists at build time
export async function generateStaticParams() {
  const allArtists = await db
    .select({ slug: artists.slug })
    .from(artists)
    .where(eq(artists.isActive, true));

  return allArtists.map((artist) => ({
    slug: artist.slug,
  }));
}

const getArtist = cache(async function getArtist(slug: string) {
  const artist = await db.query.artists.findFirst({
    where: eq(artists.slug, slug),
  });

  if (!artist) return null;
  return artist;
});

interface TicketSource {
  source: string;
  ticketUrl: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
}

interface GroupedEvent {
  event: typeof events.$inferSelect;
  venue: typeof venues.$inferSelect | null;
  ticketSources: TicketSource[];
}

const getArtistEvents = cache(async function getArtistEvents(artistId: string): Promise<GroupedEvent[]> {
  const now = new Date();

  const artistEvents = await db
    .select({
      event: events,
      venue: venues,
    })
    .from(events)
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(
      eq(events.artistId, artistId),
      gte(events.eventDate, now)
    ))
    .orderBy(events.eventDate);

  // Deduplicate: keep one event per date+city, preferring non-package events
  // Collect all ticket sources for each group

  // Build a lookup from city+date to group key, also checking adjacent dates
  // to catch cross-source events that land on different UTC dates
  const groups = new Map<string, GroupedEvent>();

  function findGroupKey(city: string, eventDate: Date): string | null {
    const dateKey = eventDate.toISOString().slice(0, 10);
    const directKey = `${city}_${dateKey}`;
    if (groups.has(directKey)) return directKey;

    // Check adjacent date (previous day) for cross-source timezone mismatches
    const prevDate = new Date(eventDate);
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const prevKey = `${city}_${prevDate.toISOString().slice(0, 10)}`;
    if (groups.has(prevKey)) {
      const existing = groups.get(prevKey)!;
      const existingTime = new Date(existing.event.eventDate).getTime();
      const curTime = eventDate.getTime();
      // Only merge if within 6 hours (same concert, different UTC dates)
      if (Math.abs(curTime - existingTime) < 6 * 60 * 60 * 1000) {
        return prevKey;
      }
    }

    // Check next day
    const nextDate = new Date(eventDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const nextKey = `${city}_${nextDate.toISOString().slice(0, 10)}`;
    if (groups.has(nextKey)) {
      const existing = groups.get(nextKey)!;
      const existingTime = new Date(existing.event.eventDate).getTime();
      const curTime = eventDate.getTime();
      if (Math.abs(curTime - existingTime) < 6 * 60 * 60 * 1000) {
        return nextKey;
      }
    }

    return null;
  }

  for (const row of artistEvents) {
    const eventDate = new Date(row.event.eventDate);
    const dateKey = eventDate.toISOString().slice(0, 10);
    const city = row.venue?.city || 'unknown';

    const ticketSource: TicketSource = {
      source: row.event.source,
      ticketUrl: row.event.ticketUrl,
      minPrice: row.event.minPrice,
      maxPrice: row.event.maxPrice,
      currency: row.event.currency,
    };

    const existingKey = findGroupKey(city, eventDate);
    const existing = existingKey ? groups.get(existingKey) : null;

    if (!existing) {
      const key = `${city}_${dateKey}`;
      groups.set(key, {
        event: row.event,
        venue: row.venue,
        ticketSources: isPackage(row.event.name) ? [] : [ticketSource],
      });
    } else {
      // Add non-package events as ticket sources
      if (!isPackage(row.event.name)) {
        existing.ticketSources.push(ticketSource);
        // If current primary is a package, replace it with this non-package event
        if (isPackage(existing.event.name)) {
          existing.event = row.event;
          existing.venue = row.venue;
        }
      }
    }
  }

  return Array.from(groups.values());
});

async function getArtistNews(artistId: string) {
  const news = await db
    .select()
    .from(newsArticles)
    .where(eq(newsArticles.artistId, artistId))
    .orderBy(desc(newsArticles.publishedAt))
    .limit(10);

  return news;
}

async function getRelatedArtists(artistId: string, genre: string | null, artistCities: string[]) {
  if (!genre) return [];
  const normalized = normalizeGenre(genre);
  const now = new Date();

  // Get same-genre artists with upcoming event counts, excluding current artist
  const allArtists = await db
    .select({
      id: artists.id,
      name: artists.name,
      slug: artists.slug,
      imageUrl: artists.imageUrl,
      genre: artists.genre,
      eventCount: sql<number>`count(${events.id})`.as('event_count'),
    })
    .from(artists)
    .leftJoin(events, and(eq(events.artistId, artists.id), gte(events.eventDate, now)))
    .where(and(eq(artists.isActive, true), ne(artists.id, artistId)))
    .groupBy(artists.id)
    .orderBy(sql`count(${events.id}) desc`);

  // Filter by normalized genre in JS (same pattern as genre pages)
  const sameGenre = allArtists
    .filter((a) => normalizeGenre(a.genre) === normalized && a.eventCount > 0);

  if (sameGenre.length === 0) return [];

  // Get cities for related artists to find shared touring cities
  const artistCitySet = new Set(artistCities.map(c => c.split(',')[0].trim().toLowerCase()));
  const relatedIds = sameGenre.slice(0, 30).map(a => a.id);

  const relatedEvents = await db
    .select({
      artistId: events.artistId,
      city: venues.city,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(and(
      inArray(events.artistId, relatedIds),
      gte(events.eventDate, now),
    ));

  // Build city set per artist
  const artistCitiesMap = new Map<string, Set<string>>();
  for (const row of relatedEvents) {
    if (!row.city) continue;
    if (!artistCitiesMap.has(row.artistId)) artistCitiesMap.set(row.artistId, new Set());
    artistCitiesMap.get(row.artistId)!.add(row.city);
  }

  // Compute shared cities and sort by most shared cities first
  const withSharedCities = sameGenre.slice(0, 30).map(a => {
    const theirCities = artistCitiesMap.get(a.id) || new Set<string>();
    const shared = Array.from(theirCities).filter(c => artistCitySet.has(c.toLowerCase()));
    return { ...a, sharedCities: shared };
  });

  // Prioritize artists with shared cities, then by event count
  withSharedCities.sort((a, b) => {
    if (b.sharedCities.length !== a.sharedCities.length) return b.sharedCities.length - a.sharedCities.length;
    return b.eventCount - a.eventCount;
  });

  return withSharedCities.slice(0, 6);
}

function generateArtistFAQs(
  artistName: string,
  genre: string | null,
  eventCount: number,
  cities: string[],
  nextEvent: { date: Date; venueName: string | null; city: string | null } | null
) {
  const year = new Date().getFullYear();
  const faqs: Array<{ question: string; answer: string }> = [];

  // Q1: Next concert
  if (nextEvent) {
    const dateStr = new Date(nextEvent.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const location = [nextEvent.venueName, nextEvent.city].filter(Boolean).join(' in ');
    faqs.push({
      question: `When is ${artistName}'s next concert?`,
      answer: `${artistName}'s next upcoming concert is on ${dateStr}${location ? ` at ${location}` : ''}. Check this page for the full list of upcoming tour dates and ticket links.`,
    });
  } else {
    faqs.push({
      question: `When is ${artistName}'s next concert?`,
      answer: `${artistName} does not have any upcoming concerts announced at this time. Check back regularly as new tour dates are added frequently.`,
    });
  }

  // Q2: Ticket sources
  faqs.push({
    question: `Where can I buy ${artistName} concert tickets?`,
    answer: `You can buy ${artistName} tickets through Ticketmaster and SeatGeek. TourWax compares prices from multiple ticket sources so you can find the best deal for each show.`,
  });

  // Q3: Show count
  if (eventCount > 0) {
    const cityText = cities.length > 0
      ? ` in cities including ${cities.slice(0, 5).join(', ')}${cities.length > 5 ? ', and more' : ''}`
      : '';
    faqs.push({
      question: `How many upcoming ${artistName} shows are there?`,
      answer: `${artistName} currently has ${eventCount} upcoming show${eventCount === 1 ? '' : 's'} scheduled${cityText}.`,
    });
  }

  // Q4: Genre
  if (genre) {
    const normalized = normalizeGenre(genre);
    faqs.push({
      question: `What genre is ${artistName}?`,
      answer: `${artistName} is a ${normalized} artist. Browse more ${normalized} tours and concerts on TourWax.`,
    });
  }

  // Q5: Tour cities
  if (cities.length > 0) {
    faqs.push({
      question: `What cities is ${artistName} touring in ${year}?`,
      answer: `${artistName} has concerts scheduled in ${cities.join(', ')}. Visit the tour dates section above for full venue details and ticket links.`,
    });
  }

  return faqs;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtist(slug);

  if (!artist) {
    return {
      title: 'Artist Not Found',
      description: 'The artist you are looking for could not be found.',
    };
  }

  const artistEvents = await getArtistEvents(artist.id);

  return generateArtistMetadata({
    artist,
    events: artistEvents,
  });
}

export default async function ArtistPage({ params }: Props) {
  const { slug } = await params;

  // First get the artist to get their ID
  const artist = await getArtist(slug);

  if (!artist) {
    notFound();
  }

  // Fetch events and news first (related artists needs cities from events)
  const [artistEvents, news, setlists] = await Promise.all([
    getArtistEvents(artist.id),
    getArtistNews(artist.id),
    getArtistSetlists(artist.name),
  ]);

  // Extract cities for related artist matching
  const cities = extractCitiesFromEvents(artistEvents);
  const relatedArtists = await getRelatedArtists(artist.id, artist.genre, cities);

  // Get Twitter handle for this artist
  const twitterHandle = ARTIST_TWITTER_HANDLES[artist.name];

  // Prepare FAQ data
  const nextEvent = artistEvents.length > 0
    ? { date: artistEvents[0].event.eventDate, venueName: artistEvents[0].venue?.name ?? null, city: artistEvents[0].venue?.city ?? null }
    : null;
  const faqs = generateArtistFAQs(artist.name, artist.genre, artistEvents.length, cities, nextEvent);

  // Generate structured data schemas
  const personSchema = generatePersonSchema(artist);
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Artists', url: `${SITE_URL}/artists` },
    { name: artist.name, url: `${SITE_URL}/artists/${artist.slug}` },
  ]);
  const eventSchemas = artistEvents.map(({ event, venue }) =>
    generateMusicEventSchema(event, artist, venue)
  );
  // Deduplicate ticket sources for display (remove duplicates from same source)
  const deduplicatedEvents = artistEvents.map(grouped => ({
    ...grouped,
    ticketSources: grouped.ticketSources.filter((ts, i, arr) =>
      arr.findIndex(t => t.source === ts.source) === i
    ),
  }));
  const newsSchemas = news.map((article) => generateNewsArticleSchema(article));
  const faqSchema = generateFAQSchema(faqs);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Artists', url: '/artists' },
    { name: artist.name, url: `/artists/${artist.slug}` },
  ];

  return (
    <>
      <StructuredData data={[personSchema, breadcrumbSchema, faqSchema, ...eventSchemas, ...newsSchemas]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Breadcrumbs items={breadcrumbItems} />
      {/* Artist Header */}
      <div className="mb-16">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="relative h-48 bg-gradient-to-br from-orange-500 via-red-500 to-pink-600">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent"></div>
          </div>
          <div className="px-8 pb-8">
            <div className="flex flex-col md:flex-row items-start gap-8 -mt-24 relative z-10">
              <div className="w-48 h-48 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-500 to-red-500 ring-8 ring-white shadow-2xl">
                {artist.imageUrl ? (
                  <Image
                    src={artist.imageUrl}
                    alt={artist.name}
                    width={192}
                    height={192}
                    priority
                    className="w-full h-full object-cover"
                    sizes="192px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-6xl font-bold">
                    {artist.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 md:pt-20">
                <h1 className="text-5xl md:text-6xl font-black mb-3">
                  <span className="gradient-text">{artist.name}</span>
                </h1>
                {artist.genre && (
                  <div className="inline-flex items-center gap-2 mb-4">
                    <Link
                      href={`/tours/${genreSlug(normalizeGenre(artist.genre))}`}
                      className="px-4 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold rounded-full hover:from-orange-600 hover:to-red-600 transition-all"
                    >
                      {artist.genre}
                    </Link>
                  </div>
                )}
                {artist.bio && (
                  <p className="text-gray-700 mb-6 max-w-3xl leading-relaxed text-lg">
                    {artist.bio}
                  </p>
                )}
                {(artist.spotifyId || artist.ticketmasterId) && (
                  <div className="flex items-center gap-3 mb-6">
                    {artist.spotifyId && (
                      <a
                        href={`https://open.spotify.com/artist/${artist.spotifyId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#1DB954] text-white text-sm font-semibold rounded-lg hover:bg-[#1ed760] transition-colors"
                      >
                        <svg className="w-4 h-4" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                        Spotify
                        <span className="sr-only">(opens in new tab)</span>
                      </a>
                    )}
                    {artist.ticketmasterId && (
                      <a
                        href={`https://www.ticketmaster.com/artist/${artist.ticketmasterId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#026CDF] text-white text-sm font-semibold rounded-lg hover:bg-[#0256b3] transition-colors"
                      >
                        <svg className="w-4 h-4" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22c-5.523 0-10-4.477-10-10S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-2-15v10l8-5-8-5z" />
                        </svg>
                        Ticketmaster
                        <span className="sr-only">(opens in new tab)</span>
                      </a>
                    )}
                  </div>
                )}
                <div className="mb-4">
                  <ShareButtons url={`${SITE_URL}/artists/${artist.slug}`} title={`${artist.name} Tour Dates & Concerts`} />
                </div>
                <div className="flex flex-wrap gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg">{artistEvents.length}</p>
                      <p className="text-gray-500 text-xs">Upcoming Shows</p>
                    </div>
                  </div>
                  {(() => {
                    const prices = artistEvents
                      .flatMap(g => g.ticketSources)
                      .map(ts => ts.minPrice)
                      .filter((p): p is number => p !== null && p > 0);
                    const lowestPrice = prices.length > 0 ? Math.min(...prices) : null;
                    return lowestPrice ? (
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-green-600" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-lg">From ${lowestPrice}</p>
                          <p className="text-gray-500 text-xs">Ticket Price</p>
                        </div>
                      </div>
                    ) : null;
                  })()}
                  {news.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-600" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-lg">{news.length}</p>
                        <p className="text-gray-500 text-xs">Recent Articles</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tour Dates */}
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-3xl font-bold">
              Tour <span className="gradient-text">Dates</span>
            </h2>
            {deduplicatedEvents.length > 0 && (
              <a
                href={`/api/calendar?artistSlug=${artist.slug}`}
                download
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Export All Dates
              </a>
            )}
          </div>
          {artistEvents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-orange-500" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg">No upcoming tour dates announced yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {deduplicatedEvents.map(({ event, venue, ticketSources }) => (
                <div
                  key={event.id}
                  className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover p-6 border border-gray-100"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                    <div className="flex-1">
                      <div className="flex items-start gap-4 mb-4">
                        <time dateTime={new Date(event.eventDate).toISOString()} className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0 shadow-lg">
                          <span className="text-xs font-semibold uppercase">
                            {new Date(event.eventDate).toLocaleDateString('en-US', {
                              month: 'short',
                              timeZone: venue?.timezone ?? 'UTC',
                            })}
                          </span>
                          <span className="text-xl font-bold">
                            {new Date(event.eventDate).toLocaleDateString('en-US', {
                              day: 'numeric',
                              timeZone: venue?.timezone ?? 'UTC',
                            })}
                          </span>
                        </time>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 mb-2 text-lg group-hover:text-orange-600 transition-colors">
                            {event.name}
                          </h3>
                          {venue && (
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-400" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <Link href={`/venues/${slugify(venue.name)}`} className="font-semibold text-gray-700 hover:text-orange-600 transition-colors">{venue.name}</Link>
                              </div>
                              <p className="ml-6">
                                {venue.city ? (
                                  <Link href={`/concerts/${slugify(venue.city)}`} className="hover:text-orange-600 transition-colors">{venue.city}</Link>
                                ) : null}
                                {venue.city && (venue.state || venue.country) ? ', ' : ''}
                                {[venue.state, venue.country].filter(Boolean).join(', ')}
                              </p>
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {new Date(event.eventDate).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                timeZone: venue?.timezone ?? 'UTC',
                              })}
                              {venue?.timezone && (
                                <span>
                                  {' '}
                                  {new Intl.DateTimeFormat('en-US', {
                                    timeZone: venue.timezone,
                                    timeZoneName: 'short',
                                  }).formatToParts(event.eventDate).find(p => p.type === 'timeZoneName')?.value}
                                </span>
                              )}
                            </span>
                            <AddToCalendarButton eventId={event.id} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end w-full md:w-auto">
                      {ticketSources.length > 0 ? (
                        ticketSources.map((ts) => (
                          ts.ticketUrl && (
                            <a
                              key={ts.source}
                              href={getAffiliateUrl(ts.ticketUrl, ts.source)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm text-white whitespace-nowrap transition-all shadow-md hover:shadow-lg w-full md:w-auto ${
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
                        ))
                      ) : (
                        event.ticketUrl && (
                          <a
                            href={getAffiliateUrl(event.ticketUrl, event.source)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary whitespace-nowrap"
                          >
                            Get Tickets
                            <span className="sr-only">(opens in new tab)</span>
                          </a>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* News & Social Sidebar */}
        <div className="space-y-6">
          {/* Follow on X */}
          {twitterHandle && (
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                    <svg className="w-7 h-7 text-blue-500" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-lg">Follow on X</p>
                    <p className="text-blue-100 text-sm">@{twitterHandle}</p>
                  </div>
                </div>
                <p className="text-sm text-blue-50 mb-4 leading-relaxed">
                  Get the latest updates, tour announcements, and behind-the-scenes content.
                </p>
                <a
                  href={`https://twitter.com/${twitterHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-bold shadow-lg"
                >
                  Follow @{twitterHandle}
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              </div>
            </div>
          )}

          {/* Latest News */}
          <div>
            <h2 className="text-2xl font-bold mb-4">
              Latest <span className="gradient-text">News</span>
            </h2>
            {news.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-8 text-center border border-gray-100">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-500" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">No recent news articles.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {news.map((article) => (
                  <a
                    key={article.id}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block bg-white rounded-xl shadow-md hover:shadow-2xl card-hover p-4 border border-gray-100"
                  >
                    {article.imageUrl && (
                      <div className="overflow-hidden rounded-lg mb-3">
                        <Image
                          src={article.imageUrl}
                          alt={article.title}
                          width={400}
                          height={128}
                          className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 768px) 100vw, 400px"
                        />
                      </div>
                    )}
                    <h3 className="font-bold text-gray-900 group-hover:text-orange-600 mb-2 text-sm line-clamp-2 transition-colors">
                      {article.title}
                      <span className="sr-only">(opens in new tab)</span>
                    </h3>
                    {article.summary && (
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                        {article.summary}
                      </p>
                    )}
                    <div className="flex justify-between items-center text-xs">
                      {article.source && (
                        <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded font-semibold">
                          {article.source}
                        </span>
                      )}
                      <time dateTime={new Date(article.publishedAt).toISOString()} className="text-gray-500">
                        {new Date(article.publishedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </time>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Setlists */}
      {setlists.length > 0 && (
        <div className="mt-16">
          <h2 className="text-3xl font-bold mb-6">
            Recent <span className="gradient-text">Setlists</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {setlists.map((setlist) => (
              <div key={setlist.id} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <p className="font-bold text-gray-900 text-sm">{setlist.venueName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{setlist.cityName}</p>
                  <time dateTime={setlist.date} className="text-xs text-gray-500 mt-1 block">
                    {new Date(setlist.date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </time>
                </div>
                <ol className="p-5 space-y-1.5 max-h-96 overflow-y-auto">
                  {setlist.songs.map((song, i) => (
                    <li key={i} value={i + 1} className="flex items-start gap-2 text-sm">
                      {song.encore ? (
                        <span className="text-xs font-bold text-orange-500 mt-0.5 w-6 text-right flex-shrink-0">E{song.encore}</span>
                      ) : (
                        <span className="text-xs text-gray-500 mt-0.5 w-6 text-right flex-shrink-0">{i + 1}</span>
                      )}
                      <span className={`${song.isTape ? 'text-gray-400 italic' : 'text-gray-700'}`}>
                        {song.name}
                        {song.isCover && song.coverArtist && (
                          <span className="text-gray-400 text-xs ml-1">({song.coverArtist} cover)</span>
                        )}
                        {song.info && (
                          <span className="text-gray-400 text-xs ml-1">({song.info})</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="px-5 pb-4">
                  <a
                    href={setlist.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors"
                  >
                    View on setlist.fm
                    <span className="sr-only">(opens in new tab)</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cities on This Tour */}
      {cities.length > 0 && (
        <div className="mt-16">
          <h2 className="text-3xl font-bold mb-6">
            Cities on This <span className="gradient-text">Tour</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {cities.map((city) => {
              const cityName = city.split(',')[0].trim();
              return (
                <Link
                  key={city}
                  href={`/concerts/${slugify(cityName)}`}
                  className="px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-100 text-sm font-medium text-gray-700 hover:text-orange-600 hover:border-orange-200 hover:shadow-md transition-all"
                >
                  {city}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Similar Artists On Tour */}
      {relatedArtists.length > 0 && (
        <div className="mt-16">
          <h2 className="text-3xl font-bold mb-2">
            Similar Artists <span className="gradient-text">On Tour</span>
          </h2>
          <p className="text-gray-500 mb-6">If you like {artist.name}, check out these {normalizeGenre(artist.genre)} artists currently touring</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {relatedArtists.map((related) => (
              <Link
                key={related.id}
                href={`/artists/${related.slug}`}
                className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover overflow-hidden border border-gray-100"
              >
                <div className="aspect-square bg-gradient-to-br from-orange-400 via-red-400 to-pink-500 relative overflow-hidden">
                  {related.imageUrl ? (
                    <Image
                      src={related.imageUrl}
                      alt={related.name}
                      width={200}
                      height={200}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      sizes="(max-width: 768px) 50vw, 16vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
                      {related.name.charAt(0)}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                <div className="p-3 bg-white">
                  <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors text-sm line-clamp-1">
                    {related.name}
                  </h3>
                  {related.sharedCities.length > 0 ? (
                    <p className="text-xs text-orange-600 font-medium mt-1 line-clamp-1">
                      Also in {related.sharedCities.slice(0, 2).join(', ')}{related.sharedCities.length > 2 ? ` +${related.sharedCities.length - 2}` : ''}
                    </p>
                  ) : related.eventCount > 0 ? (
                    <p className="text-xs text-gray-500 mt-1">{related.eventCount} upcoming show{related.eventCount === 1 ? '' : 's'}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tour Summary for SEO */}
      <section className="mt-16 max-w-4xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{artist.name} Tour {new Date().getFullYear()}</h2>
        <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-3">
          {artistEvents.length > 0 ? (
            <p>
              {artist.name} has {artistEvents.length} upcoming concert{artistEvents.length === 1 ? '' : 's'} scheduled
              {cities.length > 0 ? ` across ${cities.length} cities including ${cities.slice(0, 3).join(', ')}${cities.length > 3 ? ' and more' : ''}` : ''}.
              {artistEvents[0].venue?.name ? ` The next show is at ${artistEvents[0].venue.name}${artistEvents[0].venue?.city ? ` in ${artistEvents[0].venue.city}` : ''} on ${new Date(artistEvents[0].event.eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.` : ''}
              {' '}Browse all tour dates above and compare ticket prices from Ticketmaster and SeatGeek.
            </p>
          ) : (
            <p>
              No upcoming {artist.name} tour dates have been announced yet. Check back regularly — we update tour schedules daily from Ticketmaster and SeatGeek.
            </p>
          )}
          {artist.genre && (
            <p>
              Looking for more {artist.genre} concerts? Browse all{' '}
              <Link href={`/tours/${slugify(normalizeGenre(artist.genre))}`} className="text-orange-500 hover:text-orange-600 font-medium">
                {normalizeGenre(artist.genre)} tours
              </Link>{' '}
              or check out{' '}
              <Link href="/concerts/tonight" className="text-orange-500 hover:text-orange-600 font-medium">concerts tonight</Link>{' '}
              and{' '}
              <Link href="/concerts/this-weekend" className="text-orange-500 hover:text-orange-600 font-medium">shows this weekend</Link>.
            </p>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <div className="mt-16">
        <h2 id="faq-heading" className="text-3xl font-bold mb-6">
          Frequently Asked <span className="gradient-text">Questions</span>
        </h2>
        <div className="space-y-3" role="group" aria-labelledby="faq-heading">
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="group bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer p-6 font-semibold text-gray-900 hover:text-orange-600 transition-colors">
                <span>{faq.question}</span>
                <svg
                  className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-4"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-6 text-gray-600 leading-relaxed">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
