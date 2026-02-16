import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { SITE_NAME, generateCanonicalUrl } from '@/lib/seo';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Browse Artists on Tour ${new Date().getFullYear()} | Live Music Tour Dates - ${SITE_NAME}`,
  description: 'Discover artists currently on tour. Find concert dates, tickets, and venues for Hip-Hop, Pop, Rock, Country, and more.',
  alternates: {
    canonical: generateCanonicalUrl('/artists'),
  },
  openGraph: {
    title: `Browse Artists on Tour ${new Date().getFullYear()} | Live Music Tour Dates`,
    description: 'Discover artists currently on tour. Find concert dates, tickets, and venues for Hip-Hop, Pop, Rock, Country, and more.',
    url: generateCanonicalUrl('/artists'),
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: `Browse Artists on Tour ${new Date().getFullYear()} | Live Music Tour Dates`,
    description: 'Discover artists currently on tour. Find concert dates, tickets, and venues for Hip-Hop, Pop, Rock, Country, and more.',
  },
};

export default async function ArtistsPage() {
  const allArtists = await db
    .select()
    .from(artists)
    .where(eq(artists.isActive, true))
    .orderBy(artists.name);

  // Group by genre
  const artistsByGenre = allArtists.reduce((acc, artist) => {
    const genre = artist.genre || 'Other';
    if (!acc[genre]) acc[genre] = [];
    acc[genre].push(artist);
    return acc;
  }, {} as Record<string, typeof allArtists>);

  const genres = Object.keys(artistsByGenre).sort();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-5xl md:text-6xl font-black mb-4">
          <span className="gradient-text">All Artists</span>
        </h1>
        <p className="text-xl text-gray-600">
          Browse {allArtists.length} artists across {genres.length} genres
        </p>
      </div>

      {genres.map((genre) => (
        <section key={genre} className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
            <h2 className="text-3xl font-bold text-gray-900">{genre}</h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-red-500 to-transparent rounded-full"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {artistsByGenre[genre].map((artist) => (
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
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
