'use client';

import { useEffect } from 'react';

/**
 * Fires a GA4 `ticket_click` event whenever a user clicks a link that points at
 * one of our affiliate tracking domains. Uses a single delegated listener so it
 * covers every "Get Tickets" button site-wide without touching each render site.
 *
 * Event params let us attribute revenue: which network (ticketmaster/seatgeek)
 * and which page path the click came from.
 */

const TRACKING_DOMAINS: Record<string, string> = {
  'ticketmaster.evyy.net': 'ticketmaster',
  'seatgeek.pxf.io': 'seatgeek',
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export default function AffiliateClickTracker() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor || !anchor.href) return;

      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }

      // Ticket links now route through our first-party /out redirect; older
      // markup may still link the tracking domains directly.
      const source =
        url.pathname === '/out'
          ? (url.searchParams.get('s') ?? 'unknown')
          : TRACKING_DOMAINS[url.hostname];
      if (!source) return;

      if (typeof window.gtag === 'function') {
        window.gtag('event', 'ticket_click', {
          affiliate_source: source,
          page_path: window.location.pathname,
          link_url: anchor.href,
        });
      }
    }

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, []);

  return null;
}
