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

// ---- Shared metadata-length helpers ----
// Search engines flag <title> over ~70 chars and meta descriptions outside
// ~25-160 chars. The root layout applies a "%s | TourWax" template, so every
// plain-string title returned here gets " | TourWax" (10 chars) appended.
const TITLE_SUFFIX = ' | TourWax';

// Keep the branded suffix only when the full string still fits 70 chars;
// otherwise return an absolute title (no suffix) to claw back those 10 chars.
// Returns a value suitable for Next's Metadata `title` field.
export function pageTitle(raw: string): string | { absolute: string } {
  return (raw + TITLE_SUFFIX).length <= 70 ? raw : { absolute: raw };
}

// Trim prose to a max length on a word boundary, appending an ellipsis. Used to
// keep meta descriptions within the ~160-char window without truncating the
// longer on-page copy generators may produce.
export function trimForMeta(text: string, max = 160): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

export function generateArtistTitle(artistName: string, eventCount: number, year: number = new Date().getFullYear()): string {
  if (eventCount > 0) {
    return `${artistName} Tour ${year}: Dates & Tickets`;
  }
  return `${artistName} Tour Dates & Concerts ${year}`;
}

export function generateArtistDescription(
  artistName: string,
  genre: string | null,
  eventCount: number,
  cities: string[],
  nextEventDate?: Date | null,
  lowestPrice?: number | null
): string {
  const year = new Date().getFullYear();
  const genreText = genre ? ` ${genre}` : '';

  if (eventCount === 0) {
    return `${artistName} ${year} tour dates & concerts coming soon. Check for upcoming${genreText} shows, ticket prices & schedule.`;
  }

  const nextDateText = nextEventDate
    ? `Next concert ${nextEventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. `
    : '';

  const priceText = lowestPrice ? ` Tickets from $${lowestPrice}.` : '';

  const cityText = cities.length > 0
    ? ` in ${cities.slice(0, 2).join(', ')}${cities.length > 2 ? ` & more` : ''}`
    : '';

  return `${nextDateText}${artistName} tour ${year}: ${eventCount}${genreText} concert${eventCount === 1 ? '' : 's'}${cityText}.${priceText} Compare ticket prices & buy tickets.`;
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
    images: [
      {
        url: params.image || `${SITE_URL}/og-default.jpg`,
        width: 1200,
        height: 630,
        alt: params.title,
      }
    ],
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
    card: params.card || 'summary_large_image',
    title: params.title,
    description: params.description,
    images: [params.image || `${SITE_URL}/og-default.jpg`],
  };
}

