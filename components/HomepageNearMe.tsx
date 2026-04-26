'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAffiliateUrl } from '@/lib/affiliate';
import { slugify } from '@/lib/slugify';

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

const PREVIEW_LIMIT = 4;

export default function HomepageNearMe() {
  const [data, setData] = useState<NearMeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/concerts/near-me?limit=${PREVIEW_LIMIT}`)
      .then((res) => res.json())
      .then((json: NearMeData) => {
        if (cancelled) return;
        if (!json.location || json.events.length === 0) {
          setHidden(true);
        } else {
          setData(json);
        }
      })
      .catch(() => {
        if (!cancelled) setHidden(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden) return null;

  if (loading) {
    return (
      <section className="mb-16" aria-label="Concerts near you">
        <div className="bg-gradient-to-br from-orange-50 via-white to-red-50 rounded-2xl border border-orange-100 p-6 md:p-8">
          <div className="h-6 w-48 bg-orange-100 rounded animate-pulse mb-4"></div>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 bg-white/60 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!data || !data.location || data.events.length === 0) return null;

  const locationLabel = data.location.city
    ? `${data.location.city}${data.location.region ? `, ${data.location.region}` : ''}`
    : 'You';

  return (
    <section className="mb-16" aria-label={`Concerts near ${locationLabel}`}>
      <div className="bg-gradient-to-br from-orange-50 via-white to-red-50 rounded-2xl border border-orange-100 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900">
              Concerts Near <span className="gradient-text">{locationLabel}</span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Within {data.location.radiusMiles} miles · approximate location
            </p>
          </div>
          <Link
            href="/concerts/near-me"
            className="group inline-flex items-center gap-2 text-orange-500 hover:text-orange-600 font-semibold transition-colors whitespace-nowrap"
          >
            See all nearby
            <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-orange-100 divide-y divide-orange-50">
          {data.events.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-orange-50/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <Link
                    href={`/artists/${event.artist.slug}`}
                    className="font-semibold text-gray-900 hover:text-orange-600 transition-colors truncate"
                  >
                    {event.artist.name}
                  </Link>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {event.distanceMiles} mi
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {event.venue.city || event.venue.name}
                  {' · '}
                  {new Date(event.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              {event.ticketUrl && (
                <a
                  href={getAffiliateUrl(event.ticketUrl, event.ticketSource)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  {event.minPrice ? `$${event.minPrice}+` : 'Tickets'}
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
