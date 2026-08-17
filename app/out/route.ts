import { NextRequest, NextResponse } from 'next/server';
import { wrapAffiliateUrl, unwrapTrackingUrl } from '@/lib/affiliate';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * First-party outbound redirect for ticket links.
 *
 * Every "Get Tickets" href on the site points here instead of at the Impact
 * tracking domains (ticketmaster.evyy.net / seatgeek.pxf.io). Crawlers were
 * generating ~99% of affiliate clicks (desktop-only, non-buyer geos), which
 * drowns real click data and risks a click-fraud flag on the partner account.
 *
 * - /out is disallowed in robots.txt, so well-behaved crawlers never follow it.
 * - Bot user agents that do hit it are 302'd to the plain merchant URL,
 *   bypassing the affiliate network entirely.
 * - Humans are 302'd to the affiliate-wrapped URL as before.
 */

const BOT_UA =
  /bot|crawl|spider|scrap|slurp|fetch|monitor|preview|python|curl|wget|httpx|aiohttp|axios|node-fetch|java|okhttp|go-http|headless|phantomjs|selenium|playwright|puppeteer|lighthouse|pingdom|gptbot|oai-searchbot|chatgpt|claudebot|claude-web|perplexity|bytespider|petalbot|ahrefs|semrush|mj12|dotbot|screaming frog|facebookexternalhit|meta-externalagent|whatsapp|telegrambot|discordbot|slackbot|embedly|pinterestbot|bitlybot/i;

// Merchant destinations we will redirect to; anything else bounces home.
const MERCHANT_HOST =
  /(^|\.)ticketmaster\.(com|ca|co\.uk|ie|com\.au|co\.nz|de|fr|es|it|nl|be|at|ch|pl|cz|dk|fi|no|se|com\.mx)$|(^|\.)seatgeek\.com$/;
const TRACKING_HOST = /^(ticketmaster\.evyy\.net|seatgeek\.pxf\.io)$/;

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function GET(request: NextRequest) {
  const u = request.nextUrl.searchParams.get('u') ?? '';
  const source = request.nextUrl.searchParams.get('s') ?? '';

  // The stored URL may be a plain merchant URL (blog posts) or an already
  // wrapped tracking URL (older DB rows). Normalize both.
  const uHost = hostnameOf(u);
  const isTracking = uHost !== null && TRACKING_HOST.test(uHost);
  const merchantUrl = isTracking ? unwrapTrackingUrl(u) : u;
  const merchantHost = hostnameOf(merchantUrl);

  if (!merchantHost || !MERCHANT_HOST.test(merchantHost)) {
    return NextResponse.redirect(SITE_URL, 302);
  }

  const ua = request.headers.get('user-agent') ?? '';
  const isBot = ua.trim() === '' || BOT_UA.test(ua);

  const dest = isBot
    ? merchantUrl
    : isTracking
      ? u
      : wrapAffiliateUrl(merchantUrl, source || (merchantHost.endsWith('seatgeek.com') ? 'seatgeek' : 'ticketmaster'));

  const res = NextResponse.redirect(dest, 302);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}
