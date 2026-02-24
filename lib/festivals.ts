import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, gte, sql } from 'drizzle-orm';
import { slugify } from './slugify';
import type { Artist, Event, Venue } from '@/db/schema';

export const MIN_ARTISTS_FOR_FESTIVAL = 3;

const PACKAGE_KEYWORDS = [
  'vip', 'package', 'upgrade', 'comfort seat', 'suite',
  'box seat', 'vinyl room', 'premium', 'platinum', 'hospitality',
  'club level', 'logen-seat', 'payment plan', 'upsell', 'excluding concert ticket',
];

function isPackage(name: string): boolean {
  return PACKAGE_KEYWORDS.some(kw => name.toLowerCase().includes(kw));
}

export interface FestivalArtist {
  name: string;
  slug: string;
  imageUrl: string | null;
  genre: string | null;
}

export interface FestivalEvent {
  id: string;
  name: string;
  eventDate: Date;
  ticketUrl: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
  source: string;
  artist: FestivalArtist;
}

export interface Festival {
  name: string;
  slug: string;
  date: string; // YYYY-MM-DD
  formattedDate: string;
  venue: Venue;
  venueSlug: string;
  artists: FestivalArtist[];
  events: FestivalEvent[];
  artistCount: number;
}

/**
 * Find longest common prefix among event names, used to derive festival name.
 */
export function deriveFestivalName(eventNames: string[], venueName: string, formattedDate: string): string {
  if (eventNames.length === 0) return `${venueName} - ${formattedDate}`;

  // Find longest common prefix
  let prefix = eventNames[0];
  for (let i = 1; i < eventNames.length; i++) {
    while (!eventNames[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix.length === 0) break;
    }
    if (prefix.length === 0) break;
  }

  // Clean up trailing separators
  prefix = prefix.replace(/[\s\-:,|]+$/, '').trim();

  if (prefix.length >= 5) {
    return prefix;
  }

  return `${venueName} - ${formattedDate}`;
}

export async function getAllFestivals(): Promise<Festival[]> {
  const now = new Date();

  // Fetch all future events with venue and artist info
  const rows = await db
    .select({
      event: events,
      venue: venues,
      artist: artists,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .innerJoin(artists, eq(events.artistId, artists.id))
    .where(gte(events.eventDate, now))
    .orderBy(events.eventDate);

  // Group by venue slug + date
  const groups = new Map<string, {
    venueSlug: string;
    date: string;
    venue: Venue;
    eventsByArtist: Map<string, { event: Event; artist: Artist }>;
  }>();

  for (const row of rows) {
    if (!row.venue.name) continue;
    if (isPackage(row.event.name)) continue;

    const venueSlug = slugify(row.venue.name);
    const dateKey = new Date(row.event.eventDate).toISOString().slice(0, 10);
    const groupKey = `${venueSlug}_${dateKey}`;

    let group = groups.get(groupKey);
    if (!group) {
      group = {
        venueSlug,
        date: dateKey,
        venue: row.venue,
        eventsByArtist: new Map(),
      };
      groups.set(groupKey, group);
    }

    // Keep one event per artist (prefer non-package, already filtered above)
    if (!group.eventsByArtist.has(row.artist.id)) {
      group.eventsByArtist.set(row.artist.id, { event: row.event, artist: row.artist });
    }
  }

  // Filter to groups with 3+ distinct artists
  const festivals: Festival[] = [];

  for (const group of groups.values()) {
    if (group.eventsByArtist.size < MIN_ARTISTS_FOR_FESTIVAL) continue;

    const entries = Array.from(group.eventsByArtist.values());
    const eventNames = entries.map((e) => e.event.name);

    const formattedDate = new Date(group.date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const festivalName = deriveFestivalName(eventNames, group.venue.name, formattedDate);
    const festivalSlug = `${slugify(festivalName)}-${group.date}`;

    const festivalArtists: FestivalArtist[] = entries.map((e) => ({
      name: e.artist.name,
      slug: e.artist.slug,
      imageUrl: e.artist.imageUrl,
      genre: e.artist.genre,
    }));

    const festivalEvents: FestivalEvent[] = entries.map((e) => ({
      id: e.event.id,
      name: e.event.name,
      eventDate: e.event.eventDate,
      ticketUrl: e.event.ticketUrl,
      minPrice: e.event.minPrice,
      maxPrice: e.event.maxPrice,
      currency: e.event.currency,
      source: e.event.source,
      artist: {
        name: e.artist.name,
        slug: e.artist.slug,
        imageUrl: e.artist.imageUrl,
        genre: e.artist.genre,
      },
    }));

    festivals.push({
      name: festivalName,
      slug: festivalSlug,
      date: group.date,
      formattedDate,
      venue: group.venue,
      venueSlug: group.venueSlug,
      artists: festivalArtists,
      events: festivalEvents,
      artistCount: festivalArtists.length,
    });
  }

  // Sort by artist count descending
  festivals.sort((a, b) => b.artistCount - a.artistCount);

  return festivals;
}

export async function getFestivalBySlug(slug: string): Promise<Festival | null> {
  const festivals = await getAllFestivals();
  return festivals.find((f) => f.slug === slug) || null;
}
