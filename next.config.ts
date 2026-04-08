import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

export default function config(phase: string): NextConfig {
  // Set IS_BUILDING so lib/setlistfm.ts can skip API calls during build
  // to avoid rate-limiting across 2,000+ artist pages
  if (phase === PHASE_PRODUCTION_BUILD) {
    process.env.IS_BUILDING = '1';
  }

  return {
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
      ],
    },
  };
}
