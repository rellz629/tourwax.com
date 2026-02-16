import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, gte, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

// Static Site Generation - pre-build pages at build time
export const dynamic = 'force-static';
export const revalidate = 1800; // Revalidate every 30 minutes

interface Props {
  params: Promise<{ slug: string }>;
}

// Generate static params for all artists at build time
export async function generateStaticParams() {
  const allArtists = await db
    .select({ slug: artists.slug })
    .from(artists)
    .where(eq(artists.isActive, true))
    .limit(100); // Generate top 100 artists at build time

  return allArtists.map((artist) => ({
    slug: artist.slug,
  }));
}

async function getArtistData(slug: string) {
  const artist = await db
    .select()
    .from(artists)
    .where(eq(artists.slug, slug))
    .limit(1);

  if (!artist[0]) return null;

  const now = new Date();
  const artistEvents = await db
    .select({
      event: events,
      venue: venues,
    })
    .from(events)
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(
      eq(events.artistId, artist[0].id),
      gte(events.eventDate, now)
    ))
    .orderBy(events.eventDate)
    .limit(50);

  return { artist: artist[0], events: artistEvents };
}

export default async function ArtistPage({ params }: Props) {
  const { slug } = await params;
  const data = await getArtistData(slug);

  if (!data) {
    notFound();
  }

  const { artist, events: artistEvents } = data;

  return (
    <html>
      <head>
        <title>{artist.name} Tour Dates | TourWax</title>
      </head>
      <body style={{ fontFamily: 'system-ui', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <nav style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid #ddd' }}>
          <Link href="/" style={{ marginRight: '20px', color: '#0070f3' }}>Home</Link>
          <Link href="/artists" style={{ color: '#0070f3' }}>All Artists</Link>
        </nav>

        <h1 style={{ fontSize: '3rem', marginBottom: '10px' }}>{artist.name}</h1>
        {artist.genre && <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '30px' }}>Genre: {artist.genre}</p>}

        {artist.bio && (
          <div style={{ marginBottom: '40px', padding: '20px', background: '#f5f5f5', borderRadius: '8px' }}>
            <h2>About</h2>
            <p>{artist.bio}</p>
          </div>
        )}

        <h2 style={{ fontSize: '2rem', marginBottom: '20px' }}>
          Tour Dates ({artistEvents.length} shows)
        </h2>

        {artistEvents.length === 0 ? (
          <p style={{ padding: '40px', textAlign: 'center', background: '#f9f9f9', borderRadius: '8px' }}>
            No upcoming tour dates scheduled.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {artistEvents.map(({ event, venue }) => (
              <div key={event.id} style={{
                padding: '20px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                background: 'white'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem' }}>{event.name}</h3>
                    {venue && (
                      <p style={{ margin: '5px 0', color: '#666' }}>
                        📍 {venue.name}
                        {venue.city && ` - ${venue.city}, ${venue.state}`}
                      </p>
                    )}
                    <p style={{ margin: '5px 0', color: '#666' }}>
                      📅 {new Date(event.eventDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    {event.minPrice && (
                      <p style={{ margin: '5px 0', color: '#0070f3', fontWeight: 'bold' }}>
                        From ${event.minPrice}
                      </p>
                    )}
                  </div>
                  {event.ticketUrl && (
                    <a
                      href={event.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '10px 20px',
                        background: '#0070f3',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '5px',
                        fontWeight: 'bold'
                      }}
                    >
                      Get Tickets
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </body>
    </html>
  );
}
