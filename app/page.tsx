import type { Metadata } from 'next';
import { db } from '@/db';
import { artists, events, venues, eventArtists } from '@/db/schema';
import { eq, desc, gte, lte, and, sql, isNotNull } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';
import { generateOrganizationSchema, generateWebsiteSchema, generateBreadcrumbSchema } from '@/lib/schema';
import { SITE_URL } from '@/lib/seo';
import { isFestival, eventPrimaryLabel, dedupeEvents } from '@/lib/event-utils';
import EventLink from '@/components/EventLink';
import { slugify } from '@/lib/slugify';
import { GENRE_DISPLAY_NAMES, GENRE_COLORS, genreColor } from '@/lib/genres';
import StructuredData from '@/components/StructuredData';
import ShowMoreEvents from '@/components/ShowMoreEvents';
import HomepageNearMe, { type FallbackEvent } from '@/components/HomepageNearMe';
import SearchBar from '@/components/SearchBar';
import Icon from '@/components/Icon';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

// Use Static Site Generation with ISR
export const dynamic = 'force-static';
export const revalidate = 21600; // 6 hours: matches the fetch-tours cron cadence

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
    .innerJoin(eventArtists, eq(eventArtists.artistId, artists.id))
    .innerJoin(events, eq(events.id, eventArtists.eventId))
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
      ticketUrl: events.ticketUrl,
      source: events.source,
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
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(
      gte(events.eventDate, now),
      lte(events.eventDate, oneWeekFromNow)
    ))
    .orderBy(events.eventDate);

  // Collapse festival lineups, package variants, and cross-source duplicates.
  return dedupeEvents(upcomingEvents, (e) => ({
    name: e.name,
    artistName: e.artistName,
    city: e.venueCity,
    eventDate: e.eventDate,
  }));
}

type UpcomingEvent = Awaited<ReturnType<typeof getUpcomingEvents>>[number];

interface DayGroup {
  key: string;
  weekday: string;
  day: string;
  month: string;
  events: UpcomingEvent[];
}

function groupEventsByDay(eventsList: UpcomingEvent[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();

  for (const event of eventsList) {
    const tz = event.venueTimezone ?? 'UTC';
    const d = new Date(event.eventDate);
    const key = d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: tz,
    });
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: tz }),
        day: d.toLocaleDateString('en-US', { day: 'numeric', timeZone: tz }),
        month: d.toLocaleDateString('en-US', { month: 'long', timeZone: tz }),
        events: [],
      };
      groups.set(key, group);
    }
    group.events.push(event);
  }

  return Array.from(groups.values());
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

// Rows shown per day on the homepage itinerary. Busy days can have 150+ shows;
// every row is HTML + RSC bytes billed into the ISR cache, so cap and link out.
const ROWS_PER_DAY = 12;

const QUICK_LINKS = [
  { href: '/concerts/tonight', label: 'Tonight', hot: true },
  { href: '/concerts/this-weekend', label: 'This weekend', hot: false },
  { href: '/concerts/near-me', label: 'Near me', hot: false },
  { href: '/concerts/on-sale-today', label: 'On sale today', hot: false },
];

