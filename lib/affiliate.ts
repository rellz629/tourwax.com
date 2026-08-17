/**
 * Affiliate tracking configuration and utilities
 *
 * Face-value sources (Ticketmaster, SeatGeek): event URLs stored in DB, wrapped at render time.
 * Resale sources (Vivid Seats, StubHub): no event URLs in DB — generate artist search URLs instead.
 */

export const AFFILIATE_CONFIG = {
  ticketmaster: {
    affiliateId: '6993168',
    campaignId: '264167',
    creativeId: '4272',
    trackingDomain: 'ticketmaster.evyy.net',
  },
  seatgeek: {
    affiliateId: '6993168',
    creativeId: '1756891',
    advertiserId: '20501',
    trackingDomain: 'seatgeek.pxf.io',
  },
  // TODO: Replace with real IDs once Vivid Seats Creator Program is approved
  // Program is via Impact Radius — format matches SeatGeek pattern
  vividseats: {
    affiliateId: 'VIVIDSEATS_AFFILIATE_ID',
    creativeId: 'VIVIDSEATS_CREATIVE_ID',
    trackingDomain: 'vividseats.sjv.io',
  },
  // TODO: Replace with real IDs once StubHub affiliate is approved
  // StubHub uses CJ Affiliate (Commission Junction)
  stubhub: {
    affiliateId: 'STUBHUB_AFFILIATE_ID',
    advertiserId: 'STUBHUB_ADVERTISER_ID',
    trackingDomain: 'www.anrdoezrs.net',
  },
} as const;

export function getTicketmasterAffiliateUrl(url: string): string {
  if (!url) return url;

  const { affiliateId, campaignId, creativeId, trackingDomain } = AFFILIATE_CONFIG.ticketmaster;
  if (url.startsWith(`https://${trackingDomain}/`)) return url;
  if (!url.includes('ticketmaster.com')) return url;

  return `https://${trackingDomain}/c/${affiliateId}/${campaignId}/${creativeId}?u=${encodeURIComponent(url)}`;
}

export function getSeatGeekAffiliateUrl(url: string): string {
  if (!url) return url;

  const { affiliateId, creativeId, advertiserId, trackingDomain } = AFFILIATE_CONFIG.seatgeek;
  if (url.startsWith(`https://${trackingDomain}/`)) return url;
  if (!url.includes('seatgeek.com')) return url;

  return `https://${trackingDomain}/c/${affiliateId}/${creativeId}/${advertiserId}?u=${encodeURIComponent(url)}`;
}

/**
 * Generates a Vivid Seats search URL for an artist + optional date.
 * Wraps with affiliate tracking once IDs are configured.
 */
export function getVividSeatsSearchUrl(artistName: string): string {
  const searchUrl = `https://www.vividseats.com/search?searchTerm=${encodeURIComponent(artistName)}`;
  const { affiliateId, creativeId, trackingDomain } = AFFILIATE_CONFIG.vividseats;

  // Skip affiliate wrapping until real IDs are set
  if (affiliateId.startsWith('VIVIDSEATS')) return searchUrl;

  return `https://${trackingDomain}/c/${affiliateId}/${creativeId}?u=${encodeURIComponent(searchUrl)}`;
}

/**
 * Generates a StubHub search URL for an artist.
 * Wraps with CJ Affiliate tracking once IDs are configured.
 */
export function getStubHubSearchUrl(artistName: string): string {
  const searchUrl = `https://www.stubhub.com/secure/search#q=${encodeURIComponent(artistName)}`;
  const { affiliateId, advertiserId, trackingDomain } = AFFILIATE_CONFIG.stubhub;

  // Skip affiliate wrapping until real IDs are set
  if (affiliateId.startsWith('STUBHUB')) return searchUrl;

  return `https://${trackingDomain}/click-${affiliateId}-${advertiserId}?url=${encodeURIComponent(searchUrl)}`;
}

/**
 * Extracts the plain merchant URL from an Impact tracking URL, or returns the
 * input unchanged if it isn't one. Used to send crawlers to the merchant
 * directly so they never register clicks on the affiliate network.
 */
export function unwrapTrackingUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingHosts: string[] = [
      AFFILIATE_CONFIG.ticketmaster.trackingDomain,
      AFFILIATE_CONFIG.seatgeek.trackingDomain,
    ];
    if (trackingHosts.includes(parsed.hostname.toLowerCase())) {
      const inner = parsed.searchParams.get('u');
      if (inner) return inner;
    }
  } catch {
    // not a URL; fall through
  }
  return url;
}

/**
 * Wraps a stored event URL with affiliate tracking directly (no /out hop).
 * Used by the /out redirect and by scripts that store wrapped URLs.
 */
export function wrapAffiliateUrl(url: string, source: string): string {
  if (!url) return url;

  switch (source.toLowerCase()) {
    case 'ticketmaster':
      return getTicketmasterAffiliateUrl(url);
    case 'seatgeek':
      return getSeatGeekAffiliateUrl(url);
    default:
      return url;
  }
}

/**
 * Display-time ticket URL for Ticketmaster/SeatGeek events. Returns a
 * first-party /out redirect (disallowed in robots.txt, bot-filtered in
 * app/out/route.ts) so crawlers never reach the Impact tracking domains:
 * ~99% of raw affiliate clicks were bots, which buries real click data and
 * risks the network flagging the account. Humans get 302'd to the wrapped
 * affiliate URL; the absolute URL keeps calendar (ICS) links working.
 */
export function getAffiliateUrl(url: string, source: string): string {
  if (!url) return url;

  const s = source.toLowerCase();
  if (s !== 'ticketmaster' && s !== 'seatgeek') return url;

  return `https://www.tourwax.com/out?u=${encodeURIComponent(url)}&s=${s}`;
}
