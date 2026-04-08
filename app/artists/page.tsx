import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateCanonicalUrl } from '@/lib/seo';
import { normalizeGenre, genreSlug } from '@/lib/genres';
import Pagination from '@/components/Pagination';

export const revalidate = 3600;

const ARTISTS_PER_PAGE = 60;

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page || '1', 10) || 1);
  const suffix = currentPage > 1 ? ` - Page ${currentPage}` : '';

  return {
    title: `Browse Artists on Tour ${new Date().getFullYear()}${suffix}`,
    description: 'Discover artists currently on tour. Find concert dates, tickets, and venues for Hip-Hop, Pop, Rock, Country, and more.',
    alternates: {
      canonical: generateCanonicalUrl('/artists'),
    },
  };
}

export default async function ArtistsPage({ searchParams }: Props) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page || '1', 10) || 1);

  const [allArtists, [{ count: totalCount }]] = await Promise.all([
    db
      .select()
      .from(artists)
      .where(eq(artists.isActive, true))
      .orderBy(artists.name)
      .limit(ARTISTS_PER_PAGE)
      .offset((currentPage - 1) * ARTISTS_PER_PAGE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(artists)
      .where(eq(artists.isActive, true)),
  ]);

  const totalPages = Math.ceil(totalCount / ARTISTS_PER_PAGE);

  // Group current page artists by normalized genre
  const artistsByGenre = allArtists.reduce((acc, artist) => {
    const genre = normalizeGenre(artist.genre);
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
          Browse {totalCount} artists across all genres
          {totalPages > 1 && ` — Page ${currentPage} of ${totalPages}`}
        </p>
      </div>

      {genres.map((genre) => (
        <section key={genre} className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
            <h2 className="text-3xl font-bold text-gray-900">
              <Link href={`/tours/${genreSlug(genre)}`} className="hover:text-orange-600 transition-colors">{genre}</Link>
            </h2>
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

      <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/artists" />
    </div>
  );
}
