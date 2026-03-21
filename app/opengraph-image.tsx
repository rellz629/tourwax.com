import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'TourWax - Live Music Tour Dates & News';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #f97316, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <div
            style={{
              fontSize: '72px',
              fontWeight: 900,
              color: 'white',
              letterSpacing: '-2px',
            }}
          >
            TourWax
          </div>
        </div>
        <div
          style={{
            fontSize: '32px',
            color: '#f97316',
            fontWeight: 700,
            marginBottom: '16px',
          }}
        >
          Live Music Tour Dates & News
        </div>
        <div
          style={{
            fontSize: '22px',
            color: '#94a3b8',
            maxWidth: '700px',
            textAlign: 'center',
          }}
        >
          Track concerts, compare tickets, and never miss a show
        </div>
      </div>
    ),
    { ...size }
  );
}
