import { db } from '@/db';
import { artists, events, eventArtists, venues } from '@/db/schema';
import { eq, gte, and, sql } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateOnSaleMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAffiliateUrl } from '@/lib/affiliate';
import { eventPrimaryLabel, dedupeEvents } from '@/lib/event-utils';
import EventLink from '@/components/EventLink';
import { slugify } from '@/lib/slugify';

export const dynamic = 'force-static';
export const revalidate = 900; // 15 minutes

async function getOnSaleTodayEvents() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  // Query events where metadata->>'onsaleStart' falls within today
  const results = await db
    .select({
      event: events,
      venue: venues,
      artistName: artists.name,
      artistSlug: artists.slug,
      artistImageUrl: artists.imageUrl,
    })
    .from(events)
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(
      gte(events.eventDate, now),
      sql`${events.metadata}->>'onsaleStart' IS NOT NULL`,
      sql`(${events.metadata}->>'onsaleStart')::timestamptz >= ${startOfDay.toISOString()}`,
      sql`(${events.metadata}->>'onsaleStart')::timestamptz <= ${endOfDay.toISOString()}`,
    ))
    .orderBy(sql`(${events.metadata}->>'onsaleStart')::timestamptz`);

  // Collapse festival lineups, package variants, and cross-source duplicates.
  return dedupeEvents(results, (row) => ({
    name: row.event.name,
    artistName: row.artistName,
    city: row.venue?.city,
    eventDate: row.event.eventDate,
  }));
}

// Also get events going on sale this week for the "coming soon" section
async function getOnSaleThisWeekEvents() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  endOfWeek.setHours(23, 59, 59, 999);

  const results = await db
    .select({
      event: events,
      venue: venues,
      artistName: artists.name,
      artistSlug: artists.slug,
      artistImageUrl: artists.imageUrl,
    })
    .from(events)
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(
      gte(events.eventDate, now),
      sql`${events.metadata}->>'onsaleStart' IS NOT NULL`,
      sql`(${events.metadata}->>'onsaleStart')::timestamptz >= ${tomorrow.toISOString()}`,
      sql`(${events.metadata}->>'onsaleStart')::timestamptz <= ${endOfWeek.toISOString()}`,
    ))
    .orderBy(sql`(${events.metadata}->>'onsaleStart')::timestamptz`);

  // Collapse festival lineups, package variants, and cross-source duplicates.
  return dedupeEvents(results, (row) => ({
    name: row.event.name,
    artistName: row.artistName,
    city: row.venue?.city,
    eventDate: row.event.eventDate,
  }));
}

export async function generateMetadata(): Promise<Metadata> {
  const onSaleEvents = await getOnSaleTodayEvents();
  return generateOnSaleMetadata(onSaleEvents.length);
}

function formatOnsaleTime(metadata: Record<string, unknown> | null): string | null {
  if (!metadata || !metadata.onsaleStart) return null;
  try {
    const date = new Date(metadata.onsaleStart as string);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return null;
  }
}

