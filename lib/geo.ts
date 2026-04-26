/** Geolocation utilities for the "Concerts Near Me" feature. */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RequestLocation extends Coordinates {
  city: string | null;
  region: string | null;
  country: string | null;
  source: 'ip' | 'precise';
}

/** Haversine distance in miles between two lat/lng pairs. */
export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compute a lat/lng bounding box around a center for cheap pre-filtering. */
export function boundingBox(center: Coordinates, radiusMiles: number) {
  const milesPerDegLat = 69;
  const milesPerDegLng = Math.max(
    1,
    Math.cos((center.lat * Math.PI) / 180) * 69
  );
  const dLat = radiusMiles / milesPerDegLat;
  const dLng = radiusMiles / milesPerDegLng;
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/** Read Vercel's automatic geolocation headers from a Request or Headers object. */
export function getLocationFromHeaders(headers: Headers): RequestLocation | null {
  const latStr = headers.get('x-vercel-ip-latitude');
  const lngStr = headers.get('x-vercel-ip-longitude');
  if (!latStr || !lngStr) return null;
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const cityRaw = headers.get('x-vercel-ip-city');
  return {
    lat,
    lng,
    city: cityRaw ? decodeURIComponent(cityRaw) : null,
    region: headers.get('x-vercel-ip-country-region'),
    country: headers.get('x-vercel-ip-country'),
    source: 'ip',
  };
}
