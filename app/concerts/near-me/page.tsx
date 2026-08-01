import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { db } from '@/db';
import { artists, events, eventArtists, venues } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { dedupeEvents } from '@/lib/event-utils';
import {
  boundingBox,
  getLocationFromHeaders,
  haversineDistance,
} from '@/lib/geo';
import { generateNearMeMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateFAQSchema } from '@/lib/schema';
import { slugify } from '@/lib/slugify';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import NearMeClient from './NearMeClient';

export const dynamic = 'force-dynamic';

const DEFAULT_RADIUS_MILES = 100;
const RESULT_LIMIT = 40;

async function getNearbyEvents(lat: number, lng: number, radius: number) {
  const box = boundingBox({ lat, lng }, radius);
  const now = new Date();

  const rows = await db
    .select({
      eventId: events.id,
      eventName: events.name,
      eventDate: events.eventDate,
      ticketUrl: events.ticketUrl,
      minPrice: events.minPrice,
      ticketSource: events.source,
      venueId: venues.id,
      venueName: venues.name,
      venueCity: venues.city,
      venueState: venues.state,
      venueLat: venues.latitude,
      venueLng: venues.longitude,
      artistName: artists.name,
      artistSlug: artists.slug,
      artistImageUrl: artists.imageUrl,
    })
    .from(events)
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(
      and(
        gte(events.eventDate, now),
        sql`${venues.latitude} IS NOT NULL`,
        sql`${venues.longitude} IS NOT NULL`,
        sql`CAST(${venues.latitude} AS DOUBLE PRECISION) BETWEEN ${box.minLat} AND ${box.maxLat}`,
        sql`CAST(${venues.longitude} AS DOUBLE PRECISION) BETWEEN ${box.minLng} AND ${box.maxLng}`
      )
    )
    .orderBy(events.eventDate)
    .limit(RESULT_LIMIT * 6);

  return dedupeEvents(rows, (row) => ({
    name: row.eventName,
    artistName: row.artistName,
    city: row.venueCity,
    eventDate: row.eventDate,
  }))
    .map((row) => {
      const vLat = parseFloat(row.venueLat ?? '');
      const vLng = parseFloat(row.venueLng ?? '');
      const distance = Number.isFinite(vLat) && Number.isFinite(vLng)
        ? haversineDistance({ lat, lng }, { lat: vLat, lng: vLng })
        : Infinity;
      return { ...row, distance };
    })
    .filter((row) => row.distance <= radius)
    .sort((a, b) => {
      const dateDiff = a.eventDate.getTime() - b.eventDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.distance - b.distance;
    })
    .slice(0, RESULT_LIMIT);
}

async function getPopularCities() {
  const now = new Date();
  return db
    .select({
      city: venues.city,
      state: venues.state,
      count: sql<number>`count(*)`,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(and(gte(events.eventDate, now), sql`${venues.city} IS NOT NULL`))
    .groupBy(venues.city, venues.state)
    .orderBy(sql`count(*) desc`)
    .limit(12);
}

const FAQS = [
  {
    question: 'How do I find concerts near me in 2026?',
    answer:
      'This page detects your approximate location and lists upcoming shows within your chosen radius, sorted by date, with Ticketmaster and SeatGeek ticket links for every show. Tap "Use precise location" for tighter results, or browse by city below.',
  },
  {
    question: 'Are there country concerts near me in 2026?',
    answer:
      'Very likely. Once your local shows load, scan the list for country headliners, or browse all current country tours on TourWax and check which stops land closest to you.',
  },
  {
    question: 'Can I see concerts happening tonight near me?',
    answer:
      'Yes. The Concerts Tonight page lists every show happening today grouped by city, and this page sorts your nearby shows soonest-first, so tonight’s concerts appear at the top.',
  },
  {
    question: 'How do I get tickets for concerts near me?',
    answer:
      'Every listing links directly to tickets on Ticketmaster or SeatGeek. For sold-out shows, resale listings often appear closer to the show date.',
  },
];

// The title must stay stable for crawlers: personalizing it with the IP-derived
// city would index whatever city the bot crawled from.
export async function generateMetadata(): Promise<Metadata> {
  return generateNearMeMetadata(null);
}

export default async function NearMePage() {
  const reqHeaders = await headers();
  const location = getLocationFromHeaders(reqHeaders);
  const popularCities = await getPopularCities();

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Concerts', url: '/concerts' },
    { name: 'Near Me', url: '/concerts/near-me' },
  ];

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Concerts', url: `${SITE_URL}/concerts` },
    { name: 'Near Me', url: `${SITE_URL}/concerts/near-me` },
  ]);

  const faqSchema = generateFAQSchema(FAQS);

  let initialData = null;
  if (location) {
    const enriched = await getNearbyEvents(location.lat, location.lng, DEFAULT_RADIUS_MILES);
    initialData = {
      location: {
        lat: location.lat,
        lng: location.lng,
        city: location.city,
        region: location.region,
        source: location.source,
        radiusMiles: DEFAULT_RADIUS_MILES,
      },
      events: enriched.map((row) => ({
        id: row.eventId,
        name: row.eventName,
        date: row.eventDate.toISOString(),
        ticketUrl: row.ticketUrl,
        ticketSource: row.ticketSource,
        minPrice: row.minPrice,
        distanceMiles: Math.round(row.distance * 10) / 10,
        venue: {
          id: row.venueId,
          name: row.venueName,
          city: row.venueCity,
          state: row.venueState,
        },
        artist: {
          name: row.artistName,
          slug: row.artistSlug,
          imageUrl: row.artistImageUrl,
        },
      })),
    };
  }

  return (
    <>
      <StructuredData data={[breadcrumbSchema, faqSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-10">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            Concerts <span className="gradient-text">Near Me</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl">
            Find concerts near you in 2026. We use your approximate location to surface upcoming shows, then sort by date so you can grab tickets fast. Tap &ldquo;Use precise location&rdquo; for tighter results.
          </p>
          <div className="flex gap-3 mt-4">
            <Link href="/concerts/tonight" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">Tonight</Link>
            <Link href="/concerts/this-weekend" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">This Weekend</Link>
            <Link href="/concerts" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">All Cities</Link>
          </div>
        </div>

        <NearMeClient initialData={initialData} />

        {/* Static sections below stay identical for every visitor and crawler */}
        <section className="mt-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Popular Cities for Live Music in 2026</h2>
          <p className="text-gray-600 mb-6 max-w-3xl">
            Not seeing your area, or planning a trip? These cities have the busiest 2026 concert
            calendars on TourWax right now.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {popularCities.map((c) => (
              <Link
                key={`${c.city}-${c.state}`}
                href={`/concerts/${slugify(c.city!)}`}
                className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 hover:shadow-md hover:border-orange-200 transition-all"
              >
                <span className="font-semibold text-gray-900">{c.city}</span>
                {c.state && <span className="text-gray-500 text-sm">, {c.state}</span>}
                <p className="text-xs text-gray-500 mt-0.5">{c.count} upcoming shows</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Browse Tours by Genre</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/tours/country" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">Country Tours</Link>
            <Link href="/tours/rock" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">Rock Tours</Link>
            <Link href="/tours/pop" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">Pop Tours</Link>
            <Link href="/tours/hip-hop" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">Hip-Hop Tours</Link>
            <Link href="/tours" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">All Genres</Link>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.question} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-2">{faq.question}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
