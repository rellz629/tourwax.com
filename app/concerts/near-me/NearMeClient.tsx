'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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

interface Props {
  initialData: NearMeData | null;
}

export default function NearMeClient({ initialData }: Props) {
  const [data, setData] = useState<NearMeData | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState<number>(initialData?.location?.radiusMiles ?? 100);

  const fetchEvents = useCallback(
    async (lat?: number, lng?: number, r: number = radius) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (typeof lat === 'number' && typeof lng === 'number') {
          params.set('lat', lat.toString());
          params.set('lng', lng.toString());
        }
        params.set('radius', r.toString());
        params.set('limit', '40');
        const res = await fetch(`/api/concerts/near-me?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to load nearby concerts');
        const json: NearMeData = await res.json();
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [radius]
  );

  const usePreciseLocation = () => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchEvents(pos.coords.latitude, pos.coords.longitude, radius);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location permission was denied. Showing approximate results based on your IP.');
        } else {
          setError('Could not get your location. Showing approximate results based on your IP.');
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    if (data?.location) {
      fetchEvents(data.location.lat, data.location.lng, newRadius);
    }
  };

  if (!data?.location) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8 text-center">
        <p className="text-gray-700 mb-4">
          We couldn&apos;t detect your location automatically.
        </p>
        <button
          type="button"
          onClick={usePreciseLocation}
          className="btn-primary"
          disabled={loading}
        >
          {loading ? 'Locating...' : 'Use my location'}
        </button>
        {error && (
          <p className="text-sm text-red-600 mt-4">{error}</p>
        )}
        <p className="text-sm text-gray-500 mt-6">
          Or browse{' '}
          <Link href="/concerts" className="text-orange-500 hover:text-orange-600 font-medium">
            concerts by city
          </Link>
          .
        </p>
      </div>
    );
  }

  const locationLabel = data.location.city
    ? `${data.location.city}${data.location.region ? `, ${data.location.region}` : ''}`
    : 'your area';

  return (
    <div>
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">
              {data.location.source === 'precise' ? 'Showing concerts near' : 'Approximate location:'}
            </p>
            <p className="text-xl font-bold text-gray-900">{locationLabel}</p>
            <p className="text-sm text-gray-500 mt-1">
              Within {radius} miles · {data.events.length} show{data.events.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <label className="text-sm text-gray-600 flex items-center gap-2">
              <span className="whitespace-nowrap">Radius:</span>
              <select
                value={radius}
                onChange={(e) => handleRadiusChange(parseInt(e.target.value, 10))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                disabled={loading}
              >
                <option value={25}>25 mi</option>
                <option value={50}>50 mi</option>
                <option value={100}>100 mi</option>
                <option value={200}>200 mi</option>
                <option value={500}>500 mi</option>
              </select>
            </label>
            {data.location.source !== 'precise' && (
              <button
                type="button"
                onClick={usePreciseLocation}
                className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                disabled={loading}
              >
                Use precise location
              </button>
            )}
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 mt-4">{error}</p>
        )}
      </div>

      {loading && (
        <div className="text-center text-gray-500 py-8">Loading nearby concerts...</div>
      )}

      {!loading && data.events.length === 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">
            No upcoming concerts found within {radius} miles.
          </p>
          <button
            type="button"
            onClick={() => handleRadiusChange(Math.min(radius * 2, 500))}
            className="text-orange-500 hover:text-orange-600 font-medium"
          >
            Try a wider radius →
          </button>
        </div>
      )}

      {!loading && data.events.length > 0 && (
        <div className="space-y-4">
          {data.events.map((event) => (
            <div
              key={event.id}
              className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover p-6 border border-gray-100"
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="flex items-start gap-4 flex-1">
                  <Link
                    href={`/artists/${event.artist.slug}`}
                    className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-500 to-red-500"
                  >
                    {event.artist.imageUrl ? (
                      <Image
                        src={event.artist.imageUrl}
                        alt={event.artist.name}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold">
                        {event.artist.name.charAt(0)}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/artists/${event.artist.slug}`}
                      className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors text-lg"
                    >
                      {event.artist.name}
                    </Link>
                    <p className="text-sm text-gray-600 mt-1">{event.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      <Link
                        href={`/venues/${slugify(event.venue.name)}`}
                        className="hover:text-orange-600 transition-colors"
                      >
                        {event.venue.name}
                      </Link>
                      {event.venue.city && (
                        <>
                          {' · '}
                          <Link
                            href={`/concerts/${slugify(event.venue.city)}`}
                            className="hover:text-orange-600 transition-colors"
                          >
                            {event.venue.city}
                          </Link>
                          {event.venue.state ? `, ${event.venue.state}` : ''}
                        </>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(event.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {' · '}
                      <span className="font-medium text-gray-700">
                        {event.distanceMiles} mi away
                      </span>
                    </p>
                  </div>
                </div>
                {event.ticketUrl && (
                  <a
                    href={getAffiliateUrl(event.ticketUrl, event.ticketSource)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary whitespace-nowrap"
                  >
                    {event.minPrice ? `From $${event.minPrice}` : 'Get Tickets'}
                    <span className="sr-only">(opens in new tab)</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