export function generateArtistMetadata(data: ArtistWithEvents) {
  const { artist, events } = data;
  const year = new Date().getFullYear();
  const cities = extractCitiesFromEvents(events);
  const nextEventDate = events.length > 0 ? new Date(events[0].event.eventDate) : null;

  const prices = events
    .map(e => e.event.minPrice)
    .filter((p): p is number => p !== null && p > 0);
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : null;

  const title = generateArtistTitle(artist.name, events.length, year);
  const description = trimForMeta(generateArtistDescription(
    artist.name,
    artist.genre,
    events.length,
    cities,
    nextEventDate,
    lowestPrice
  ));
  const url = generateCanonicalUrl(`/artists/${artist.slug}`);
  const image = artist.imageUrl || `${SITE_URL}/og-default.jpg`;

  return {
    title: pageTitle(title),
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

export function generateCityTitle(cityName: string, state: string | null, eventCount: number, year: number = new Date().getFullYear()): string {
  void eventCount; // no longer in the title; kept for call-site compatibility
  const location = state ? `${cityName}, ${state}` : cityName;
  return `Concerts in ${location} ${year}: Shows & Tickets`;
}

export function generateCityDescription(
  cityName: string,
  state: string | null,
  eventCount: number,
  artistNames: string[],
  venueNames?: string[],
  nextEventDate?: Date | null
): string {
  const year = new Date().getFullYear();
  const location = state ? `${cityName}, ${state}` : cityName;

  if (eventCount === 0) {
    return `Upcoming concerts in ${location} for ${year}. Check back for new shows, tour dates & ticket info.`;
  }

  const nextDateText = nextEventDate
    ? `Next show ${nextEventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. `
    : '';

  const topArtists = artistNames.slice(0, 3).join(', ');
  const moreText = artistNames.length > 3 ? ` + ${artistNames.length - 3} more` : '';
  const venueText = venueNames && venueNames.length > 0
    ? ` at ${venueNames.slice(0, 2).join(', ')}`
    : '';

  return `${nextDateText}${eventCount} upcoming concerts in ${location}: ${topArtists}${moreText}${venueText}. ${year} schedule & tickets.`;
}

export function generateCityMetadata(data: {
  cityName: string;
  state: string | null;
  citySlug: string;
  eventCount: number;
  artistNames: string[];
  venueNames?: string[];
  nextEventDate?: Date | null;
}) {
  const { cityName, state, citySlug, eventCount, artistNames, venueNames, nextEventDate } = data;
  const year = new Date().getFullYear();

  const title = generateCityTitle(cityName, state, eventCount, year);
  const description = trimForMeta(generateCityDescription(cityName, state, eventCount, artistNames, venueNames, nextEventDate));
  const url = generateCanonicalUrl(`/concerts/${citySlug}`);

  return {
    title: pageTitle(title),
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
  const title = `Upcoming Concerts ${new Date().getFullYear()} - Find Shows & Buy Tickets`;
  const description = `Browse upcoming concerts in ${new Date().getFullYear()} by city. Find tonight's shows, this weekend's events, and tours near you. Compare ticket prices on Ticketmaster & SeatGeek.`;
  const url = generateCanonicalUrl('/concerts');

  return {
    title: pageTitle(title),
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

export function generateGenreTitle(genreName: string, artistCount: number, year: number = new Date().getFullYear(), topArtistNames?: string[]): string {
  // Hip-Hop also captures "rap" queries
  const displayGenre = genreName === 'Hip-Hop' ? 'Hip-Hop & Rap' : genreName;
  if (topArtistNames && topArtistNames.length >= 2) {
    const featured = topArtistNames.slice(0, 2).join(', ');
    return `${displayGenre} Tours ${year}: ${featured} & More`;
  }
  return `${displayGenre} Tours ${year} - ${artistCount} Artists on Tour Now`;
}

export function generateGenreDescription(
  genreName: string,
  artistCount: number,
  eventCount: number,
  artistNames: string[]
): string {
  const year = new Date().getFullYear();
  const topArtists = artistNames.slice(0, 3).join(', ');
  const moreText = artistNames.length > 3 ? ` + ${artistCount - 3} more` : '';
  const eventText = eventCount > 0 ? ` ${eventCount} shows.` : '';
  return `${topArtists}${moreText} on tour in ${year}.${eventText} Browse ${genreName} tour dates & compare ticket prices.`;
}

export function generateGenreMetadata(data: {
  genreName: string;
  genreSlug: string;
  artistCount: number;
  eventCount: number;
  artistNames: string[];
}) {
  const { genreName, genreSlug, artistCount, eventCount, artistNames } = data;
  const year = new Date().getFullYear();

  const title = generateGenreTitle(genreName, artistCount, year, artistNames);
  const description = trimForMeta(generateGenreDescription(genreName, artistCount, eventCount, artistNames));
  const url = generateCanonicalUrl(`/tours/${genreSlug}`);

  return {
    title: pageTitle(title),
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
  const title = `Music Tours by Genre ${new Date().getFullYear()}`;
  const description = 'Browse upcoming music tours by genre. Find Hip-Hop, Pop, Rock, Country, R&B, and Electronic concert dates and tickets.';
  const url = generateCanonicalUrl('/tours');

  return {
    title: pageTitle(title),
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

export function generateVenueTitle(venueName: string, city: string | null, eventCount: number, year: number = new Date().getFullYear()): string {
  void city; // city is carried in the description; kept out of the title for length
  if (eventCount > 0) {
    return `${venueName} ${year} Concerts & Tickets`;
  }
  return `${venueName} Concert Schedule ${year}`;
}

export function generateVenueDescription(
  venueName: string,
  city: string | null,
  eventCount: number,
  artistNames: string[],
  nextEventDate?: Date | null
): string {
  const year = new Date().getFullYear();
  const location = city ? ` in ${city}` : '';

  if (eventCount === 0) {
    return `${venueName}${location} ${year} concert schedule & upcoming events. Check back for newly announced shows, tour dates & tickets.`;
  }

  const nextDateText = nextEventDate
    ? `Next event ${nextEventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. `
    : '';

  const topArtists = artistNames.slice(0, 3).join(', ');
  const moreText = artistNames.length > 3 ? ` + ${artistNames.length - 3} more` : '';

  return `${nextDateText}${eventCount} upcoming events at ${venueName}${location}: ${topArtists}${moreText}. See the full ${year} concert schedule, set times & buy tickets.`;
}

export function generateVenueMetadata(data: {
  venueName: string;
  venueSlug: string;
  city: string | null;
  state: string | null;
  eventCount: number;
  artistNames: string[];
  nextEventDate?: Date | null;
}) {
  const { venueName, venueSlug, city, state, eventCount, artistNames, nextEventDate } = data;
  const year = new Date().getFullYear();

  const title = generateVenueTitle(venueName, city, eventCount, year);
  const description = trimForMeta(generateVenueDescription(venueName, city, eventCount, artistNames, nextEventDate));
  const url = generateCanonicalUrl(`/venues/${venueSlug}`);

  return {
    title: pageTitle(title),
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
  const title = `Concert Venues ${new Date().getFullYear()} | Upcoming Shows by Venue`;
  const description = 'Browse concert venues with upcoming shows. Find live music events, tour dates, and tickets at venues near you.';
  const url = generateCanonicalUrl('/venues');

  return {
    title: pageTitle(title),
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
  const title = `Music Blog - Concert Tips & Tour News`;
  const description = 'Read the latest concert tips, tour news, and artist spotlights. Get insider advice on finding tickets, tracking tours, and making the most of live music.';
  const url = generateCanonicalUrl('/blog');

  return {
    title: pageTitle(title),
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
  metaTitle?: string;
  metaDescription?: string;
}) {
  // Visible H1/excerpt stay as authored; metadata uses tighter overrides.
  const title = post.metaTitle || post.title;
  const description = trimForMeta(post.metaDescription || post.excerpt);
  const url = generateCanonicalUrl(`/blog/${post.slug}`);
  const image = post.featuredImage || undefined;

  return {
    title: pageTitle(title),
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
  const title = `Live Music Insights & Data ${new Date().getFullYear()}`;
  const description = 'Data-driven insights about live music touring. Discover the most toured cities, busiest touring artists, and trends in the concert industry.';
  const url = generateCanonicalUrl('/insights');

  return {
    title: pageTitle(title),
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
  const title = data.title;
  const description = trimForMeta(data.description);
  const url = generateCanonicalUrl(`/insights/${data.slug}`);

  return {
    title: pageTitle(title),
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      ...generateOpenGraphTags({
        title,
        description,
        url,
        type: 'article',
      }),
    },
    twitter: generateTwitterCardTags({
      title,
      description,
    }),
  };
}

export function generateFestivalsIndexMetadata() {
  const title = `Music Festivals & Concert Events ${new Date().getFullYear()}`;
  const description = `Discover ${new Date().getFullYear()} music festivals, state fair concerts, and multi-artist events. Full lineups, schedules, tickets & venue details. Find festivals near you.`;
  const url = generateCanonicalUrl('/festivals');

  return {
    title: pageTitle(title),
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
  isPast?: boolean;
}) {
  const year = new Date().getFullYear();
  const location = data.city ? ` in ${data.city}` : '';
  const artistText = data.artistNames.length > 0
    ? ` ${data.artistNames.slice(0, 2).join(', ')}${data.artistNames.length > 2 ? ` + ${data.artistCount - 2} more` : ''}.`
    : '';

  const title = data.isPast
    ? `${data.festivalName}${location} | Lineup & Recap (Archived)`
    : `${data.festivalName}${location} ${year} | Lineup & Tickets`;

  const description = trimForMeta(data.isPast
    ? `${data.festivalName} took place ${data.date} at ${data.venueName}${location}.${artistText} See the full lineup and browse current tour dates.`
    : `${data.festivalName} ${year}:${artistText} ${data.date} at ${data.venueName}${location}. Full lineup & tickets.`);

  const url = generateCanonicalUrl(`/festivals/${data.slug}`);

  return {
    title: pageTitle(title),
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
  const title = `Concerts This Weekend ${new Date().getFullYear()} - Shows Near You`;
  const description = eventCount > 0
    ? `${eventCount} concerts happening this weekend. Find live shows, compare ticket prices & buy tickets for this weekend's events.`
    : `Find concerts happening this weekend. Browse upcoming live shows and buy tickets on ${SITE_NAME}.`;
  const url = generateCanonicalUrl('/concerts/this-weekend');

  return {
    title: pageTitle(title),
    description,
    alternates: { canonical: url },
    openGraph: generateOpenGraphTags({ title, description, url }),
    twitter: generateTwitterCardTags({ title, description }),
  };
}

export function generateTonightMetadata(eventCount: number) {
  const title = `Concerts Today & Tonight ${new Date().getFullYear()}: Live Shows Near You`;
  const description = eventCount > 0
    ? `${eventCount} concerts happening today and tonight. Find last-minute tickets, today's shows, and live music near you.`
    : `Find concerts happening today and tonight. Browse live shows and buy last-minute tickets on ${SITE_NAME}.`;
  const url = generateCanonicalUrl('/concerts/tonight');

  return {
    title: pageTitle(title),
    description,
    alternates: { canonical: url },
    openGraph: generateOpenGraphTags({ title, description, url }),
    twitter: generateTwitterCardTags({ title, description }),
  };
}

export function generateThisWeekMetadata(eventCount: number) {
  const title = `Concerts This Week ${new Date().getFullYear()} - Upcoming Shows`;
  const description = eventCount > 0
    ? `${eventCount} concerts happening this week. Browse shows, compare ticket prices & buy tickets.`
    : `Find concerts happening this week. Browse upcoming live shows and buy tickets on ${SITE_NAME}.`;
  const url = generateCanonicalUrl('/concerts/this-week');

  return {
    title: pageTitle(title),
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
  const title = `Concerts in ${data.stateName} ${year} - Shows & Tickets`;
  const artistText = data.artistNames.length > 0
    ? ` See ${data.artistNames.slice(0, 3).join(', ')}${data.artistNames.length > 3 ? ' & more' : ''}.`
    : '';
  const description = trimForMeta(data.eventCount > 0
    ? `${data.eventCount} upcoming concert${data.eventCount === 1 ? '' : 's'} across ${data.cityCount} cities in ${data.stateName}.${artistText} Browse shows & buy tickets.`
    : `Find upcoming concerts in ${data.stateName} for ${year}. Browse shows by city and buy tickets.`);
  const url = generateCanonicalUrl(`/concerts/state/${data.stateSlug}`);

  return {
    title: pageTitle(title),
    description,
    alternates: { canonical: url },
    openGraph: generateOpenGraphTags({ title, description, url }),
    twitter: generateTwitterCardTags({ title, description }),
  };
}

export function generateOnSaleMetadata(eventCount: number) {
  const year = new Date().getFullYear();
  const title = `Tickets On Sale Today ${year} - New Concert Tickets`;
  const description = eventCount > 0
    ? `${eventCount} concert${eventCount === 1 ? '' : 's'} with tickets going on sale today. Be first to get tickets before they sell out.`
    : `Find concerts with tickets going on sale today. Get early access to the best seats on ${SITE_NAME}.`;
  const url = generateCanonicalUrl('/concerts/on-sale-today');

  return {
    title: pageTitle(title),
    description,
    alternates: { canonical: url },
    openGraph: generateOpenGraphTags({ title, description, url }),
    twitter: generateTwitterCardTags({ title, description }),
  };
}

export function generateTourHistoryMetadata(data: {
  artistName: string;
  slug: string;
  totalShows: number;
  cityCount: number;
  years: number[];
  imageUrl: string | null;
}) {
  const { artistName, slug, totalShows, cityCount, years, imageUrl } = data;
  const yearRange = years.length > 1
    ? `${years[years.length - 1]}-${years[0]}`
    : years.length === 1 ? `${years[0]}` : '';

  const title = totalShows > 0
    ? `${artistName} Tour History - ${totalShows} Shows${yearRange ? ` (${yearRange})` : ''}`
    : `${artistName} Tour History`;

  const description = trimForMeta(totalShows > 0
    ? `${artistName} has played ${totalShows} shows across ${cityCount} cities${yearRange ? ` from ${yearRange}` : ''}. Browse the complete concert archive with venues, dates, and cities visited.`
    : `${artistName} tour history and past concert archive. Check back as tour dates are added regularly.`);

  const url = generateCanonicalUrl(`/artists/${slug}/tour-history`);
  const image = imageUrl || undefined;

  return {
    title: pageTitle(title),
    description,
    alternates: { canonical: url },
    openGraph: generateOpenGraphTags({ title, description, url, image }),
    twitter: generateTwitterCardTags({ title, description, image }),
  };
}

export function generateEventPageMetadata(data: {
  artistName: string;
  artistSlug: string;
  venueName: string | null;
  city: string | null;
  state: string | null;
  eventDate: Date;
  slug: string;
  isPast: boolean;
  imageUrl: string | null;
  minPrice: number | null;
}) {
  const { artistName, venueName, city, state, eventDate, slug, isPast, imageUrl, minPrice } = data;
  const year = eventDate.getFullYear();
  const dateStr = eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const location = [city, state].filter(Boolean).join(', ');
  const venueText = venueName ? ` at ${venueName}` : '';
  const locationText = location ? ` in ${location}` : '';

  const title = isPast
    ? `${artistName}${venueText}${locationText} — ${dateStr}`
    : `${artistName} Tickets${venueText} ${dateStr}`;

  const priceText = minPrice ? ` Tickets from $${minPrice}.` : '';
  const description = trimForMeta(isPast
    ? `${artistName} performed${venueText}${locationText} on ${dateStr}. Browse the full ${artistName} tour history and upcoming concert dates.`
    : `Buy ${artistName} tickets for ${dateStr}${venueText}${locationText}.${priceText} Compare prices from Ticketmaster & SeatGeek.`);

  const url = generateCanonicalUrl(`/events/${slug}`);
  const image = imageUrl || undefined;

  return {
    title: pageTitle(title),
    description,
    alternates: { canonical: url },
    openGraph: generateOpenGraphTags({ title, description, url, image }),
    twitter: generateTwitterCardTags({ title, description, image }),
  };
}

export function generateNearMeMetadata(cityName?: string | null) {
  const year = new Date().getFullYear();
  const locationLabel = cityName ? ` in ${cityName}` : ' Near Me';
  const title = `Concerts${locationLabel} ${year}: Live Shows Near You`;
  const description = cityName
    ? `Find concerts and live music near ${cityName}. Browse upcoming shows, last-minute tickets, and tour dates near you on ${SITE_NAME}.`
    : `Find concerts and live music near you. Browse upcoming shows, last-minute tickets, and tour dates near your location on ${SITE_NAME}.`;
  const url = generateCanonicalUrl('/concerts/near-me');

  return {
    title: pageTitle(title),
    description,
    alternates: { canonical: url },
    openGraph: generateOpenGraphTags({ title, description, url }),
    twitter: generateTwitterCardTags({ title, description }),
  };
}

export function generateSearchMetadata(query: string | null) {
  const title = query
    ? `Search Results for "${query}"`
    : `Search Artists, Concerts & Venues`;
  const description = query
    ? `Search results for "${query}" on ${SITE_NAME}. Find tour dates, concerts, and tickets.`
    : `Search for artists, concerts, and venues on ${SITE_NAME}. Find tour dates and buy tickets.`;
  const url = generateCanonicalUrl('/search');

  return {
    title: pageTitle(title),
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
