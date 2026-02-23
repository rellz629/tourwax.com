import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { artists, venues, events } from '@/db/schema';
import { ilike, eq, gte, and, isNotNull, sql } from 'drizzle-orm';
import { slugify } from '@/lib/slugify';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');

  if (!q || q.length < 2) {
    return NextResponse.json({ artists: [], cities: [] });
  }

  const pattern = `%${q}%`;

  const [artistResults, cityResults] = await Promise.all([
    db
      .select({
        name: artists.name,
        slug: artists.slug,
        imageUrl: artists.imageUrl,
        genre: artists.genre,
      })
      .from(artists)
      .where(and(ilike(artists.name, pattern), eq(artists.isActive, true)))
      .orderBy(artists.name)
      .limit(5),

    db
      .select({
        city: venues.city,
        state: venues.state,
        count: sql<number>`count(*)::int`,
      })
      .from(venues)
      .innerJoin(events, eq(events.venueId, venues.id))
      .where(
        and(
          ilike(venues.city, pattern),
          isNotNull(venues.city),
          gte(events.eventDate, sql`now()`)
        )
      )
      .groupBy(venues.city, venues.state)
      .orderBy(sql`count(*) desc`)
      .limit(5),
  ]);

  const citiesWithSlugs = cityResults.map((c) => ({
    city: c.city,
    state: c.state,
    count: c.count,
    slug: slugify(c.city!),
  }));

  const response = NextResponse.json({
    artists: artistResults,
    cities: citiesWithSlugs,
  });

  response.headers.set(
    'Cache-Control',
    'public, s-maxage=60, stale-while-revalidate=120'
  );

  return response;
}
