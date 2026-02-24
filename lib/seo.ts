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
  const year = new Date().getFullYear();
  const genreText = genre ? ` ${genre}` : '';
  const eventsText = eventCount === 0
    ? `Check back for upcoming${genreText} tour dates and concert information.`
    : eventCount === 1
    ? `1 upcoming show${cities.length > 0 ? ` in ${cities[0]}` : ''}.`
    : `${eventCount} upcoming shows${cities.length > 0 ? ` in ${cities.slice(0, 3).join(', ')}${cities.length > 3 ? ' and more' : ''}` : ''}.`;

  return `Find ${artistName} ${year} tour dates, concert tickets, and venue information. ${eventsText} Compare ticket prices, get${genreText} music news, and never miss a show.`;
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

export function generateCityTitle(cityName: string, state: string | null, year: number = new Date().getFullYear()): string {
  const location = state ? `${cityName}, ${state}` : cityName;
  return `Concerts in ${location} ${year} | Upcoming Shows & Tickets - ${SITE_NAME}`;
}

export function generateCityDescription(
  cityName: string,
  state: string | null,
  eventCount: number,
  artistNames: string[]
): string {
  const location = state ? `${cityName}, ${state}` : cityName;
  const artistText = artistNames.length > 0
    ? ` See shows from ${artistNames.slice(0, 3).join(', ')}${artistNames.length > 3 ? ', and more' : ''}.`
    : '';
  const countText = eventCount === 0
    ? `Check back for upcoming concerts in ${location}.`
    : `Find ${eventCount} upcoming concert${eventCount === 1 ? '' : 's'} in ${location}.${artistText}`;

  return `${countText} Get tickets and venue info.`;
}

export function generateCityMetadata(data: {
  cityName: string;
  state: string | null;
  citySlug: string;
  eventCount: number;
  artistNames: string[];
}) {
  const { cityName, state, citySlug, eventCount, artistNames } = data;
  const year = new Date().getFullYear();

  const title = generateCityTitle(cityName, state, year);
  const description = generateCityDescription(cityName, state, eventCount, artistNames);
  const url = generateCanonicalUrl(`/concerts/${citySlug}`);

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
    }),
    twitter: generateTwitterCardTags({
      title,
      description,
    }),
  };
}

export function generateConcertsIndexMetadata() {
  const title = `Upcoming Concerts & Live Shows ${new Date().getFullYear()} - ${SITE_NAME}`;
  const description = 'Browse upcoming concerts by city. Find live music events, tour dates, and tickets for shows near you.';
  const url = generateCanonicalUrl('/concerts');

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
    }),
    twitter: generateTwitterCardTags({
      title,
      description,
    }),
  };
}

export function generateGenreTitle(genreName: string, year: number = new Date().getFullYear()): string {
  return `${genreName} Tours & Concerts ${year} | Live Show Dates - ${SITE_NAME}`;
}

export function generateGenreDescription(
  genreName: string,
  artistCount: number,
  artistNames: string[]
): string {
  const artistText = artistNames.length > 0
    ? ` See shows from ${artistNames.slice(0, 3).join(', ')}${artistNames.length > 3 ? ', and more' : ''}.`
    : '';
  return `Browse ${artistCount} ${genreName} artist${artistCount === 1 ? '' : 's'} on tour with upcoming concerts and tickets.${artistText}`;
}

export function generateGenreMetadata(data: {
  genreName: string;
  genreSlug: string;
  artistCount: number;
  artistNames: string[];
}) {
  const { genreName, genreSlug, artistCount, artistNames } = data;
  const year = new Date().getFullYear();

  const title = generateGenreTitle(genreName, year);
  const description = generateGenreDescription(genreName, artistCount, artistNames);
  const url = generateCanonicalUrl(`/tours/${genreSlug}`);

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
    }),
    twitter: generateTwitterCardTags({
      title,
      description,
    }),
  };
}

export function generateToursIndexMetadata() {
  const title = `Music Tours by Genre ${new Date().getFullYear()} - ${SITE_NAME}`;
  const description = 'Browse upcoming music tours by genre. Find Hip-Hop, Pop, Rock, Country, R&B, and Electronic concert dates and tickets.';
  const url = generateCanonicalUrl('/tours');

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
    }),
    twitter: generateTwitterCardTags({
      title,
      description,
    }),
  };
}

export function generateVenueTitle(venueName: string, city: string | null, year: number = new Date().getFullYear()): string {
  const location = city ? ` in ${city}` : '';
  return `${venueName} Concerts ${year} | Upcoming Shows${location} - ${SITE_NAME}`;
}

