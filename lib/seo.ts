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
  return `${artistName} Tour Dates & Concert Schedule ${year} - ${SITE_NAME}`;
}

export function generateArtistDescription(
  artistName: string,
  genre: string | null,
  eventCount: number,
  cities: string[]
): string {
  const year = new Date().getFullYear();
  const genreText = genre ? ` ${genre}` : '';

  if (eventCount === 0) {
    return `${artistName} ${year} tour dates coming soon. Get notified about upcoming${genreText} concerts, ticket prices, and venue info on ${SITE_NAME}.`;
  }

  const cityText = cities.length > 0
    ? ` in ${cities.slice(0, 3).join(', ')}${cities.length > 3 ? ' & more cities' : ''}`
    : '';

  return `${artistName} has ${eventCount} upcoming concert${eventCount === 1 ? '' : 's'}${cityText}. Browse the full ${year}${genreText} tour schedule, compare ticket prices, and buy tickets.`;
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
  return `Concerts in ${location} ${year} - Upcoming Shows & Tickets | ${SITE_NAME}`;
}

export function generateCityDescription(
  cityName: string,
  state: string | null,
  eventCount: number,
  artistNames: string[]
): string {
  const year = new Date().getFullYear();
  const location = state ? `${cityName}, ${state}` : cityName;

  if (eventCount === 0) {
    return `No concerts currently scheduled in ${location}. Check back for upcoming ${year} shows and ticket info.`;
  }

  const artistText = artistNames.length > 0
    ? ` See ${artistNames.slice(0, 3).join(', ')}${artistNames.length > 3 ? ' & more' : ''}.`
    : '';

  return `${eventCount} upcoming concert${eventCount === 1 ? '' : 's'} in ${location} for ${year}.${artistText} Browse shows, compare ticket prices & buy tickets.`;
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
  const title = `Concerts Near You ${new Date().getFullYear()} - Find Shows & Buy Tickets | ${SITE_NAME}`;
  const description = `Browse upcoming concerts in ${new Date().getFullYear()} by city. Find live music events, tour dates, venues, and tickets for shows near you.`;
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
  return `${genreName} Concerts & Tour Dates ${year} - Buy Tickets | ${SITE_NAME}`;
}

export function generateGenreDescription(
  genreName: string,
  artistCount: number,
  artistNames: string[]
): string {
  const year = new Date().getFullYear();
  const artistText = artistNames.length > 0
    ? ` See ${artistNames.slice(0, 3).join(', ')}${artistNames.length > 3 ? ' & more' : ''}.`
    : '';
  return `${artistCount} ${genreName} artist${artistCount === 1 ? '' : 's'} on tour in ${year}.${artistText} Browse concert schedules, compare ticket prices & buy tickets.`;
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
  return `${venueName} Concert Schedule ${year}${location} - Tickets | ${SITE_NAME}`;
}

export function generateVenueDescription(
  venueName: string,
  city: string | null,
  eventCount: number,
  artistNames: string[]
): string {
  const year = new Date().getFullYear();
  const location = city ? ` in ${city}` : '';

  if (eventCount === 0) {
    return `No concerts currently scheduled at ${venueName}${location}. Check back for upcoming ${year} shows.`;
  }

  const artistText = artistNames.length > 0
    ? ` See ${artistNames.slice(0, 3).join(', ')}${artistNames.length > 3 ? ' & more' : ''}.`
    : '';

  return `${eventCount} upcoming concert${eventCount === 1 ? '' : 's'} at ${venueName}${location} in ${year}.${artistText} Compare ticket prices & buy tickets.`;
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

export function generateThisWeekendMetadata(eventCount: number) {
  const title = `Concerts This Weekend ${new Date().getFullYear()} - Shows Near You | ${SITE_NAME}`;
  const description = eventCount > 0
    ? `${eventCount} concerts happening this weekend. Find live shows, compare ticket prices & buy tickets for this weekend's events.`
    : `Find concerts happening this weekend. Browse upcoming live shows and buy tickets on ${SITE_NAME}.`;
  const url = generateCanonicalUrl('/concerts/this-weekend');

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: generateOpenGraphTags({ title, description, url }),
    twitter: generateTwitterCardTags({ title, description }),
  };
}

export function generateTonightMetadata(eventCount: number) {
  const title = `Concerts Tonight ${new Date().getFullYear()} - Live Shows Near You | ${SITE_NAME}`;
  const description = eventCount > 0
    ? `${eventCount} concerts happening tonight. Find last-minute tickets and live shows near you.`
    : `Find concerts happening tonight. Browse live shows and buy last-minute tickets on ${SITE_NAME}.`;
  const url = generateCanonicalUrl('/concerts/tonight');

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: generateOpenGraphTags({ title, description, url }),
    twitter: generateTwitterCardTags({ title, description }),
  };
}

export function generateThisWeekMetadata(eventCount: number) {
  const title = `Concerts This Week ${new Date().getFullYear()} - Upcoming Shows | ${SITE_NAME}`;
  const description = eventCount > 0
    ? `${eventCount} concerts happening this week. Browse shows, compare ticket prices & buy tickets.`
    : `Find concerts happening this week. Browse upcoming live shows and buy tickets on ${SITE_NAME}.`;
  const url = generateCanonicalUrl('/concerts/this-week');

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: generateOpenGraphTags({ title, description, url }),
    twitter: generateTwitterCardTags({ title, description }),
  };
}

export function generateStateMetadata(data: {
  stateName: string;
  stateSlug: string;
  eventCount: number;
  cityCount: number;
  artistNames: string[];
}) {
  const year = new Date().getFullYear();
  const title = `Concerts in ${data.stateName} ${year} - Shows & Tickets | ${SITE_NAME}`;
  const artistText = data.artistNames.length > 0
    ? ` See ${data.artistNames.slice(0, 3).join(', ')}${data.artistNames.length > 3 ? ' & more' : ''}.`
    : '';
  const description = data.eventCount > 0
    ? `${data.eventCount} upcoming concert${data.eventCount === 1 ? '' : 's'} across ${data.cityCount} cities in ${data.stateName}.${artistText} Browse shows & buy tickets.`
    : `Find upcoming concerts in ${data.stateName} for ${year}. Browse shows by city and buy tickets.`;
  const url = generateCanonicalUrl(`/concerts/state/${data.stateSlug}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: generateOpenGraphTags({ title, description, url }),
    twitter: generateTwitterCardTags({ title, description }),
  };
}

export function generateSearchMetadata(query: string | null) {
  const title = query
    ? `Search Results for "${query}" | ${SITE_NAME}`
    : `Search Artists, Concerts & Venues | ${SITE_NAME}`;
  const description = query
    ? `Search results for "${query}" on ${SITE_NAME}. Find tour dates, concerts, and tickets.`
    : `Search for artists, concerts, and venues on ${SITE_NAME}. Find tour dates and buy tickets.`;
  const url = generateCanonicalUrl('/search');

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: generateOpenGraphTags({ title, description, url }),
    twitter: generateTwitterCardTags({ title, description }),
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
