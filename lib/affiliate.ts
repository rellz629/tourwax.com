/**
 * Affiliate tracking configuration and utilities
 */

export const AFFILIATE_CONFIG = {
  ticketmaster: {
    affiliateId: '6993168',
    campaignId: '264167',
    creativeId: '4272',
    trackingDomain: 'ticketmaster.evyy.net',
  },
} as const;

/**
 * Wraps a Ticketmaster URL with affiliate tracking
 * @param url - Original Ticketmaster event URL
 * @returns Affiliate-tracked URL via Impact Radius
 */
export function getTicketmasterAffiliateUrl(url: string): string {
  if (!url) return url;

  // Only apply to Ticketmaster URLs
  if (!url.includes('ticketmaster.com')) {
    return url;
  }

  const { affiliateId, campaignId, creativeId, trackingDomain } = AFFILIATE_CONFIG.ticketmaster;

  // URL-encode the destination
  const encodedUrl = encodeURIComponent(url);

  // Build affiliate tracking URL
  return `https://${trackingDomain}/c/${affiliateId}/${campaignId}/${creativeId}?u=${encodedUrl}`;
}

/**
 * Gets the appropriate affiliate URL based on event source
 * @param url - Original ticket URL
 * @param source - Event source (ticketmaster, seatgeek, etc.)
 * @returns Affiliate-tracked URL if applicable, original URL otherwise
 */
export function getAffiliateUrl(url: string, source: string): string {
  if (!url) return url;

  switch (source.toLowerCase()) {
    case 'ticketmaster':
      return getTicketmasterAffiliateUrl(url);
    // Add other affiliate programs here as needed
    default:
      return url;
  }
}
