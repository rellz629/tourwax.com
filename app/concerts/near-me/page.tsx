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
import { generateBreadcrumbSchema } from '@/lib/schema';
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

export async function generateMetadata(): Promise<Metadata> {
  const reqHeaders = await headers();
  const location = getLocationFromHeaders(reqHeaders);
  return generateNearMeMetadata(location?.city ?? null);
}

export default async function NearMePage() {
  const reqHeaders = await headers();
  const location = getLocationFromHeaders(reqHeaders);

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
      <StructuredData data={[breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-10">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            Concerts <span className="gradient-text">Near Me</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl">
            Live music happening close to you. We use your approximate location to surface upcoming shows, then sort by date so you can grab tickets fast. Tap &ldquo;Use precise location&rdquo; for tighter results.
          </p>
          <div className="flex gap-3 mt-4">
            <Link href="/concerts/tonight" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">Tonight</Link>
            <Link href="/concerts/this-weekend" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">This Weekend</Link>
            <Link href="/concerts" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">All Cities</Link>
          </div>
        </div>

        <NearMeClient initialData={initialData} />
      </div>
    </>
  );
}
