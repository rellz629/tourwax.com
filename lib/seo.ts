import type { Artist, Event, Venue } from '@/db/schema';

export const SITE_NAME = 'TourWax';
export const SITE_URL = 'https://www.tourwax.com';
export const SITE_DESCRIPTION = 'Discover upcoming concert tour dates, venues, and latest news for your favorite music artists.';

interface ArtistWithEvents {
  artist: Artist;
  events: Array<{ event: Event; venue: Venue | null }>;
}

export function generateCanonicalUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${cleanPath}`;
}

export function generateArtistTitle(artistName: string, year: number = new Date().getFullYear()): string {
  return `${artistName} Tour Dates ${year} | Concerts & Tickets - ${SITE_NAME}`;
}

export function generateArtistDescription(
  artistName: string,
  genre: string | null,
  eventCount: number,
  cities: string[]
): string {
  const genreText = genre ? ` ${genre}` : '';
  const eventsText = eventCount === 0
    ? `Check back for upcoming${genreText} tour dates and concert information.`
    : eventCount === 1
    ? `1 upcoming show${cities.length > 0 ? ` in ${cities[0]}` : ''}.`
    : `${eventCount} upcoming shows${cities.length > 0 ? ` in ${cities.slice(0, 3).join(', ')}${cities.length > 3 ? ' and more' : ''}` : ''}.`;

  return `Find ${artistName} tour dates, concert tickets, and venue information. ${eventsText} Latest${genreText} music news and tour updates.`;
}

export function extractCitiesFromEvents(events: Array<{ event: Event; venue: Venue | null }>): string[] {
  const cities = new Set<string>();

  events.forEach(({ venue }) => {
    if (venue?.city && venue?.state) {
      cities.add(`${venue.city}, ${venue.state}`);
    } else if (venue?.city) {
      cities.add(venue.city);
    }
  });

  return Array.from(cities);
}

export interface OpenGraphParams {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: 'website' | 'article' | 'profile';
  siteName?: string;
}

export function generateOpenGraphTags(params: OpenGraphParams) {
  return {
    title: params.title,
    description: params.description,
    url: params.url,
    siteName: params.siteName || SITE_NAME,
    type: params.type || 'website',
    images: params.image ? [
      {
        url: params.image,
        width: 1200,
        height: 630,
        alt: params.title,
      }
    ] : [],
  };
}

export interface TwitterCardParams {
  title: string;
  description: string;
  image?: string;
  card?: 'summary' | 'summary_large_image';
}

export function generateTwitterCardTags(params: TwitterCardParams) {
  return {
    card: params.card || (params.image ? 'summary_large_image' : 'summary'),
    title: params.title,
    description: params.description,
    images: params.image ? [params.image] : [],
  };
}

export function generateArtistMetadata(data: ArtistWithEvents) {
  const { artist, events } = data;
  const year = new Date().getFullYear();
  const cities = extractCitiesFromEvents(events);

  const title = generateArtistTitle(artist.name, year);
  const description = generateArtistDescription(
    artist.name,
    artist.genre,
    events.length,
    cities
  );
  const url = generateCanonicalUrl(`/artists/${artist.slug}`);
  const image = artist.imageUrl || `${SITE_URL}/og-default.jpg`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: generateOpenGraphTags({
      title,
      description,
      url,
      image,
      type: 'profile',
    }),
    twitter: generateTwitterCardTags({
      title,
      description,
      image,
    }),
  };
}

export function generateDefaultMetadata() {
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${SITE_NAME} - Live Music Tour Dates & News`,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: [
      'concert tour dates',
      'live music',
      'tour tickets',
      'concert venues',
      'music news',
      'tour announcements',
      'upcoming concerts',
      'artist tour dates',
    ],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: SITE_URL,
      siteName: SITE_NAME,
      title: `${SITE_NAME} - Live Music Tour Dates & News`,
      description: SITE_DESCRIPTION,
      images: [
        {
          url: `${SITE_URL}/og-default.jpg`,
          width: 1200,
          height: 630,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} - Live Music Tour Dates & News`,
      description: SITE_DESCRIPTION,
      images: [`${SITE_URL}/og-default.jpg`],
    },
    icons: {
      icon: '/icon.svg',
      shortcut: '/icon.svg',
      apple: '/icon.svg',
    },
    manifest: '/site.webmanifest',
  };
}

export function generateDefaultViewport() {
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    themeColor: '#f97316',
  };
}
