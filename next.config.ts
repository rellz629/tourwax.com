import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

export default function config(phase: string): NextConfig {
  // Set IS_BUILDING so lib/setlistfm.ts can skip API calls during build
  // to avoid rate-limiting across 2,000+ artist pages
  if (phase === PHASE_PRODUCTION_BUILD) {
    process.env.IS_BUILDING = '1';
  }

  return {
    async redirects() {
      return [
        // Canonical host: force apex (tourwax.com) -> www with a permanent 308.
        // The sitemap, robots.txt, and every canonical tag already point to
        // www, so this removes the last apex/www ambiguity. `permanent: true`
        // emits 308 (the platform default for this redirect is a 307, which
        // signals a *temporary* move and muddies host canonicalization during
        // the Google host-demotion recovery). The `host` condition never
        // matches www or *.vercel.app, so there's no redirect loop and preview
        // deploys are unaffected.
        {
          source: '/:path*',
          has: [{ type: 'host', value: 'tourwax.com' }],
          destination: 'https://www.tourwax.com/:path*',
          permanent: true,
        },
      ];
    },
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=63072000; includeSubDomains; preload',
            },
          ],
        },
      ];
    },
    experimental: {
      serverActions: {
        bodySizeLimit: '2mb',
      },
    },
    images: {
      formats: ['image/webp'],
      qualities: [70, 75],
      deviceSizes: [640, 750, 828, 1080, 1200],
      imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
      minimumCacheTTL: 86400,
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 's1.ticketm.net',
        },
        {
          protocol: 'https',
          hostname: 'seatgeek.com',
        },
        {
          protocol: 'https',
          hostname: 'seatgeekimages.com',
        },
        {
          protocol: 'https',
          hostname: 'i.scdn.co',
        },
        {
          protocol: 'https',
          hostname: '**.scdn.co',
        },
        {
          protocol: 'https',
          hostname: 'upload.wikimedia.org',
        },
        {
          protocol: 'https',
          hostname: 'images.unsplash.com',
        },
      ],
    },
  };
}
