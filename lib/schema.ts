import type { Artist, Event, Venue, NewsArticle } from '@/db/schema';
import { SITE_NAME, SITE_URL } from './seo';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function generatePersonSchema(artist: Artist) {
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': artist.genre ? 'MusicGroup' : 'Person',
    name: artist.name,
    url: `${SITE_URL}/artists/${artist.slug}`,
  };

  if (artist.imageUrl) {
    schema.image = artist.imageUrl;
  }

  if (artist.bio) {
    schema.description = artist.bio;
  }

  if (artist.genre) {
    schema.genre = artist.genre;
  }

  // Add sameAs links to external profiles
  const sameAs: string[] = [];
  if (artist.spotifyId) {
    sameAs.push(`https://open.spotify.com/artist/${artist.spotifyId}`);
  }
  if (artist.ticketmasterId) {
    sameAs.push(`https://www.ticketmaster.com/artist/${artist.ticketmasterId}`);
  }
  if (sameAs.length > 0) {
    schema.sameAs = sameAs;
  }

  return schema;
}

export function generateMusicEventSchema(
  event: Event,
  artist: Artist,
  venue: Venue | null
) {
  // Build description from available data
  const eventDate = new Date(event.eventDate);
  const dateStr = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const venueLabel = venue
    ? `${venue.name}${venue.city ? ` in ${venue.city}` : ''}${venue.state ? `, ${venue.state}` : ''}`
    : null;
  const description = venueLabel
    ? `${artist.name} live at ${venueLabel} on ${dateStr}.`
    : `${artist.name} live on ${dateStr}.`;

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: event.name,
    description,
    startDate: eventDate.toISOString(),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    performer: {
      '@type': artist.genre ? 'MusicGroup' : 'Person',
      name: artist.name,
      url: `${SITE_URL}/artists/${artist.slug}`,
    },
  };

  // Add image — fall back to site default so Google always has one
  schema.image = artist.imageUrl || `${SITE_URL}/og-default.jpg`;

  // Location (required by Google) — always provide a Place
  if (venue) {
    const location: Record<string, any> = {
      '@type': 'Place',
      name: venue.name,
    };

    const addressParts: Record<string, any> = {
      '@type': 'PostalAddress',
    };

    if (venue.address) addressParts.streetAddress = venue.address;
    if (venue.city) addressParts.addressLocality = venue.city;
    if (venue.state) addressParts.addressRegion = venue.state;
    if (venue.postalCode) addressParts.postalCode = venue.postalCode;
    if (venue.country) addressParts.addressCountry = venue.country;

    if (Object.keys(addressParts).length > 1) {
      location.address = addressParts;
    }

    if (venue.latitude && venue.longitude) {
      location.geo = {
        '@type': 'GeoCoordinates',
        latitude: venue.latitude,
        longitude: venue.longitude,
      };
    }

    schema.location = location;
  } else {
    schema.location = {
      '@type': 'Place',
      name: 'Venue TBA',
    };
  }

  // Organizer — use venue when available, otherwise TourWax
  if (venue) {
    schema.organizer = {
      '@type': 'Organization',
      name: venue.name,
      ...(venue.url ? { url: venue.url } : {}),
    };
  } else {
    schema.organizer = {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    };
  }

  // URL for this event's detail page
  schema.url = `${SITE_URL}/artists/${artist.slug}`;

  // Offers — always include so Google gets price/currency/validFrom
  const offer: Record<string, any> = {
    '@type': 'Offer',
    url: event.ticketUrl || `${SITE_URL}/artists/${artist.slug}`,
    availability: 'https://schema.org/InStock',
    priceCurrency: event.currency || 'USD',
    validFrom: new Date(event.createdAt).toISOString(),
  };

  if (event.minPrice && event.maxPrice && event.minPrice !== event.maxPrice) {
    offer.lowPrice = event.minPrice;
    offer.highPrice = event.maxPrice;
    offer.price = event.minPrice;
  } else if (event.minPrice) {
    offer.price = event.minPrice;
  }

  schema.offers = [offer];

  return schema;
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateNewsArticleSchema(article: NewsArticle) {
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    url: article.url,
    datePublished: new Date(article.publishedAt).toISOString(),
  };

  if (article.summary) {
    schema.description = article.summary;
  }

  if (article.imageUrl) {
    schema.image = article.imageUrl;
  }

  if (article.author) {
    schema.author = {
      '@type': 'Person',
      name: article.author,
    };
  }

  if (article.source) {
    schema.publisher = {
      '@type': 'Organization',
      name: article.source,
    };
  }

  return schema;
}

export function generateCityEventListSchema(
  cityName: string,
  state: string | null,
  citySlug: string,
  eventData: Array<{ event: Event; artist: { name: string; slug: string; imageUrl: string | null }; venue: Venue | null }>
) {
  const locationLabel = state ? `${cityName}, ${state}` : cityName;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Upcoming Concerts in ${locationLabel}`,
    url: `${SITE_URL}/concerts/${citySlug}`,
    numberOfItems: eventData.length,
    itemListElement: eventData.map(({ event, artist, venue }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: generateMusicEventSchema(
        event,
        { name: artist.name, slug: artist.slug, imageUrl: artist.imageUrl, genre: null } as Artist,
        venue
      ),
    })),
  };
}

export function generateGenreEventListSchema(
  genreName: string,
  genreSlug: string,
  eventData: Array<{ event: Event; artist: { name: string; slug: string; imageUrl: string | null }; venue: Venue | null }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Upcoming ${genreName} Tours & Concerts`,
    url: `${SITE_URL}/tours/${genreSlug}`,
    numberOfItems: eventData.length,
    itemListElement: eventData.map(({ event, artist, venue }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: generateMusicEventSchema(
        event,
        { name: artist.name, slug: artist.slug, imageUrl: artist.imageUrl, genre: genreName } as Artist,
        venue
      ),
    })),
  };
}