function formatOnsaleDate(metadata: Record<string, unknown> | null): string | null {
  if (!metadata || !metadata.onsaleStart) return null;
  try {
    const date = new Date(metadata.onsaleStart as string);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

const MAX_EVENTS = 50;

export default async function OnSaleTodayPage() {
  const allOnSaleEvents = await getOnSaleTodayEvents();
  const allComingSoonEvents = await getOnSaleThisWeekEvents();
  const onSaleEvents = allOnSaleEvents.slice(0, MAX_EVENTS);
  const comingSoonEvents = allComingSoonEvents.slice(0, MAX_EVENTS);

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Concerts', url: `${SITE_URL}/concerts` },
    { name: 'On Sale Today', url: `${SITE_URL}/concerts/on-sale-today` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Concerts', url: '/concerts' },
    { name: 'On Sale Today', url: '/concerts/on-sale-today' },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            Tickets <span className="gradient-text">On Sale Today</span>
          </h1>
          <p className="text-xl text-gray-600">
            {onSaleEvents.length} concert{onSaleEvents.length === 1 ? '' : 's'} with tickets going on sale today
          </p>
          <div className="flex gap-3 mt-4">
            <Link href="/concerts/tonight" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">Tonight</Link>
            <Link href="/concerts/this-weekend" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">This Weekend</Link>
            <Link href="/concerts/this-week" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">This Week</Link>
          </div>
        </div>

        {/* On Sale Today */}
        {onSaleEvents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">No tickets going on sale today. Check back tomorrow or browse <Link href="/concerts/this-week" className="text-orange-500 hover:text-orange-600 font-medium">this week&apos;s concerts</Link>.</p>
          </div>
        ) : (
          <div className="space-y-4 mb-16">
            {onSaleEvents.map((row) => {
              const onsaleTime = formatOnsaleTime(row.event.metadata as Record<string, unknown> | null);
              const label = eventPrimaryLabel({ name: row.event.name, ticketUrl: row.event.ticketUrl, source: row.event.source, artistName: row.artistName, artistSlug: row.artistSlug });
              return (
                <div key={row.event.id} className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover p-6 border border-gray-100">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                    <div className="flex items-start gap-4 flex-1">
                      <EventLink label={label} className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-500 to-red-500">
                        {row.artistImageUrl ? (
                          <Image src={row.artistImageUrl} alt={label.text} width={56} height={56} className="w-full h-full object-cover" sizes="56px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold">{label.text.charAt(0)}</div>
                        )}
                      </EventLink>
                      <div className="flex-1">
                        <EventLink label={label} showNewTabHint className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors text-lg">{label.text}</EventLink>
                        {label.text !== row.event.name && <p className="text-sm text-gray-600 mt-1">{row.event.name}</p>}
                        {row.venue && (
                          <p className="text-sm text-gray-500 mt-1">
                            <Link href={`/venues/${slugify(row.venue.name)}`} className="hover:text-orange-600 transition-colors">{row.venue.name}</Link>
                            {row.venue.city && (
                              <span> — <Link href={`/concerts/${slugify(row.venue.city)}`} className="hover:text-orange-600 transition-colors">{row.venue.city}</Link></span>
                            )}
                            {row.venue.state && `, ${row.venue.state}`}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                          {onsaleTime && (
                            <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-md font-medium">
                              <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              On sale at {onsaleTime}
                            </span>
                          )}
                          {(row.event.minPrice || row.event.maxPrice) && (
                            <span className="font-semibold text-orange-600">
                              From ${row.event.minPrice || row.event.maxPrice}
                              {row.event.maxPrice && row.event.minPrice && row.event.minPrice !== row.event.maxPrice && ` – $${row.event.maxPrice}`}
                            </span>
                          )}
                          <span className="text-gray-500">
                            Show: {new Date(row.event.eventDate).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              timeZone: row.venue?.timezone ?? 'UTC',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {row.event.ticketUrl && (
                      <a href={getAffiliateUrl(row.event.ticketUrl, row.event.source)} target="_blank" rel="noopener noreferrer" className="btn-primary whitespace-nowrap">
                        {row.event.minPrice ? `From $${row.event.minPrice}` : 'Get Tickets'}
                        <span className="sr-only">(opens in new tab)</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Coming Soon This Week */}
        {comingSoonEvents.length > 0 && (
          <section>
            <h2 className="text-3xl font-bold mb-6">
              Going On Sale <span className="gradient-text">This Week</span>
            </h2>
            <div className="space-y-4">
              {comingSoonEvents.map((row) => {
                const onsaleDate = formatOnsaleDate(row.event.metadata as Record<string, unknown> | null);
                const label = eventPrimaryLabel({ name: row.event.name, ticketUrl: row.event.ticketUrl, source: row.event.source, artistName: row.artistName, artistSlug: row.artistSlug });
                return (
                  <div key={row.event.id} className="group bg-white rounded-xl shadow-md hover:shadow-lg p-6 border border-gray-100">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                      <div className="flex items-start gap-4 flex-1">
                        <EventLink label={label} className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-gray-400 to-gray-500">
                          {row.artistImageUrl ? (
                            <Image src={row.artistImageUrl} alt={label.text} width={56} height={56} className="w-full h-full object-cover" sizes="56px" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold">{label.text.charAt(0)}</div>
                          )}
                        </EventLink>
                        <div className="flex-1">
                          <EventLink label={label} showNewTabHint className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors text-lg">{label.text}</EventLink>
                          {label.text !== row.event.name && <p className="text-sm text-gray-600 mt-1">{row.event.name}</p>}
                          {row.venue && (
                            <p className="text-sm text-gray-500 mt-1">
                              <Link href={`/venues/${slugify(row.venue.name)}`} className="hover:text-orange-600 transition-colors">{row.venue.name}</Link>
                              {row.venue.city && (
                                <span> — <Link href={`/concerts/${slugify(row.venue.city)}`} className="hover:text-orange-600 transition-colors">{row.venue.city}</Link></span>
                              )}
                              {row.venue.state && `, ${row.venue.state}`}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                            {onsaleDate && (
                              <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-medium">
                                <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                On sale {onsaleDate}
                              </span>
                            )}
                            <span className="text-gray-500">
                              Show: {new Date(row.event.eventDate).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                timeZone: row.venue?.timezone ?? 'UTC',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      {row.event.ticketUrl && (
                        <a href={getAffiliateUrl(row.event.ticketUrl, row.event.source)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 whitespace-nowrap transition-colors">
                          View Tickets
                          <span className="sr-only">(opens in new tab)</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
