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
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: event.name,
    startDate: new Date(event.eventDate).toISOString(),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    performer: {
      '@type': artist.genre ? 'MusicGroup' : 'Person',
      name: artist.name,
      url: `${SITE_URL}/artists/${artist.slug}`,
    },
  };

  // Add image if available
  if (artist.imageUrl) {
    schema.image = artist.imageUrl;
  }

  // Add venue/location information
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
  }

  // Add ticket offer information
  if (event.ticketUrl || event.minPrice) {
    const offer: Record<string, any> = {
      '@type': 'Offer',
      url: event.ticketUrl || `${SITE_URL}/artists/${artist.slug}`,
      availability: 'https://schema.org/InStock',
    };

    if (event.minPrice) {
      offer.price = event.minPrice;
      offer.priceCurrency = event.currency || 'USD';
    }

    if (event.minPrice && event.maxPrice && event.minPrice !== event.maxPrice) {
      offer.priceRange = `${event.minPrice}-${event.maxPrice}`;
    }

    schema.offers = offer;
  }

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

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/logo.svg`,
    },
    description: 'Discover upcoming concert tour dates, venues, and latest news for your favorite music artists.',
    sameAs: [
      // Add social media profiles here when available
      // 'https://twitter.com/tourwax',
      // 'https://www.facebook.com/tourwax',
    ],
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
        urlTemplate: `${SITE_URL}/artists?search={search_term_string}`,
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
