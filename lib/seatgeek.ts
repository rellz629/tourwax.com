import type { NewEvent, NewVenue } from '@/db/schema';

const BASE_URL = 'https://api.seatgeek.com/2';

interface SeatgeekVenue {
  id: number;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  postal_code?: string;
  location?: { lat?: number; lon?: number };
  timezone?: string;
  capacity?: number;
  url?: string;
}

interface SeatgeekEvent {
  id: number;
  title: string;
  datetime_local: string;
  venue: SeatgeekVenue;
  stats?: {
    lowest_price?: number;
    highest_price?: number;
  };
  url?: string;
  performers?: Array<{ id: number; name: string; image?: string }>;
}

interface SeatgeekResponse {
  events?: SeatgeekEvent[];
  meta?: {
    total?: number;
    per_page?: number;
  };
}

function getAuthParams(): URLSearchParams {
  if (!process.env.SEATGEEK_CLIENT_ID) {
    throw new Error('SEATGEEK_CLIENT_ID is not set');
  }

  return new URLSearchParams({
    client_id: process.env.SEATGEEK_CLIENT_ID,
  });
}

export async function searchArtistEvents(artistName: string): Promise<{
  events: NewEvent[];
  venues: NewVenue[];
  seatgeekId?: number;
}> {
  const params = getAuthParams();
  params.append('q', artistName);
  params.append('type', 'concert');
  params.append('per_page', '100');
  params.append('sort', 'datetime_local.asc');

  const response = await fetch(`${BASE_URL}/events?${params}`);

  if (!response.ok) {
    throw new Error(`SeatGeek API error: ${response.status}`);
  }

  const data: SeatgeekResponse = await response.json();

  const events: NewEvent[] = [];
  const venues: NewVenue[] = [];
  const venueIds = new Set<string>();
  let seatgeekId: number | undefined;

  const sgEvents = data.events || [];

  for (const event of sgEvents) {
    // Get the first performer ID as seatgeek artist ID
    if (!seatgeekId && event.performers?.[0]) {
      seatgeekId = event.performers[0].id;
    }

    const venue = event.venue;
    const venueId = `sg-${venue.id}`;

    if (!venueIds.has(venueId)) {
      venueIds.add(venueId);
      venues.push({
        id: venueId,
        name: venue.name,
        city: venue.city || null,
        state: venue.state || null,
        country: venue.country || null,
        address: venue.address || null,
        postalCode: venue.postal_code || null,
        latitude: venue.location?.lat?.toString() || null,
        longitude: venue.location?.lon?.toString() || null,
        timezone: venue.timezone || null,
        capacity: venue.capacity || null,
        url: venue.url || null,
      });
    }

    events.push({
      id: `sg-${event.id}`,
      artistId: '', // Will be set by caller
      venueId,
      name: event.title,
      eventDate: new Date(event.datetime_local),
      status: 'scheduled',
      ticketUrl: event.url || null,
      minPrice: event.stats?.lowest_price || null,
      maxPrice: event.stats?.highest_price || null,
      currency: 'USD',
      source: 'seatgeek',
      externalId: event.id.toString(),
      metadata: null,
    });
  }

  return { events, venues, seatgeekId };
}

export async function getPerformerByName(artistName: string): Promise<{
  id: number;
  name: string;
  imageUrl?: string;
  genre?: string;
} | null> {
  const params = getAuthParams();
  params.append('q', artistName);

  const response = await fetch(`${BASE_URL}/performers?${params}`);

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const performer = data.performers?.[0];

  if (!performer) {
    return null;
  }

  return {
    id: performer.id,
    name: performer.name,
    imageUrl: performer.image,
    genre: performer.genres?.[0]?.name,
  };
}
