import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import { slugify } from './slugify';
import { isPackage } from './event-utils';

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

export interface VenueInsight {
  venueName: string;
  venueSlug: string;
  city: string | null;
  state: string | null;
  eventCount: number;
  artistCount: number;
  topArtists: string[];
  rank: number;
}

export async function getTopConcertVenues(): Promise<VenueInsight[]> {
  const now = new Date();

  const rows = await db
    .select({
      venueName: venues.name,
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

  const venueMap = new Map<string, {
    venueName: string;
    city: string | null;
    state: string | null;
    artistIds: Set<string>;
    artistNames: Map<string, number>;
    eventKeys: Set<string>;
  }>();

  for (const row of rows) {
    if (isPackage(row.eventName)) continue;

    const key = slugify(row.venueName);
    let entry = venueMap.get(key);
    if (!entry) {
      entry = {
        venueName: row.venueName,
        city: row.city,
        state: row.state,
        artistIds: new Set(),
        artistNames: new Map(),
        eventKeys: new Set(),
      };
      venueMap.set(key, entry);
    }

    entry.eventKeys.add(`${row.artistId}_${row.eventName}`);
    entry.artistIds.add(row.artistId);
    const count = entry.artistNames.get(row.artistName) || 0;
    entry.artistNames.set(row.artistName, count + 1);
  }

  const results: VenueInsight[] = Array.from(venueMap.values())
    .map((entry) => {
      const topArtists = Array.from(entry.artistNames.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

      return {
        venueName: entry.venueName,
        venueSlug: slugify(entry.venueName),
        city: entry.city,
        state: entry.state,
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

export interface MonthInsight {
  month: string; // "January 2026"
  monthKey: string; // "2026-01"
  eventCount: number;
  artistCount: number;
  cityCount: number;
  topArtists: string[];
  topCities: string[];
  rank: number;
}

export async function getBusiestTouringMonths(): Promise<MonthInsight[]> {
  const now = new Date();

  const rows = await db
    .select({
      eventDate: events.eventDate,
      eventName: events.name,
      artistId: events.artistId,
      artistName: artists.name,
      city: venues.city,
    })
    .from(events)
    .innerJoin(artists, eq(events.artistId, artists.id))
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(gte(events.eventDate, now));

  const monthMap = new Map<string, {
    month: string;
    monthKey: string;
    eventKeys: Set<string>;
    artistIds: Set<string>;
    artistNames: Map<string, number>;
    cities: Map<string, number>;
  }>();

  for (const row of rows) {
    if (isPackage(row.eventName)) continue;

    const date = new Date(row.eventDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    let entry = monthMap.get(monthKey);
    if (!entry) {
      entry = {
        month: monthLabel,
        monthKey,
        eventKeys: new Set(),
        artistIds: new Set(),
        artistNames: new Map(),
        cities: new Map(),
      };
      monthMap.set(monthKey, entry);
    }

    entry.eventKeys.add(`${row.artistId}_${row.eventName}_${monthKey}`);
    entry.artistIds.add(row.artistId);
    const artistCount = entry.artistNames.get(row.artistName) || 0;
    entry.artistNames.set(row.artistName, artistCount + 1);
    if (row.city) {
      const cityCount = entry.cities.get(row.city) || 0;
      entry.cities.set(row.city, cityCount + 1);
    }
  }

  const results: MonthInsight[] = Array.from(monthMap.values())
    .map((entry) => {
      const topArtists = Array.from(entry.artistNames.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

      const topCities = Array.from(entry.cities.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

      return {
        month: entry.month,
        monthKey: entry.monthKey,
        eventCount: entry.eventKeys.size,
        artistCount: entry.artistIds.size,
        cityCount: entry.cities.size,
        topArtists,
        topCities,
        rank: 0,
      };
    })
    .sort((a, b) => b.eventCount - a.eventCount);

  results.forEach((r, i) => { r.rank = i + 1; });
  return results;
}

export interface RisingArtistInsight {
  artistName: string;
  artistSlug: string;
  imageUrl: string | null;
  genre: string | null;
  newEventCount: number;
  totalEventCount: number;
  topCities: string[];
  rank: number;
}

export async function getRisingArtists(): Promise<RisingArtistInsight[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get all future events added in the last 30 days
  const rows = await db
    .select({
      artistId: artists.id,
      artistName: artists.name,
      artistSlug: artists.slug,
      imageUrl: artists.imageUrl,
      genre: artists.genre,
      eventName: events.name,
      eventCreatedAt: events.createdAt,
      city: venues.city,
    })
    .from(events)
    .innerJoin(artists, eq(events.artistId, artists.id))
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(and(gte(events.eventDate, now), gte(events.createdAt, thirtyDaysAgo)));

  // Also get total future event counts per artist for context
  const allFutureRows = await db
    .select({
      artistId: artists.id,
      eventName: events.name,
    })
    .from(events)
    .innerJoin(artists, eq(events.artistId, artists.id))
    .where(gte(events.eventDate, now));

  const totalCountMap = new Map<string, Set<string>>();
  for (const row of allFutureRows) {
    if (isPackage(row.eventName)) continue;
    let keys = totalCountMap.get(row.artistId);
    if (!keys) {
      keys = new Set();
      totalCountMap.set(row.artistId, keys);
    }
    keys.add(row.eventName);
  }

  const artistMap = new Map<string, {
    name: string;
    slug: string;
    imageUrl: string | null;
    genre: string | null;
    newEventKeys: Set<string>;
    cities: Map<string, number>;
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
        newEventKeys: new Set(),
        cities: new Map(),
      };
      artistMap.set(row.artistId, entry);
    }

    entry.newEventKeys.add(row.eventName);
    if (row.city) {
      const count = entry.cities.get(row.city) || 0;
      entry.cities.set(row.city, count + 1);
    }
  }

  const results: RisingArtistInsight[] = Array.from(artistMap.entries())
    .map(([artistId, entry]) => {
      const topCities = Array.from(entry.cities.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      return {
        artistName: entry.name,
        artistSlug: entry.slug,
        imageUrl: entry.imageUrl,
        genre: entry.genre,
        newEventCount: entry.newEventKeys.size,
        totalEventCount: totalCountMap.get(artistId)?.size || 0,
        topCities,
        rank: 0,
      };
    })
    .sort((a, b) => b.newEventCount - a.newEventCount)
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
