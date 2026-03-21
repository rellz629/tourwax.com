import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, gte, sql, ilike, or, and } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateSearchMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { slugify } from '@/lib/slugify';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return generateSearchMetadata(q || null);
}

async function searchArtists(query: string) {
  return db
    .select({
      id: artists.id,
      slug: artists.slug,
      name: artists.name,
      genre: artists.genre,
      imageUrl: artists.imageUrl,
    })
    .from(artists)
    .where(and(
      eq(artists.isActive, true),
      ilike(artists.name, `%${query}%`)
    ))
    .orderBy(artists.name)
    .limit(20);
}

async function searchVenues(query: string) {
  const now = new Date();
  return db
    .selectDistinct({
      name: venues.name,
      city: venues.city,
      state: venues.state,
    })
    .from(venues)
    .innerJoin(events, eq(events.venueId, venues.id))
    .where(and(
      ilike(venues.name, `%${query}%`),
      gte(events.eventDate, now)
    ))
    .limit(20);
}

async function searchCities(query: string) {
  const now = new Date();
  return db
    .select({
      city: venues.city,
      state: venues.state,
      count: sql<number>`count(*)::int`,
    })
    .from(venues)
    .innerJoin(events, eq(events.venueId, venues.id))
    .where(and(
      ilike(venues.city, `%${query}%`),
      gte(events.eventDate, now)
    ))
    .groupBy(venues.city, venues.state)
    .orderBy(sql`count(*) desc`)
    .limit(10);
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() || '';

  const [artistResults, venueResults, cityResults] = query
    ? await Promise.all([searchArtists(query), searchVenues(query), searchCities(query)])
    : [[], [], []];

  const totalResults = artistResults.length + venueResults.length + cityResults.length;

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Search', url: `${SITE_URL}/search` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Search', url: '/search' },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Search</span>
          </h1>

          <form action="/search" method="GET" className="max-w-xl">
            <div className="relative">
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Search artists, venues, or cities..."
                className="w-full px-5 py-4 pr-12 rounded-xl border border-gray-200 shadow-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
                autoFocus
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-orange-500 transition-colors"
                aria-label="Search"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>
        </div>

        {query && (
          <p className="text-gray-500 mb-8">
            {totalResults} result{totalResults === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
          </p>
        )}

        {/* Artist Results */}
        {artistResults.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Artists</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {artistResults.map((artist) => (
                <Link
                  key={artist.id}
                  href={`/artists/${artist.slug}`}
                  className="group bg-white rounded-lg shadow-md hover:shadow-xl card-hover overflow-hidden border border-gray-100"
                >
                  <div className="aspect-square bg-gradient-to-br from-orange-400 via-red-400 to-pink-500 relative overflow-hidden">
                    {artist.imageUrl ? (
                      <Image
                        src={artist.imageUrl}
                        alt={artist.name}
                        width={200}
                        height={200}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 16vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
                        {artist.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors text-sm truncate">{artist.name}</h3>
                    {artist.genre && <p className="text-xs text-gray-500 truncate">{artist.genre}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Venue Results */}
        {venueResults.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Venues</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {venueResults.map((venue) => (
                <Link
                  key={venue.name}
                  href={`/venues/${slugify(venue.name)}`}
                  className="group bg-white rounded-xl shadow-md hover:shadow-xl p-5 border border-gray-100 transition-all"
                >
                  <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors">{venue.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {[venue.city, venue.state].filter(Boolean).join(', ')}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* City Results */}
        {cityResults.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Cities</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cityResults.map((row) => (
                <Link
                  key={`${row.city}-${row.state}`}
                  href={`/concerts/${slugify(row.city!)}`}
                  className="group bg-white rounded-xl shadow-md hover:shadow-xl p-5 border border-gray-100 transition-all"
                >
                  <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors">{row.city}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {row.state && `${row.state} — `}{row.count} upcoming show{row.count === 1 ? '' : 's'}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {query && totalResults === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No results found for &ldquo;{query}&rdquo;. Try a different search term.</p>
          </div>
        )}

        {!query && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">Enter a search term to find artists, venues, and cities.</p>
          </div>
        )}
      </div>
    </>
  );
}
