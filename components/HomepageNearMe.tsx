'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAffiliateUrl } from '@/lib/affiliate';

interface NearMeEvent {
  id: string;
  name: string;
  date: string;
  ticketUrl: string | null;
  ticketSource: string;
  minPrice: number | null;
  distanceMiles: number;
  venue: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
  };
  artist: {
    name: string;
    slug: string;
    imageUrl: string | null;
  };
}

interface NearMeData {
  location: {
    lat: number;
    lng: number;
    city: string | null;
    region: string | null;
    source: 'ip' | 'precise';
    radiusMiles: number;
  } | null;
  events: NearMeEvent[];
}

/** Server-rendered rows shown when the visitor's location is unavailable. */
export interface FallbackEvent {
  id: string;
  artistName: string;
  artistSlug: string;
  city: string | null;
  state: string | null;
  /** ISO string */
  eventDate: string;
  timezone: string | null;
  ticketUrl: string | null;
  source: string;
}

interface Props {
  fallbackEvents: FallbackEvent[];
}

const PREVIEW_LIMIT = 5;

interface Row {
  id: string;
  day: string;
  month: string;
  artistName: string;
  artistSlug: string;
  where: string;
  ticketHref: string | null;
  ticketLabel: string;
}

function dateParts(iso: string, timeZone?: string | null) {
  const d = new Date(iso);
  const opts = timeZone ? { timeZone } : {};
  return {
    day: d.toLocaleDateString('en-US', { day: 'numeric', ...opts }),
    month: d.toLocaleDateString('en-US', { month: 'short', ...opts }),
  };
}

/**
 * The hero's right-hand board. Never renders empty: it shows nearby shows when
 * the visitor's location is known, and the next few shows anywhere otherwise.
 */
export default function HomepageNearMe({ fallbackEvents }: Props) {
  const [data, setData] = useState<NearMeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/concerts/near-me?limit=${PREVIEW_LIMIT}`)
      .then((res) => res.json())
      .then((json: NearMeData) => {
        if (cancelled) return;
        if (json.location && json.events.length > 0) setData(json);
      })
      .catch(() => {
        /* fall through to the fallback board */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const located = !!(data && data.location && data.events.length > 0);

  let heading: string;
  let sub: string;
  let moreHref: string;
  let moreLabel: string;
  let rows: Row[];

  if (located) {
    const loc = data!.location!;
    const locationLabel = loc.city
      ? `${loc.city}${loc.region ? `, ${loc.region}` : ''}`
      : 'you';
    heading = `Near ${locationLabel}`;
    sub = `Within ${loc.radiusMiles} miles of your approximate location.`;
    moreHref = '/concerts/near-me';
    moreLabel = 'See all nearby shows';
    rows = data!.events.slice(0, PREVIEW_LIMIT).map((e) => {
      const { day, month } = dateParts(e.date);
      const place = e.venue.city || e.venue.name;
      return {
        id: e.id,
        day,
        month,
        artistName: e.artist.name,
        artistSlug: e.artist.slug,
        where: `${place}, ${e.distanceMiles < 10 ? e.distanceMiles : Math.round(e.distanceMiles)} mi`,
        ticketHref: e.ticketUrl ? getAffiliateUrl(e.ticketUrl, e.ticketSource) : null,
        ticketLabel: e.minPrice ? `$${e.minPrice}+` : 'Tickets',
      };
    });
  } else {
    heading = 'This week';
    sub = 'The next shows on the board, anywhere.';
    moreHref = '/concerts/this-week';
    moreLabel = 'See all shows this week';
    rows = fallbackEvents.slice(0, PREVIEW_LIMIT).map((e) => {
      const { day, month } = dateParts(e.eventDate, e.timezone);
      return {
        id: e.id,
        day,
        month,
        artistName: e.artistName,
        artistSlug: e.artistSlug,
        where: [e.city, e.state].filter(Boolean).join(', '),
        ticketHref: e.ticketUrl ? getAffiliateUrl(e.ticketUrl, e.source) : null,
        ticketLabel: 'Tickets',
      };
    });
  }

  return (
    <section
      className="bg-paper text-ink border border-line border-t-4 border-t-wax p-5 lg:p-6"
      aria-label={heading}
      aria-busy={loading}
    >
      <h2 className="display text-3xl text-ink">
        {loading ? <span className="inline-block h-8 w-48 bg-line animate-pulse align-middle" aria-hidden="true" /> : heading}
        {loading && <span className="sr-only">Finding shows near you</span>}
      </h2>
      <p className="text-sm text-muted mt-1 mb-2">{loading ? ' ' : sub}</p>

      <ol className="list-none m-0 p-0">
        {rows.map((row) => (
          <li
            key={row.id}
            className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-3 py-3 border-t border-line"
          >
            <div className="leading-none numerals" aria-hidden="true">
              <span className="display text-3xl text-label">{row.day}</span>
              <span className="block text-xs text-muted uppercase tracking-wide mt-0.5">{row.month}</span>
            </div>
            <div className="min-w-0">
              <Link
                href={`/artists/${row.artistSlug}`}
                className="block font-semibold text-ink hover:text-wax transition-colors truncate"
              >
                {row.artistName}
              </Link>
              <p className="text-sm text-muted truncate">
                <span className="sr-only">{row.month} {row.day}, </span>
                {row.where}
              </p>
            </div>
            {row.ticketHref ? (
              <a
                href={row.ticketHref}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-wax hover:bg-wax-deep text-white text-sm font-semibold px-3 py-1.5 rounded transition-colors whitespace-nowrap numerals"
              >
                {row.ticketLabel}
                <span className="sr-only"> for {row.artistName} (opens in new tab)</span>
              </a>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ol>

      <div className="border-t-2 border-ink mt-1 pt-3">
        <Link href={moreHref} className="font-semibold text-ink hover:text-wax transition-colors">
          {moreLabel}
        </Link>
      </div>
    </section>
  );
}
