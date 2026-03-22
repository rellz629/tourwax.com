import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, desc, gte, lte, and, sql, isNotNull } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';
import { generateOrganizationSchema, generateWebsiteSchema, generateBreadcrumbSchema } from '@/lib/schema';
import { SITE_URL } from '@/lib/seo';
import { isPackage } from '@/lib/event-utils';
import { slugify } from '@/lib/slugify';
import { GENRE_DISPLAY_NAMES } from '@/lib/genres';
import StructuredData from '@/components/StructuredData';
import ShowMoreEvents from '@/components/ShowMoreEvents';

// Use Static Site Generation with ISR
export const dynamic = 'force-static';
export const revalidate = 3600; // Revalidate every hour

async function getFeaturedArtistsWithUpcomingEvents() {
  const now = new Date();

  // Get the 24 most actively touring artists (most upcoming events)
  const artistsWithEvents = await db
    .select({
      id: artists.id,
      slug: artists.slug,
      name: artists.name,
      genre: artists.genre,
      imageUrl: artists.imageUrl,
      eventCount: sql<number>`count(${events.id})::int`,
    })
    .from(artists)
    .innerJoin(events, eq(artists.id, events.artistId))
    .where(and(
      eq(artists.isActive, true),
      gte(events.eventDate, now)
    ))
    .groupBy(artists.id, artists.slug, artists.name, artists.genre, artists.imageUrl)
    .orderBy(sql`count(${events.id}) desc`)
    .limit(24);

  return artistsWithEvents;
}

