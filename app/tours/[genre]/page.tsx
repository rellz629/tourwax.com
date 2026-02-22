import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, gte, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateGenreMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateGenreEventListSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAffiliateUrl } from '@/lib/affiliate';
import { normalizeGenre, genreSlug, GENRE_DESCRIPTIONS, GENRE_DISPLAY_NAMES } from '@/lib/genres';
import { slugify } from '@/lib/slugify';

export const dynamic = 'force-static';
export const revalidate = 1800;

interface Props {
  params: Promise<{ genre: string }>;
}

function findGenreBySlug(slug: string, genreMap: Map<string, string>): string | null {
  // Try the display name map first
  if (GENRE_DISPLAY_NAMES[slug]) return GENRE_DISPLAY_NAMES[slug];
  // Fall back to checking computed slugs from actual data
  for (const [computedSlug, displayName] of genreMap) {
    if (computedSlug === slug) return displayName;
  }
  return null;
}

async function getGenreArtists(genreName: string) {
  const allArtists = await db
    .select()
    .from(artists)
    .where(eq(artists.isActive, true))
    .orderBy(artists.name);

  return allArtists.filter((a) => normalizeGenre(a.genre) === genreName);
}

async function getGenreEvents(artistIds: string[]) {
  if (artistIds.length === 0) return [];

  const now = new Date();

  const genreEvents = await db
    .select({
      event: events,
      venue: venues,
      artistName: artists.name,
      artistSlug: artists.slug,
      artistImageUrl: artists.imageUrl,
    })
    .from(events)
    .innerJoin(artists, eq(events.artistId, artists.id))
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(
      sql`${events.artistId} IN ${artistIds} AND ${events.eventDate} >= ${now}`
    )
    .orderBy(events.eventDate);

  // Deduplicate: keep one event per artist+date, preferring non-package events
  const packageKeywords = ['vip', 'package', 'upgrade', 'comfort seat', 'suite',
    'box seat', 'vinyl room', 'premium', 'platinum', 'hospitality', 'club level',
    'logen-seat', 'payment plan', 'upsell', 'excluding concert ticket'];
  const isPackage = (name: string) =>
    packageKeywords.some(kw => name.toLowerCase().includes(kw));

  const groups = new Map<string, typeof genreEvents[0]>();
  for (const row of genreEvents) {
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

/** Build a slug → displayName map from all active artists */
async function buildGenreSlugMap(): Promise<Map<string, string>> {
  const allArtists = await db
    .select({ genre: artists.genre })
    .from(artists)
    .where(eq(artists.isActive, true));

  const map = new Map<string, string>();
  for (const a of allArtists) {
    const normalized = normalizeGenre(a.genre);
    map.set(genreSlug(normalized), normalized);
  }
  return map;
}

export async function generateStaticParams() {
  const slugMap = await buildGenreSlugMap();
  return Array.from(slugMap.keys()).map((slug) => ({ genre: slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { genre: slug } = await params;
  const slugMap = await buildGenreSlugMap();
  const genreName = findGenreBySlug(slug, slugMap);

  if (!genreName) {
    return { title: 'Genre Not Found' };
  }

  const genreArtists = await getGenreArtists(genreName);

  return generateGenreMetadata({
    genreName,
    genreSlug: slug,
    artistCount: genreArtists.length,
    artistNames: genreArtists.map((a) => a.name),
  });
}

export default async function GenrePage({ params }: Props) {
  const { genre: slug } = await params;
  const slugMap = await buildGenreSlugMap();
  const genreName = findGenreBySlug(slug, slugMap);

  if (!genreName) {
    notFound();
  }

  const genreArtists = await getGenreArtists(genreName);
  const artistIds = genreArtists.map((a) => a.id);
  const genreEvents = await getGenreEvents(artistIds);

  // Count events per artist for display
  const eventCountByArtist = new Map<string, number>();
  for (const row of genreEvents) {
    const current = eventCountByArtist.get(row.event.artistId) || 0;
    eventCountByArtist.set(row.event.artistId, current + 1);
  }

  // Group events by date
  const eventsByDate = genreEvents.reduce((acc, row) => {
    const dateKey = new Date(row.event.eventDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(row);
    return acc;
  }, {} as Record<string, typeof genreEvents>);

  const description = GENRE_DESCRIPTIONS[genreName] || GENRE_DESCRIPTIONS['Other'];

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Tours', url: `${SITE_URL}/tours` },
    { name: genreName, url: `${SITE_URL}/tours/${slug}` },
  ]);

  const eventListSchema = generateGenreEventListSchema(
    genreName,
    slug,
    genreEvents.map((row) => ({
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
    { name: 'Tours', url: '/tours' },
    { name: genreName, url: `/tours/${slug}` },
  ];

  const year = new Date().getFullYear();

  return (
    <>
      <StructuredData data={[breadcrumbSchema, eventListSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">{genreName} Tours {year}</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl">
            {description}
          </p>
        </div>

        {/* Artists Grid */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
            <h2 className="text-3xl font-bold text-gray-900">{genreName} Artists on Tour</h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-red-500 to-transparent rounded-full"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {genreArtists.map((artist) => {
              const count = eventCountByArtist.get(artist.id) || 0;
              return (
                <Link
                  key={artist.id}
                  href={`/artists/${artist.slug}`}
                  className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover overflow-hidden border border-gray-100"
                >
                  <div className="aspect-square bg-gradient-to-br from-orange-400 via-red-400 to-pink-500 relative overflow-hidden">
                    {artist.imageUrl ? (
                      <Image
                        src={artist.imageUrl}
                        alt={artist.name}
                        width={300}
                        height={300}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
                        {artist.name.charAt(0)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  <div className="p-4 bg-white">
                    <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors line-clamp-1">
                      {artist.name}
                    </h3>
                    {count > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        {count} upcoming show{count === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Upcoming Events */}
        {genreEvents.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
              <h2 className="text-3xl font-bold text-gray-900">Upcoming {genreName} Concerts</h2>
              <div className="h-1 flex-1 bg-gradient-to-r from-red-500 to-transparent rounded-full"></div>
            </div>
            <div className="space-y-10">
              {Object.entries(eventsByDate).map(([date, dateEvents]) => (
                <section key={date}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-1 w-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
                    <h3 className="text-xl font-bold text-gray-900">{date}</h3>
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
                              <h4 className="text-sm text-gray-600 mt-1">{row.event.name}</h4>
                              {row.venue && (
                                <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  <Link href={`/venues/${slugify(row.venue.name)}`} className="font-medium hover:text-orange-600 transition-colors">{row.venue.name}</Link>
                                  {row.venue.city && (
                                    <span className="text-gray-400">
                                      <Link href={`/concerts/${slugify(row.venue.city)}`} className="hover:text-orange-600 transition-colors">{row.venue.city}</Link>{row.venue.state ? `, ${row.venue.state}` : ''}
                                    </span>
                                  )}
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
          </section>
        )}

        {genreEvents.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">No upcoming {genreName} concerts. Check back soon!</p>
          </div>
        )}
      </div>
    </>
  );
}
