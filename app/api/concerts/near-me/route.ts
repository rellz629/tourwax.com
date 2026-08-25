import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { artists, events, eventArtists, venues } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { isPackage } from '@/lib/event-utils';
import { unwrapTrackingUrl } from '@/lib/affiliate';
import { boundingBox, haversineDistance, getLocationFromHeaders } from '@/lib/geo';

export const dynamic = 'force-dynamic';

const DEFAULT_RADIUS_MILES = 100;
const MAX_RADIUS_MILES = 500;
const RESULT_LIMIT = 25;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const latParam = params.get('lat');
  const lngParam = params.get('lng');
  const radiusParam = parseFloat(params.get('radius') || '');
  const limitParam = parseInt(params.get('limit') || '', 10);

  let lat: number | null = null;
  let lng: number | null = null;
  let locationCity: string | null = null;
  let locationRegion: string | null = null;
  let source: 'precise' | 'ip' = 'precise';

  if (latParam && lngParam) {
    lat = parseFloat(latParam);
    lng = parseFloat(lngParam);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }
  } else {
    const fromHeaders = getLocationFromHeaders(request.headers);
    if (!fromHeaders) {
      return NextResponse.json(
        { error: 'Location unavailable', events: [], location: null },
        { status: 200 }
      );
    }
    lat = fromHeaders.lat;
    lng = fromHeaders.lng;
    locationCity = fromHeaders.city;
    locationRegion = fromHeaders.region;
    source = 'ip';
  }

  const radius = Number.isFinite(radiusParam) && radiusParam > 0
    ? Math.min(radiusParam, MAX_RADIUS_MILES)
    : DEFAULT_RADIUS_MILES;
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, 100)
    : RESULT_LIMIT;

  const box = boundingBox({ lat, lng }, radius);
  const now = new Date();

  // Bounding-box pre-filter against venue lat/lng (stored as text — cast to numeric)
  const rows = await db
    .select({
      eventId: events.id,
      eventName: events.name,
      eventDate: events.eventDate,
      ticketUrl: events.ticketUrl,
      minPrice: events.minPrice,
      source: events.source,
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
    .limit(limit * 6);

  // Deduplicate by event id (joint headliners) preferring non-package row
  const grouped = new Map<string, typeof rows[0]>();
  for (const row of rows) {
    const existing = grouped.get(row.eventId);
    if (!existing) {
      grouped.set(row.eventId, row);
    } else if (isPackage(existing.eventName) && !isPackage(row.eventName)) {
      grouped.set(row.eventId, row);
    }
  }

  // Refine with true Haversine distance and filter by radius
  const enriched = Array.from(grouped.values())
    .map((row) => {
      const vLat = parseFloat(row.venueLat ?? '');
      const vLng = parseFloat(row.venueLng ?? '');
      const distance = Number.isFinite(vLat) && Number.isFinite(vLng)
        ? haversineDistance({ lat: lat!, lng: lng! }, { lat: vLat, lng: vLng })
        : Infinity;
      return { ...row, distance };
    })
    .filter((row) => row.distance <= radius)
    .sort((a, b) => {
      // Soonest first, with distance as a tiebreaker
      const dateDiff = a.eventDate.getTime() - b.eventDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.distance - b.distance;
    })
    .slice(0, limit);

  const response = NextResponse.json({
    location: {
      lat,
      lng,
      city: locationCity,
      region: locationRegion,
      source,
      radiusMiles: radius,
    },
    events: enriched.map((row) => ({
      id: row.eventId,
      name: row.eventName,
      date: row.eventDate.toISOString(),
      // Plain merchant URL only — the client wraps via /out; exposing the
      // affiliate-wrapped URL in JSON lets scrapers generate bot clicks.
      ticketUrl: row.ticketUrl ? unwrapTrackingUrl(row.ticketUrl) : row.ticketUrl,
      ticketSource: row.source,
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
  });

  // Short cache + SWR — location varies per user but identical params can be cached briefly
  response.headers.set(
    'Cache-Control',
    'private, max-age=60, stale-while-revalidate=120'
  );
  return response;
}