export default async function HomePage() {
  const [featuredArtists, upcomingEvents, stats, topCities] = await Promise.all([
    getFeaturedArtistsWithUpcomingEvents(),
    getUpcomingEvents(),
    getSiteStats(),
    getTopCities(),
  ]);

  // Rows for the hero board when the visitor's location is unknown.
  const fallbackEvents: FallbackEvent[] = upcomingEvents
    .filter((e) => e.venueCity && !isFestival(e.name))
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      artistName: e.artistName,
      artistSlug: e.artistSlug,
      city: e.venueCity,
      state: e.venueState,
      eventDate: new Date(e.eventDate).toISOString(),
      timezone: e.venueTimezone,
      ticketUrl: e.ticketUrl,
      source: e.source,
    }));

  const dayGroups = groupEventsByDay(upcomingEvents);

  // Generate structured data schemas
  const organizationSchema = generateOrganizationSchema();
  const websiteSchema = generateWebsiteSchema();
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
  ]);

  return (
    <>
      <StructuredData data={[organizationSchema, websiteSchema, breadcrumbSchema]} />

      {/* Hero: full-bleed ink band, search on the left, the board on the right */}
      <section className="grooves relative overflow-hidden bg-ink text-white" aria-label="Find a show">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 lg:grid lg:grid-cols-12 lg:gap-12 lg:items-start">
          <div className="lg:col-span-7">
            <h1 className="display text-4xl sm:text-5xl lg:text-6xl text-white">
              Tour dates for <span className="text-label numerals">{stats.artists.toLocaleString()}</span> artists, updated every day.
            </h1>
            <p className="mt-5 text-lg lg:text-xl text-gray-300 max-w-md">
              <span className="text-white font-semibold numerals">{stats.events.toLocaleString()}</span> upcoming shows across{' '}
              <span className="text-white font-semibold numerals">{stats.cities.toLocaleString()}</span> cities, from Ticketmaster and SeatGeek.
            </p>
            <div className="mt-7 max-w-xl">
              <SearchBar variant="hero" />
            </div>
            <ul className="mt-4 flex flex-wrap gap-2.5 list-none m-0 p-0 text-sm font-semibold">
              {QUICK_LINKS.map((q) => (
                <li key={q.href}>
                  <Link
                    href={q.href}
                    className={
                      q.hot
                        ? 'inline-block rounded-full px-4 py-1.5 bg-label text-ink hover:bg-white transition-colors'
                        : 'inline-block rounded-full px-4 py-1.5 border border-white/40 text-white hover:border-label hover:text-label transition-colors'
                    }
                  >
                    {q.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-10 lg:mt-0 lg:col-span-5">
            <HomepageNearMe fallbackEvents={fallbackEvents} />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-20">
        {/* Artists on tour */}
        <section aria-labelledby="artists-heading">
          <div className="section-head">
            <h2 id="artists-heading" className="display text-3xl sm:text-4xl text-ink">Artists on tour</h2>
            <div className="flex items-baseline gap-5 text-sm text-muted whitespace-nowrap">
              <span className="numerals hidden sm:inline">{featuredArtists.length} of {stats.artists.toLocaleString()}</span>
              <Link href="/artists" className="font-semibold text-ink hover:text-wax transition-colors">All artists</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {featuredArtists.map((artist) => {
              const color = genreColor(artist.genre);
              return (
                <Link key={artist.id} href={`/artists/${artist.slug}`} className="group tile">
                  <div className="tile-media">
                    {artist.imageUrl ? (
                      <Image
                        src={artist.imageUrl}
                        alt={artist.name}
                        width={200}
                        height={200}
                        quality={70}
                        className="tile-img"
                      />
                    ) : (
                      <div className="tile-fallback" role="img" aria-label={artist.name}>
                        {artist.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="tile-strip" style={{ background: color }} aria-hidden="true"></div>
                  <div className="p-3">
                    <h3 className="tile-title text-sm">{artist.name}</h3>
                    {artist.genre && (
                      <p className="text-xs font-semibold truncate" style={{ color }}>{artist.genre}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* This week */}
        <section aria-labelledby="week-heading">
          <div className="section-head">
            <h2 id="week-heading" className="display text-3xl sm:text-4xl text-ink">This week</h2>
            <div className="flex items-baseline gap-5 text-sm text-muted whitespace-nowrap">
              <span className="numerals hidden sm:inline">{upcomingEvents.length} shows in 7 days</span>
              <Link href="/concerts/this-weekend" className="font-semibold text-ink hover:text-wax transition-colors">This weekend</Link>
            </div>
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="border border-line bg-paper p-12 text-center">
              <Icon name="calendar" className="w-8 h-8 text-muted mx-auto mb-3" />
              <p className="text-muted text-lg">No shows in the next 7 days yet. Check back soon.</p>
            </div>
          ) : (
            <ShowMoreEvents initialCount={3}>
              {dayGroups.map((group, gi) => (
                <div
                  key={group.key}
                  className={`md:grid md:grid-cols-[8rem_1fr] md:gap-8 py-5 ${gi === 0 ? '' : 'border-t border-line'}`}
                >
                  <h3 className="mb-3 md:mb-0 leading-none">
                    <span className="block text-sm text-muted uppercase tracking-wide">{group.weekday}</span>
                    <span className="display text-4xl md:text-5xl text-wax numerals">{group.day}</span>
                    <span className="block text-sm text-muted mt-1.5 numerals">
                      {group.month}, {group.events.length} {group.events.length === 1 ? 'show' : 'shows'}
                    </span>
                  </h3>
                  <ul className="list-none m-0 p-0">
                    {group.events.slice(0, ROWS_PER_DAY).map((event) => (
                      <li
                        key={event.id}
                        className="group flex items-center gap-4 py-2.5 border-b border-line last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          {isFestival(event.name) ? (
                            // Festivals list one event record per artist, so show the
                            // festival name itself as the label (linking to tickets)
                            // rather than an arbitrary artist from the lineup.
                            <EventLink
                              label={eventPrimaryLabel(event)}
                              showNewTabHint
                              className="font-semibold text-ink hover:text-wax transition-colors truncate block"
                            >
                              {event.name}
                            </EventLink>
                          ) : (
                            <>
                              <div className="flex items-baseline gap-2">
                                <Link href={`/artists/${event.artistSlug}`} className="font-semibold text-ink hover:text-wax transition-colors truncate">
                                  {event.artistName}
                                </Link>
                                <span className="text-muted text-sm truncate hidden sm:inline">{event.name}</span>
                              </div>
                              <p className="text-sm text-muted sm:hidden truncate">{event.name}</p>
                            </>
                          )}
                          {(event.venueCity || event.venueState || event.venueCountry) && (
                            <p className="text-sm text-muted truncate">
                              {event.venueCity ? (
                                <Link href={`/concerts/${slugify(event.venueCity)}`} className="hover:text-wax transition-colors">{event.venueCity}</Link>
                              ) : null}
                              {event.venueCity && (event.venueState || event.venueCountry) ? ', ' : ''}
                              {[event.venueState, event.venueCountry].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                        <time dateTime={new Date(event.eventDate).toISOString()} className="text-sm text-muted numerals whitespace-nowrap flex-shrink-0">
                          {new Date(event.eventDate).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZone: event.venueTimezone ?? 'UTC',
                          })}
                          {event.venueTimezone && (
                            <span className="ml-1">
                              {new Intl.DateTimeFormat('en-US', {
                                timeZone: event.venueTimezone,
                                timeZoneName: 'short',
                              }).formatToParts(event.eventDate).find(p => p.type === 'timeZoneName')?.value}
                            </span>
                          )}
                        </time>
                      </li>
                    ))}
                    {group.events.length > ROWS_PER_DAY && (
                      <li className="pt-3">
                        <Link href="/concerts/this-week" className="text-sm font-semibold text-ink hover:text-wax transition-colors numerals">
                          {group.events.length - ROWS_PER_DAY} more on {group.weekday} {group.day}
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </ShowMoreEvents>
          )}
        </section>

        {/* Browse by genre and city */}
        <section aria-labelledby="browse-heading">
          <div className="section-head">
            <h2 id="browse-heading" className="display text-3xl sm:text-4xl text-ink">Browse</h2>
            <Link href="/concerts" className="text-sm font-semibold text-ink hover:text-wax transition-colors whitespace-nowrap">All cities</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-14 gap-y-10">
            <div>
              <h3 className="text-lg font-semibold text-ink mb-1">By genre</h3>
              <ul className="list-none m-0 p-0">
                {Object.entries(GENRE_DISPLAY_NAMES).filter(([slug]) => slug !== 'other').map(([slug, name]) => (
                  <li key={slug} className="border-b border-line">
                    <Link href={`/tours/${slug}`} className="flex items-center gap-3 py-2.5 text-ink hover:text-wax transition-colors">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: GENRE_COLORS[slug] ?? 'var(--muted)' }}
                        aria-hidden="true"
                      ></span>
                      <span className="font-medium">{name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {topCities.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-ink mb-1">By city</h3>
                <ul className="list-none m-0 p-0">
                  {topCities.map((row) => (
                    <li key={`${row.city}-${row.state}`} className="border-b border-line">
                      <Link href={`/concerts/${slugify(row.city!)}`} className="flex items-baseline justify-between gap-4 py-2.5 text-ink hover:text-wax transition-colors">
                        <span className="font-medium truncate">{row.city}{row.state ? `, ${row.state}` : ''}</span>
                        <span className="text-sm text-muted numerals whitespace-nowrap">{row.count} show{row.count === 1 ? '' : 's'}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* SEO Description */}
        <section className="max-w-prose">
          <h2 className="display text-2xl text-ink mb-4">Your guide to live music in {new Date().getFullYear()}</h2>
          <div className="text-muted leading-relaxed space-y-4">
            <p>
              TourWax is the easiest way to find concert tour dates, compare ticket prices, and never miss a show from your favorite artists.
              We track upcoming concerts across Hip-Hop, Pop, Rock, Country, R&B, Electronic, and Latin music, updated daily with data from
              Ticketmaster and SeatGeek.
            </p>
            <p>
              Browse <Link href="/concerts" className="text-wax font-medium underline underline-offset-2 decoration-line hover:decoration-wax">concerts by city</Link>, explore
              {' '}<Link href="/tours" className="text-wax font-medium underline underline-offset-2 decoration-line hover:decoration-wax">tours by genre</Link>, or find events at your
              favorite <Link href="/venues" className="text-wax font-medium underline underline-offset-2 decoration-line hover:decoration-wax">concert venues</Link>. Looking for something
              happening soon? Check out <Link href="/concerts/this-weekend" className="text-wax font-medium underline underline-offset-2 decoration-line hover:decoration-wax">concerts this
              weekend</Link> or <Link href="/concerts/tonight" className="text-wax font-medium underline underline-offset-2 decoration-line hover:decoration-wax">shows tonight</Link>.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
