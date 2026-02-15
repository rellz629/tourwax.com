import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';

export const revalidate = 3600;

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
      <h1 className="text-4xl font-bold text-gray-900 mb-8">All Artists</h1>

      {genres.map((genre) => (
        <section key={genre} className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{genre}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {artistsByGenre[genre].map((artist) => (
              <Link
                key={artist.id}
                href={`/artists/${artist.id}`}
                className="group bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="aspect-square bg-gradient-to-br from-purple-500 to-pink-500 relative">
                  {artist.imageUrl ? (
                    <img
                      src={artist.imageUrl}
                      alt={artist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
                      {artist.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">
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