async function getUpcomingEvents() {
  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const upcomingEvents = await db
    .select({
      id: events.id,
      name: events.name,
      eventDate: events.eventDate,
      artistName: artists.name,
      artistId: artists.id,
      artistSlug: artists.slug,
      venueId: events.venueId,
      venueCity: venues.city,
      venueState: venues.state,
      venueCountry: venues.country,
      venueTimezone: venues.timezone,
    })
    .from(events)
    .innerJoin(artists, eq(events.artistId, artists.id))
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(
      gte(events.eventDate, now),
      lte(events.eventDate, oneWeekFromNow)
    ))
    .orderBy(events.eventDate);

  // Deduplicate: keep one event per artist+city+date, preferring non-package events
  const groups = new Map<string, typeof upcomingEvents[0]>();
  for (const e of upcomingEvents) {
    const dateKey = new Date(e.eventDate).toISOString().slice(0, 10);
    const key = `${e.artistId}_${e.venueCity || 'none'}_${dateKey}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, e);
    } else if (isPackage(existing.name) && !isPackage(e.name)) {
      groups.set(key, e);
    }
  }
  return Array.from(groups.values());
}

function groupEventsByDay(eventsList: Awaited<ReturnType<typeof getUpcomingEvents>>) {
  const groups: Map<string, typeof eventsList> = new Map();

  for (const event of eventsList) {
    const tz = event.venueTimezone ?? 'UTC';
    const dayKey = new Date(event.eventDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: tz,
    });
    if (!groups.has(dayKey)) {
      groups.set(dayKey, []);
    }
    groups.get(dayKey)!.push(event);
  }

  return groups;
}

async function getSiteStats() {
  const now = new Date();
  const [artistCount, eventCount, cityCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(artists).where(eq(artists.isActive, true)),
    db.select({ count: sql<number>`count(*)::int` }).from(events).where(gte(events.eventDate, now)),
    db.selectDistinct({ city: venues.city })
      .from(venues)
      .innerJoin(events, eq(events.venueId, venues.id))
      .where(and(isNotNull(venues.city), gte(events.eventDate, now))),
  ]);
  return {
    artists: artistCount[0]?.count ?? 0,
    events: eventCount[0]?.count ?? 0,
    cities: cityCount.length,
  };
}

async function getTopCities() {
  const now = new Date();
  return db
    .select({
      city: venues.city,
      state: venues.state,
      count: sql<number>`count(*)::int`,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(and(gte(events.eventDate, now), isNotNull(venues.city)))
    .groupBy(venues.city, venues.state)
    .orderBy(sql`count(*) desc`)
    .limit(12);
}

export default async function HomePage() {
  const [featuredArtists, upcomingEvents, stats, topCities] = await Promise.all([
    getFeaturedArtistsWithUpcomingEvents(),
    getUpcomingEvents(),
    getSiteStats(),
    getTopCities(),
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
            <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {featuredArtists.map((artist) => (
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
                    sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold" role="img" aria-label={artist.name}>
                    {artist.name.charAt(0)}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="p-3 bg-white">
                <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors text-sm truncate">
                  {artist.name}
                </h3>
                {artist.genre && (
                  <p className="text-xs text-gray-500 font-medium truncate">{artist.genre}</p>
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
        {upcomingEvents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">No upcoming events yet. Check back soon!</p>
          </div>
        ) : (
          <ShowMoreEvents initialCount={3}>
            {Array.from(groupEventsByDay(upcomingEvents)).map(([dayLabel, dayEvents]) => (
              <div key={dayLabel}>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-bold whitespace-nowrap"><span className="gradient-text">{dayLabel}</span></h3>
                  <div className="h-px bg-gradient-to-r from-orange-200 to-transparent flex-1"></div>
                  <span className="text-sm text-gray-500 whitespace-nowrap">{dayEvents.length} {dayEvents.length === 1 ? 'show' : 'shows'}</span>
                </div>
                <div className="bg-white rounded-xl shadow-md border border-gray-100 divide-y divide-gray-50">
                  {dayEvents.map((event) => (
                    <Link
                      key={event.id}
                      href={`/artists/${event.artistSlug}`}
                      className="group flex items-center gap-4 px-4 py-3 hover:bg-gradient-to-r hover:from-orange-50 hover:to-transparent transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors truncate">
                            {event.artistName}
                          </span>
                          <span className="text-gray-500 hidden sm:inline">&middot;</span>
                          <span className="text-gray-500 text-sm truncate hidden sm:inline">{event.name}</span>
                        </div>
                        <p className="text-sm text-gray-500 sm:hidden truncate">{event.name}</p>
                        {(event.venueCity || event.venueState || event.venueCountry) && (
                          <p className="text-sm text-gray-500 truncate">
                            {event.venueCity ? (
                              <Link href={`/concerts/${slugify(event.venueCity)}`} className="hover:text-orange-600 transition-colors">{event.venueCity}</Link>
                            ) : null}
                            {event.venueCity && (event.venueState || event.venueCountry) ? ', ' : ''}
                            {[event.venueState, event.venueCountry].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                      <time dateTime={new Date(event.eventDate).toISOString()} className="text-sm text-gray-500 font-medium whitespace-nowrap flex-shrink-0">
                        {new Date(event.eventDate).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZone: event.venueTimezone ?? 'UTC',
                        })}
                        {event.venueTimezone && (
                          <span className="text-gray-500 ml-1">
                            {new Intl.DateTimeFormat('en-US', {
                              timeZone: event.venueTimezone,
                              timeZoneName: 'short',
                            }).formatToParts(event.eventDate).find(p => p.type === 'timeZoneName')?.value}
                          </span>
                        )}
                      </time>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </ShowMoreEvents>
        )}
      </section>

      {/* Site Stats */}
      <section className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 text-center">
          <div className="text-3xl font-black gradient-text">{stats.artists.toLocaleString()}</div>
          <div className="text-sm text-gray-500 font-medium mt-1">Artists Tracked</div>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 text-center">
          <div className="text-3xl font-black gradient-text">{stats.events.toLocaleString()}</div>
          <div className="text-sm text-gray-500 font-medium mt-1">Upcoming Shows</div>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 text-center">
          <div className="text-3xl font-black gradient-text">{stats.cities.toLocaleString()}</div>
          <div className="text-sm text-gray-500 font-medium mt-1">Cities</div>
        </div>
      </section>

      {/* Browse by Genre */}
      <section className="mt-20">
        <h2 className="text-4xl font-bold text-gray-900 mb-8">
          Browse by <span className="gradient-text">Genre</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(GENRE_DISPLAY_NAMES).filter(([slug]) => slug !== 'other').map(([slug, name]) => (
            <Link
              key={slug}
              href={`/tours/${slug}`}
              className="group bg-white rounded-xl shadow-md hover:shadow-xl border border-gray-100 p-5 transition-all hover:-translate-y-0.5"
            >
              <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors">{name}</h3>
              <p className="text-sm text-gray-500 mt-1">View tour dates</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Find Concerts by City */}
      {topCities.length > 0 && (
        <section className="mt-20">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900">
              Find Concerts by <span className="gradient-text">City</span>
            </h2>
            <Link
              href="/concerts"
              className="group inline-flex items-center gap-2 text-orange-500 hover:text-orange-600 font-semibold text-lg transition-colors"
            >
              All Cities
              <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {topCities.map((row) => (
              <Link
                key={`${row.city}-${row.state}`}
                href={`/concerts/${slugify(row.city!)}`}
                className="group bg-white rounded-xl shadow-md hover:shadow-xl border border-gray-100 p-5 transition-all hover:-translate-y-0.5"
              >
                <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors">{row.city}</h3>
                <p className="text-sm text-gray-500 mt-1">{row.count} upcoming show{row.count === 1 ? '' : 's'}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* SEO Description */}
      <section className="mt-20 bg-white rounded-xl shadow-md border border-gray-100 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Guide to Live Music in {new Date().getFullYear()}</h2>
        <div className="text-gray-600 leading-relaxed space-y-4">
          <p>
            TourWax is the easiest way to find concert tour dates, compare ticket prices, and never miss a show from your favorite artists.
            We track upcoming concerts across Hip-Hop, Pop, Rock, Country, R&B, Electronic, and Latin music — updated daily with data from
            Ticketmaster and SeatGeek.
          </p>
          <p>
            Browse <Link href="/concerts" className="text-orange-500 hover:text-orange-600 font-medium">concerts by city</Link>, explore
            {' '}<Link href="/tours" className="text-orange-500 hover:text-orange-600 font-medium">tours by genre</Link>, or find events at your
            favorite <Link href="/venues" className="text-orange-500 hover:text-orange-600 font-medium">concert venues</Link>. Looking for something
            happening soon? Check out <Link href="/concerts/this-weekend" className="text-orange-500 hover:text-orange-600 font-medium">concerts this
            weekend</Link> or <Link href="/concerts/tonight" className="text-orange-500 hover:text-orange-600 font-medium">shows tonight</Link>.
          </p>
        </div>
      </section>
    </div>
    </>
  );
}
