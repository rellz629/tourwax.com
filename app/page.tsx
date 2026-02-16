import { db } from '@/db';
import { artists, events } from '@/db/schema';
import { eq, desc, gte, and } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';
import { generateOrganizationSchema, generateWebsiteSchema, generateBreadcrumbSchema } from '@/lib/schema';
import { SITE_URL } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';

// Use Static Site Generation with ISR
export const dynamic = 'force-static';
export const revalidate = 3600; // Revalidate every hour

async function getFeaturedArtistsWithUpcomingEvents() {
  const now = new Date();

  // Get artists with upcoming events
  const artistsWithEvents = await db
    .selectDistinct({
      id: artists.id,
      slug: artists.slug,
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
      artistSlug: artists.slug,
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

  // Generate structured data schemas
  const organizationSchema = generateOrganizationSchema();
  const websiteSchema = generateWebsiteSchema();
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
  ]);

  return (
    <>
      <StructuredData data={[organizationSchema, websiteSchema, breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-20">
        <h1 className="text-6xl md:text-7xl font-black mb-6">
          <span className="gradient-text">Never Miss a Show</span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          Track tour dates, venues, and the latest news for your favorite artists.
          <span className="block mt-2 text-orange-500 font-semibold">Updated automatically, every day.</span>
        </p>
      </div>

      {/* Featured Artists */}
      <section className="mb-20">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-4xl font-bold text-gray-900">
            Artists on <span className="gradient-text">Tour</span>
          </h2>
          <Link
            href="/artists"
            className="group inline-flex items-center gap-2 text-orange-500 hover:text-orange-600 font-semibold text-lg transition-colors"
          >
            View All
            <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {featuredArtists.map((artist) => (
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
                    width={400}
                    height={400}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                    {artist.name.charAt(0)}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="p-4 bg-white">
                <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors mb-1">
                  {artist.name}
                </h3>
                {artist.genre && (
                  <p className="text-sm text-gray-500 font-medium">{artist.genre}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming Shows */}
      <section>
        <h2 className="text-4xl font-bold text-gray-900 mb-8">
          Coming <span className="gradient-text">Soon</span>
        </h2>
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <div className="divide-y divide-gray-100">
            {upcomingEvents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg">No upcoming events yet. Check back soon!</p>
              </div>
            ) : (
              upcomingEvents.map((event, index) => (
                <Link
                  key={event.id}
                  href={`/artists/${event.artistSlug}`}
                  className="group block p-6 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 transition-all duration-300"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-lg">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors mb-1 text-lg">
                          {event.artistName}
                        </h3>
                        <p className="text-gray-600">{event.name}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="inline-flex flex-col items-end bg-gradient-to-br from-orange-500 to-red-500 text-white px-4 py-2 rounded-lg">
                        <p className="font-bold text-lg">
                          {new Date(event.eventDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm opacity-90">
                          {new Date(event.eventDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
