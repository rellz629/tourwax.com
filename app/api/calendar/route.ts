import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { events, venues, artists } from '@/db/schema';
import { eq, gte, and } from 'drizzle-orm';
import { generateICalEvent, generateICalFile } from '@/lib/ical';
import { getAffiliateUrl } from '@/lib/affiliate';

// Single event: /api/calendar?eventId=xxx
// All artist events: /api/calendar?artistSlug=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const eventId = searchParams.get('eventId');
  const artistSlug = searchParams.get('artistSlug');

  if (eventId) {
    return handleSingleEvent(eventId);
  }

  if (artistSlug) {
    return handleArtistEvents(artistSlug);
  }

  return NextResponse.json({ error: 'Missing eventId or artistSlug parameter' }, { status: 400 });
}

async function handleSingleEvent(eventId: string) {
  const result = await db
    .select({
      event: events,
      venue: venues,
      artistName: artists.name,
    })
    .from(events)
    .leftJoin(venues, eq(events.venueId, venues.id))
    .leftJoin(artists, eq(events.artistId, artists.id))
    .where(eq(events.id, eventId))
    .limit(1);

  if (result.length === 0) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const { event, venue, artistName } = result[0];
  const ticketUrl = event.ticketUrl ? getAffiliateUrl(event.ticketUrl, event.source) : undefined;

  const ical = generateICalEvent({
    id: event.id,
    name: event.name,
    eventDate: new Date(event.eventDate),
    venueName: venue?.name ?? undefined,
    venueCity: venue?.city ?? undefined,
    venueState: venue?.state ?? undefined,
    venueCountry: venue?.country ?? undefined,
    venueAddress: venue?.address ?? undefined,
    venueTimezone: venue?.timezone ?? undefined,
    ticketUrl,
    artistName: artistName ?? 'Unknown Artist',
  });

  const filename = `${(artistName ?? 'event').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date(event.eventDate).toISOString().slice(0, 10)}.ics`;

  return new NextResponse(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function handleArtistEvents(artistSlug: string) {
  const artist = await db.query.artists.findFirst({
    where: eq(artists.slug, artistSlug),
  });

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
  }

  const now = new Date();
  const artistEvents = await db
    .select({
      event: events,
      venue: venues,
    })
    .from(events)
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(
      eq(events.artistId, artist.id),
      gte(events.eventDate, now)
    ))
    .orderBy(events.eventDate);

  const calEvents = artistEvents.map(({ event, venue }) => ({
    id: event.id,
    name: event.name,
    eventDate: new Date(event.eventDate),
    venueName: venue?.name ?? undefined,
    venueCity: venue?.city ?? undefined,
    venueState: venue?.state ?? undefined,
    venueCountry: venue?.country ?? undefined,
    venueAddress: venue?.address ?? undefined,
    venueTimezone: venue?.timezone ?? undefined,
    ticketUrl: event.ticketUrl ? getAffiliateUrl(event.ticketUrl, event.source) : undefined,
    artistName: artist.name,
  }));

  const ical = generateICalFile(calEvents, `${artist.name} Tour Dates - TourWax`);
  const filename = `${artist.name.replace(/[^a-zA-Z0-9]/g, '-')}-tour-dates.ics`;

  return new NextResponse(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
