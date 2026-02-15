import type { Event as DBEvent, NewEvent, NewVenue } from '@/db/schema';

const BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

interface TicketmasterVenue {
  id: string;
  name: string;
  city?: { name?: string };
  state?: { stateCode?: string };
  country?: { countryCode?: string };
  address?: { line1?: string };
  postalCode?: string;
  location?: { latitude?: string; longitude?: string };
  timezone?: string;
  url?: string;
}

interface TicketmasterEvent {
  id: string;
  name: string;
  dates: {
    start: { localDate?: string; localTime?: string; dateTime?: string };
    status?: { code?: string };
  };
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
  url?: string;
  _embedded?: {
    venues?: TicketmasterVenue[];
    attractions?: Array<{ id: string; name: string }>;
  };
}

interface TicketmasterResponse {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
  page?: {
    totalElements?: number;
    totalPages?: number;
  };
}

export async function searchArtistEvents(artistName: string): Promise<{
  events: NewEvent[];
  venues: NewVenue[];
  ticketmasterId?: string;
}> {
  if (!process.env.TICKETMASTER_API_KEY) {
    throw new Error('TICKETMASTER_API_KEY is not set');
  }

  const params = new URLSearchParams({
    apikey: process.env.TICKETMASTER_API_KEY,
    keyword: artistName,
    classificationName: 'music',
    size: '100',
    sort: 'date,asc',
  });

  const response = await fetch(`${BASE_URL}/events.json?${params}`);

  if (!response.ok) {
    throw new Error(`Ticketmaster API error: ${response.status}`);
  }

  const data: TicketmasterResponse = await response.json();

  const events: NewEvent[] = [];
  const venues: NewVenue[] = [];
  const venueIds = new Set<string>();
  let ticketmasterId: string | undefined;

  const tmEvents = data._embedded?.events || [];

  for (const event of tmEvents) {
    // Get the first attraction ID as ticketmaster artist ID
    if (!ticketmasterId && event._embedded?.attractions?.[0]) {
      ticketmasterId = event._embedded.attractions[0].id;
    }

    const venue = event._embedded?.venues?.[0];
    let venueId: string | undefined;

    if (venue) {
      venueId = `tm-${venue.id}`;

      if (!venueIds.has(venueId)) {
        venueIds.add(venueId);
        venues.push({
          id: venueId,
          name: venue.name,
          city: venue.city?.name || null,
          state: venue.state?.stateCode || null,
          country: venue.country?.countryCode || null,
          address: venue.address?.line1 || null,
          postalCode: venue.postalCode || null,
          latitude: venue.location?.latitude || null,
          longitude: venue.location?.longitude || null,
          timezone: venue.timezone || null,
          capacity: null,
          url: venue.url || null,
        });
      }
    }

    const eventDateTime = event.dates.start.dateTime ||
      (event.dates.start.localDate ?
        `${event.dates.start.localDate}T${event.dates.start.localTime || '20:00:00'}` :
        null);

    if (!eventDateTime) continue;

    const priceRange = event.priceRanges?.[0];

    events.push({
      id: `tm-${event.id}`,
      artistId: '', // Will be set by caller
      venueId: venueId || null,
      name: event.name,
      eventDate: new Date(eventDateTime),
      status: event.dates.status?.code || 'scheduled',
      ticketUrl: event.url || null,
      minPrice: priceRange?.min ? Math.round(priceRange.min) : null,
      maxPrice: priceRange?.max ? Math.round(priceRange.max) : null,
      currency: priceRange?.currency || 'USD',
      source: 'ticketmaster',
      externalId: event.id,
      metadata: null,
    });
  }

  return { events, venues, ticketmasterId };
}

export async function getArtistByName(artistName: string): Promise<{
  id: string;
  name: string;
  imageUrl?: string;
  genre?: string;
} | null> {
  if (!process.env.TICKETMASTER_API_KEY) {
    throw new Error('TICKETMASTER_API_KEY is not set');
  }

  const params = new URLSearchParams({
    apikey: process.env.TICKETMASTER_API_KEY,
    keyword: artistName,
    classificationName: 'music',
  });

  const response = await fetch(`${BASE_URL}/attractions.json?${params}`);

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const attraction = data._embedded?.attractions?.[0];

  if (!attraction) {
    return null;
  }

  return {
    id: attraction.id,
    name: attraction.name,
    imageUrl: attraction.images?.[0]?.url,
    genre: attraction.classifications?.[0]?.genre?.name,
  };
}