export function generateVenueDescription(
  venueName: string,
  city: string | null,
  eventCount: number,
  artistNames: string[]
): string {
  const location = city ? ` in ${city}` : '';
  const artistText = artistNames.length > 0
    ? ` See ${artistNames.slice(0, 3).join(', ')}${artistNames.length > 3 ? ', and more' : ''}.`
    : '';
  const countText = eventCount === 0
    ? `Check back for upcoming concerts at ${venueName}${location}.`
    : `Find ${eventCount} upcoming concert${eventCount === 1 ? '' : 's'} at ${venueName}${location}.${artistText}`;

  return `${countText} Get tickets and show info.`;
}

export function generateVenueMetadata(data: {
  venueName: string;
  venueSlug: string;
  city: string | null;
  state: string | null;
  eventCount: number;
  artistNames: string[];
}) {
  const { venueName, venueSlug, city, state, eventCount, artistNames } = data;
  const year = new Date().getFullYear();

  const title = generateVenueTitle(venueName, city, year);
  const description = generateVenueDescription(venueName, city, eventCount, artistNames);
  const url = generateCanonicalUrl(`/venues/${venueSlug}`);

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
    }),
    twitter: generateTwitterCardTags({
      title,
      description,
    }),
  };
}

export function generateVenuesIndexMetadata() {
  const title = `Concert Venues ${new Date().getFullYear()} | Upcoming Shows by Venue - ${SITE_NAME}`;
  const description = 'Browse concert venues with upcoming shows. Find live music events, tour dates, and tickets at venues near you.';
  const url = generateCanonicalUrl('/venues');

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
    }),
    twitter: generateTwitterCardTags({
      title,
      description,
    }),
  };
}

export function generateBlogIndexMetadata() {
  const title = `Music Blog - Concert Tips, Tour News & Artist Spotlights | ${SITE_NAME}`;
  const description = 'Read the latest concert tips, tour news, and artist spotlights. Get insider advice on finding tickets, tracking tours, and making the most of live music.';
  const url = generateCanonicalUrl('/blog');

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
    }),
    twitter: generateTwitterCardTags({
      title,
      description,
    }),
  };
}

export function generateBlogPostMetadata(post: {
  title: string;
  excerpt: string;
  slug: string;
  featuredImage: string | null;
  publishedAt: string;
  updatedAt: string;
  author: string;
}) {
  const title = `${post.title} | ${SITE_NAME}`;
  const description = post.excerpt;
  const url = generateCanonicalUrl(`/blog/${post.slug}`);
  const image = post.featuredImage || undefined;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      ...generateOpenGraphTags({
        title,
        description,
        url,
        image,
        type: 'article',
      }),
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
    },
    twitter: generateTwitterCardTags({
      title,
      description,
      image,
    }),
  };
}

export function generateInsightsIndexMetadata() {
  const title = `Live Music Insights & Data ${new Date().getFullYear()} - ${SITE_NAME}`;
  const description = 'Data-driven insights about live music touring. Discover the most toured cities, busiest touring artists, and trends in the concert industry.';
  const url = generateCanonicalUrl('/insights');

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
    }),
    twitter: generateTwitterCardTags({
      title,
      description,
    }),
  };
}

export function generateInsightMetadata(data: {
  title: string;
  description: string;
  slug: string;
}) {
  const title = `${data.title} | ${SITE_NAME}`;
  const url = generateCanonicalUrl(`/insights/${data.slug}`);

  return {
    title,
    description: data.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      ...generateOpenGraphTags({
        title,
        description: data.description,
        url,
        type: 'article',
      }),
    },
    twitter: generateTwitterCardTags({
      title,
      description: data.description,
    }),
  };
}

export function generateFestivalsIndexMetadata() {
  const title = `Music Festivals & Multi-Artist Events ${new Date().getFullYear()} - ${SITE_NAME}`;
  const description = 'Discover music festivals and multi-artist events with full lineups, ticket info, and venue details. Find festivals near you.';
  const url = generateCanonicalUrl('/festivals');

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
    }),
    twitter: generateTwitterCardTags({
      title,
      description,
    }),
  };
}

export function generateFestivalMetadata(data: {
  festivalName: string;
  slug: string;
  venueName: string;
  city: string | null;
  date: string;
  artistCount: number;
  artistNames: string[];
}) {
  const year = new Date().getFullYear();
  const location = data.city ? ` in ${data.city}` : '';
  const title = `${data.festivalName}${location} ${year} | Lineup & Tickets - ${SITE_NAME}`;
  const artistText = data.artistNames.length > 0
    ? ` See ${data.artistNames.slice(0, 3).join(', ')}${data.artistNames.length > 3 ? ', and more' : ''}.`
    : '';
  const description = `${data.festivalName} at ${data.venueName}${location} on ${data.date}. ${data.artistCount} artists performing.${artistText} Get tickets and lineup info.`;
  const url = generateCanonicalUrl(`/festivals/${data.slug}`);

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
    }),
    twitter: generateTwitterCardTags({
      title,
      description,
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
