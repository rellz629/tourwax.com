import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, gte, sql } from 'drizzle-orm';
import { slugify } from './slugify';

const PACKAGE_KEYWORDS = [
  'vip', 'package', 'upgrade', 'comfort seat', 'suite',
  'box seat', 'vinyl room', 'premium', 'platinum', 'hospitality',
  'club level', 'logen-seat', 'payment plan', 'upsell', 'excluding concert ticket',
];

function isPackage(name: string): boolean {
  return PACKAGE_KEYWORDS.some(kw => name.toLowerCase().includes(kw));
}

export interface CityInsight {
  city: string;
  state: string | null;
  citySlug: string;
  eventCount: number;
  artistCount: number;
  topArtists: string[];
  rank: number;
}

export interface ArtistInsight {
  artistName: string;
  artistSlug: string;
  imageUrl: string | null;
  genre: string | null;
  eventCount: number;
  cityCount: number;
  rank: number;
}

export async function getMostTouredCities(): Promise<CityInsight[]> {
  const now = new Date();

  const rows = await db
    .select({
      city: venues.city,
      state: venues.state,
      eventName: events.name,
      artistId: events.artistId,
      artistName: artists.name,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .innerJoin(artists, eq(events.artistId, artists.id))
    .where(gte(events.eventDate, now));

  // Group by city, dedup packages per artist+city
  const cityMap = new Map<string, {
    city: string;
    state: string | null;
    artistIds: Set<string>;
    artistNames: Map<string, number>; // name -> event count
    eventKeys: Set<string>;
  }>();

  for (const row of rows) {
    if (!row.city) continue;
    if (isPackage(row.eventName)) continue;

    const key = row.city.toLowerCase();
    let entry = cityMap.get(key);
    if (!entry) {
      entry = {
        city: row.city,
        state: row.state,
        artistIds: new Set(),
        artistNames: new Map(),
        eventKeys: new Set(),
      };
      cityMap.set(key, entry);
    }

    entry.eventKeys.add(`${row.artistId}_${row.eventName}`);
    entry.artistIds.add(row.artistId);
    const count = entry.artistNames.get(row.artistName) || 0;
    entry.artistNames.set(row.artistName, count + 1);
  }

  const results: CityInsight[] = Array.from(cityMap.values())
    .map((entry) => {
      // Top 5 artists by event count in this city
      const topArtists = Array.from(entry.artistNames.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

      return {
        city: entry.city,
        state: entry.state,
        citySlug: slugify(entry.city),
        eventCount: entry.eventKeys.size,
        artistCount: entry.artistIds.size,
        topArtists,
        rank: 0,
      };
    })
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 50);

  results.forEach((r, i) => { r.rank = i + 1; });
  return results;
}

export async function getBusiestTouringArtists(): Promise<ArtistInsight[]> {
  const now = new Date();

  const rows = await db
    .select({
      artistId: artists.id,
      artistName: artists.name,
      artistSlug: artists.slug,
      imageUrl: artists.imageUrl,
      genre: artists.genre,
      eventName: events.name,
      city: venues.city,
    })
    .from(events)
    .innerJoin(artists, eq(events.artistId, artists.id))
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(gte(events.eventDate, now));

  // Group by artist, dedup packages
  const artistMap = new Map<string, {
    name: string;
    slug: string;
    imageUrl: string | null;
    genre: string | null;
    eventKeys: Set<string>;
    cities: Set<string>;
  }>();

  for (const row of rows) {
    if (isPackage(row.eventName)) continue;

    let entry = artistMap.get(row.artistId);
    if (!entry) {
      entry = {
        name: row.artistName,
        slug: row.artistSlug,
        imageUrl: row.imageUrl,
        genre: row.genre,
        eventKeys: new Set(),
        cities: new Set(),
      };
      artistMap.set(row.artistId, entry);
    }

    entry.eventKeys.add(row.eventName);
    if (row.city) entry.cities.add(row.city);
  }

  const results: ArtistInsight[] = Array.from(artistMap.values())
    .map((entry) => ({
      artistName: entry.name,
      artistSlug: entry.slug,
      imageUrl: entry.imageUrl,
      genre: entry.genre,
      eventCount: entry.eventKeys.size,
      cityCount: entry.cities.size,
      rank: 0,
    }))
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 50);

  results.forEach((r, i) => { r.rank = i + 1; });
  return results;
}
