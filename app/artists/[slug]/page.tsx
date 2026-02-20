import { db } from '@/db';
import { artists, events, venues, newsArticles } from '@/db/schema';
import { eq, gte, and, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ARTIST_TWITTER_HANDLES } from '@/lib/twitter';
import { generateArtistMetadata, SITE_URL } from '@/lib/seo';
import { generatePersonSchema, generateMusicEventSchema, generateBreadcrumbSchema, generateNewsArticleSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAffiliateUrl } from '@/lib/affiliate';
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

async function getArtist(slug: string) {
  const artist = await db.query.artists.findFirst({
    where: eq(artists.slug, slug),
  });

  if (!artist) return null;
  return artist;
}

async function getArtistEvents(artistId: string) {
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
  const packageKeywords = ['vip', 'package', 'upgrade', 'comfort seat', 'lounge',
    'meet & greet', 'premium', 'platinum', 'suite', 'box seat', 'vinyl room',
    'hospitality', 'excluding concert ticket', 'hot ticket', 'upsell',
    'club level', 'logen-seat', 'accessible ticket', 'payment plan'];

  const isPackage = (name: string) =>
    packageKeywords.some(kw => name.toLowerCase().includes(kw));

  const groups = new Map<string, typeof artistEvents[0]>();
  for (const row of artistEvents) {
    const dateKey = new Date(row.event.eventDate).toISOString().slice(0, 10);
    const city = row.venue?.city || 'unknown';
    const key = `${city}_${dateKey}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, row);
    } else if (isPackage(existing.event.name) && !isPackage(row.event.name)) {
      // Replace a package event with a non-package one
      groups.set(key, row);
    }
  }

  return Array.from(groups.values());
}

async function getArtistNews(artistId: string) {
  const news = await db
    .select()
    .from(newsArticles)
    .where(eq(newsArticles.artistId, artistId))
    .orderBy(desc(newsArticles.publishedAt))
    .limit(10);

  return news;
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

  // Then fetch events and news using the artist ID
  const [artistEvents, news] = await Promise.all([
    getArtistEvents(artist.id),
    getArtistNews(artist.id),
  ]);

  // Get Twitter handle for this artist
  const twitterHandle = ARTIST_TWITTER_HANDLES[artist.name];

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
  const newsSchemas = news.map((article) => generateNewsArticleSchema(article));

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Artists', url: '/artists' },
    { name: artist.name, url: `/artists/${artist.slug}` },
  ];

  return (
    <>
      <StructuredData data={[personSchema, breadcrumbSchema, ...eventSchemas, ...newsSchemas]} />
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
                    <span className="px-4 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold rounded-full">
                      {artist.genre}
                    </span>
                  </div>
                )}
                {artist.bio && (
                  <p className="text-gray-700 mb-6 max-w-3xl leading-relaxed text-lg">
                    {artist.bio}
                  </p>
                )}
                <div className="flex flex-wrap gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg">{artistEvents.length}</p>
                      <p className="text-gray-500 text-xs">Upcoming Shows</p>
                    </div>
                  </div>
                  {news.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <h2 className="text-3xl font-bold mb-6">
            Tour <span className="gradient-text">Dates</span>
          </h2>
          {artistEvents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg">No upcoming tour dates announced yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {artistEvents.map(({ event, venue }) => (
                <div
                  key={event.id}
                  className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover p-6 border border-gray-100"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                    <div className="flex-1">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0 shadow-lg">
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
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 mb-2 text-lg group-hover:text-orange-600 transition-colors">
                            {event.name}
                          </h3>
                          {venue && (
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <p className="font-semibold text-gray-700">{venue.name}</p>
                              </div>
                              <p className="ml-6">
                                {[venue.city, venue.state, venue.country]
                                  .filter(Boolean)
                                  .join(', ')}
                              </p>
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            {(event.minPrice || event.maxPrice) && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span className="font-semibold text-orange-600">
                                  From {event.currency} {event.minPrice || event.maxPrice}
                                  {event.maxPrice && event.minPrice !== event.maxPrice &&
                                    ` - ${event.currency} ${event.maxPrice}`}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      {event.ticketUrl && (
                        <a
                          href={getAffiliateUrl(event.ticketUrl, event.source)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary whitespace-nowrap"
                        >
                          Get Tickets
                        </a>
                      )}
                      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                        via {event.source}
                      </span>
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
                    <svg className="w-7 h-7 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Follow on X</h3>
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
                  <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <span className="text-gray-400">
                        {new Date(article.publishedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
