import { db } from '@/db';
import { artists, events } from '@/db/schema';
import { eq, desc, gte, and } from 'drizzle-orm';
import Link from 'next/link';

export const revalidate = 3600; // Revalidate every hour

async function getFeaturedArtistsWithUpcomingEvents() {
  const now = new Date();

  // Get artists with upcoming events
  const artistsWithEvents = await db
    .selectDistinct({
      id: artists.id,
      name: artists.name,
      genre: artists.genre,
      imageUrl: artists.imageUrl,
    })
    .from(artists)
    .innerJoin(events, eq(artists.id, events.artistId))
    .where(and(
      eq(artists.isActive, true),
      gte(events.eventDate, now)
    ))
    .limit(12);

  return artistsWithEvents;
}

async function getUpcomingEvents() {
  const now = new Date();

  const upcomingEvents = await db
    .select({
      id: events.id,
      name: events.name,
      eventDate: events.eventDate,
      artistName: artists.name,
      artistId: artists.id,
    })
    .from(events)
    .innerJoin(artists, eq(events.artistId, artists.id))
    .where(gte(events.eventDate, now))
    .orderBy(events.eventDate)
    .limit(10);

  return upcomingEvents;
}

export default async function HomePage() {
  const [featuredArtists, upcomingEvents] = await Promise.all([
    getFeaturedArtistsWithUpcomingEvents(),
    getUpcomingEvents(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Never Miss a Show
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Track tour dates, venues, and the latest news for your favorite artists. Updated automatically.
        </p>
      </div>

      {/* Featured Artists */}
      <section className="mb-16">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Artists on Tour</h2>
          <Link href="/artists" className="text-blue-600 hover:text-blue-800 font-medium">
            View All →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {featuredArtists.map((artist) => (
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
                  <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                    {artist.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {artist.name}
                </h3>
                {artist.genre && (
                  <p className="text-sm text-gray-500">{artist.genre}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming Shows */}
      <section>
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Coming Soon</h2>
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-200">
            {upcomingEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No upcoming events yet. Check back soon!
              </div>
            ) : (
              upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/artists/${event.artistId}`}
                  className="block p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {event.artistName}
                      </h3>
                      <p className="text-sm text-gray-600">{event.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {new Date(event.eventDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(event.eventDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
