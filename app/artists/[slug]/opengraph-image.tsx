import { ImageResponse } from 'next/og';
import { db } from '@/db';
import { artists, events, eventArtists } from '@/db/schema';
import { eq, gte, and } from 'drizzle-orm';

export const runtime = 'nodejs';
export const alt = 'Artist Tour Dates';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const artist = await db.query.artists.findFirst({
    where: eq(artists.slug, slug),
  });

  if (!artist) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: 'white', fontSize: 48 }}>
          Artist Not Found
        </div>
      ),
      { ...size }
    );
  }

  const now = new Date();
  const eventCount = await db
    .select()
    .from(events)
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .where(and(eq(eventArtists.artistId, artist.id), gte(events.eventDate, now)));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          fontFamily: 'system-ui, sans-serif',
          padding: '48px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '32px' }}>
          {artist.imageUrl ? (
            <img
              src={artist.imageUrl}
              width={200}
              height={200}
              style={{ borderRadius: '24px', objectFit: 'cover', border: '4px solid rgba(249,115,22,0.5)' }}
            />
          ) : (
            <div style={{ width: 200, height: 200, borderRadius: '24px', background: 'linear-gradient(135deg, #f97316, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 80, fontWeight: 900 }}>
              {artist.name.charAt(0)}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: 'white', lineHeight: 1.1, marginBottom: '12px' }}>
              {artist.name}
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ fontSize: 24, color: '#f97316', fontWeight: 700 }}>
                {eventCount.length} Upcoming Show{eventCount.length === 1 ? '' : 's'}
              </div>
              {artist.genre && (
                <div style={{ fontSize: 20, color: '#94a3b8', borderLeft: '2px solid #334155', paddingLeft: '16px' }}>
                  {artist.genre}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
          <div style={{ fontSize: 20, color: '#64748b', fontWeight: 600 }}>TourWax</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
