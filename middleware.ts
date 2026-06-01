import { NextRequest, NextResponse } from 'next/server';
import { GONE_URLS } from '@/lib/gone-urls';

/**
 * Normalize URL slugs: strip diacritics, fix encoding issues, block "null" segments.
 * Redirects to the canonical slug with a 301 if the URL changes after normalization.
 *
 * Also returns 410 Gone for URLs in lib/gone-urls.ts (URLs Google had indexed
 * but where no matching DB row exists anymore — deleted entities, festival
 * rollups, etc.). 410 tells Google to drop the URL from the index permanently
 * rather than retrying the 404.
 */

function slugifySegment(segment: string): string {
  return decodeURIComponent(segment)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Routes with dynamic slugs that should be normalized
const DYNAMIC_ROUTES = ['/artists/', '/venues/', '/concerts/', '/tours/', '/festivals/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only process dynamic routes
  const matchedRoute = DYNAMIC_ROUTES.find((route) => pathname.startsWith(route));
  if (!matchedRoute) return NextResponse.next();

  // Get the slug portion after the route prefix
  const rest = pathname.slice(matchedRoute.length);
  if (!rest) return NextResponse.next();

  // Split on / to handle nested routes like /concerts/state/[state]
  const segments = rest.split('/');
  const normalizedSegments = segments.map((seg) => {
    // Block "null" / "undefined" literal segments
    if (seg === 'null' || seg === 'undefined') return null;
    // Don't normalize known static sub-routes
    if (['state', 'tonight', 'this-week', 'this-weekend', 'feed.xml'].includes(seg)) return seg;
    return slugifySegment(seg);
  });

  // If any segment resolved to null (was "null"/"undefined"), return 404
  if (normalizedSegments.some((s) => s === null)) {
    return NextResponse.rewrite(new URL('/not-found', request.url));
  }

  const normalizedPath = matchedRoute + normalizedSegments.join('/');

  // If the normalized path differs, do a 301 redirect
  if (normalizedPath !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = normalizedPath;
    return NextResponse.redirect(url, 301);
  }

  // Path is already canonical. If it's on the GONE list (Google had it indexed,
  // no replacement exists), return 410 so Google drops it from the index.
  if (GONE_URLS.has(pathname)) {
    return new NextResponse(null, { status: 410 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/artists/:path+', '/venues/:path+', '/concerts/:path+', '/tours/:path+', '/festivals/:path+'],
};