export function generateVenueSchema(venue: Venue) {
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: venue.name,
  };

  if (venue.url) {
    schema.url = venue.url;
  }

  const addressParts: Record<string, any> = {
    '@type': 'PostalAddress',
  };
  if (venue.address) addressParts.streetAddress = venue.address;
  if (venue.city) addressParts.addressLocality = venue.city;
  if (venue.state) addressParts.addressRegion = venue.state;
  if (venue.postalCode) addressParts.postalCode = venue.postalCode;
  if (venue.country) addressParts.addressCountry = venue.country;

  if (Object.keys(addressParts).length > 1) {
    schema.address = addressParts;
  }

  if (venue.latitude && venue.longitude) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: venue.latitude,
      longitude: venue.longitude,
    };
  }

  if (venue.capacity) {
    schema.maximumAttendeeCapacity = venue.capacity;
  }

  return schema;
}

export function generateVenueEventListSchema(
  venue: Venue,
  venueSlug: string,
  eventData: Array<{ event: Event; artist: { name: string; slug: string; imageUrl: string | null }; venue: Venue | null }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Upcoming Concerts at ${venue.name}`,
    url: `${SITE_URL}/venues/${venueSlug}`,
    numberOfItems: eventData.length,
    itemListElement: eventData.map(({ event, artist, venue: v }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: generateMusicEventSchema(
        event,
        { name: artist.name, slug: artist.slug, imageUrl: artist.imageUrl, genre: null } as Artist,
        v
      ),
    })),
  };
}

export function generateBlogPostingSchema(post: {
  title: string;
  excerpt: string;
  slug: string;
  author: string;
  featuredImage: string | null;
  publishedAt: string;
  updatedAt: string;
}) {
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: new Date(post.publishedAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    author: {
      '@type': 'Person',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/blog/${post.slug}`,
    },
  };

  if (post.featuredImage) {
    schema.image = post.featuredImage;
  }

  return schema;
}

export function generateArticleSchema(article: {
  headline: string;
  description: string;
  slug: string;
  dateModified: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.headline,
    description: article.description,
    dateModified: article.dateModified,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/insights/${article.slug}`,
    },
  };
}

export function generateFestivalEventSchema(festival: {
  name: string;
  date: string;
  venue: Venue;
  artists: Array<{ name: string; slug: string; imageUrl: string | null; genre: string | null }>;
  events: Array<{ ticketUrl: string | null; minPrice: number | null; maxPrice: number | null; currency: string | null; source: string }>;
}) {
  const eventDate = new Date(festival.date);

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: festival.name,
    startDate: eventDate.toISOString(),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: `${SITE_URL}/og-default.jpg`,
    performer: festival.artists.map((a) => ({
      '@type': a.genre ? 'MusicGroup' : 'Person',
      name: a.name,
      url: `${SITE_URL}/artists/${a.slug}`,
    })),
  };

  // Location
  const location: Record<string, any> = {
    '@type': 'Place',
    name: festival.venue.name,
  };

  const addressParts: Record<string, any> = { '@type': 'PostalAddress' };
  if (festival.venue.city) addressParts.addressLocality = festival.venue.city;
  if (festival.venue.state) addressParts.addressRegion = festival.venue.state;
  if (festival.venue.country) addressParts.addressCountry = festival.venue.country;
  if (Object.keys(addressParts).length > 1) location.address = addressParts;

  if (festival.venue.latitude && festival.venue.longitude) {
    location.geo = {
      '@type': 'GeoCoordinates',
      latitude: festival.venue.latitude,
      longitude: festival.venue.longitude,
    };
  }
  schema.location = location;

  // Best offer
  const priced = festival.events.filter((e) => e.minPrice);
  if (priced.length > 0) {
    const lowest = priced.reduce((min, e) => (e.minPrice! < min.minPrice! ? e : min), priced[0]);
    schema.offers = [{
      '@type': 'Offer',
      url: lowest.ticketUrl || SITE_URL,
      availability: 'https://schema.org/InStock',
      price: lowest.minPrice,
      priceCurrency: lowest.currency || 'USD',
    }];
  }

  return schema;
}

/**
 * Official TourWax profiles on other platforms. Google uses sameAs to
 * consolidate the brand entity across the web. Add new profiles
 * (Crunchbase, X, Instagram, etc.) here as they're created.
 */
const ORGANIZATION_SAME_AS = [
  'https://www.linkedin.com/company/tourwax/',
  'https://www.crunchbase.com/organization/tourwax',
];

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      // Square raster logo (512x512) per Google's Organization logo
      // guidelines; the horizontal wordmark lives at /logo.svg.
      url: `${SITE_URL}/logo-square.png`,
      width: 512,
      height: 512,
    },
    description: 'Discover upcoming concert tour dates, venues, and latest news for your favorite music artists.',
    sameAs: ORGANIZATION_SAME_AS,
  };
}

export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: 'Discover upcoming concert tour dates, venues, and latest news for your favorite music artists.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
