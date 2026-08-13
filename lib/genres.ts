import { slugify } from './slugify';

/** Normalize API genre names to clean display names */
export function normalizeGenre(genre: string | null): string {
  if (!genre) return 'Other';
  const map: Record<string, string> = {
    'Hip-Hop/Rap': 'Hip-Hop',
    'Dance/Electronic': 'Electronic',
    'Dance': 'Electronic',
    'World': 'Latin',
    'Jazz': 'R&B',
    'Reggae': 'Latin',
    'Chanson Francaise': 'Latin',
    'Undefined': 'Other',
    'undefined': 'Other',
    // Case/spelling variants that collide on the same /tours/<slug> URL: both
    // "Hip-hop" and "Hip-Hop" slugify to hip-hop, but pages filter artists by
    // the normalized string, so the un-mapped variant's artists were invisible.
    'Hip-hop': 'Hip-Hop',
    'Rnb': 'R&B',
  };
  return map[genre] || genre;
}

/** Generate a URL-friendly slug from a normalized genre name */
export function genreSlug(genre: string): string {
  return slugify(genre);
}

/** Map from genre slug back to display name */
export const GENRE_DISPLAY_NAMES: Record<string, string> = {
  'hip-hop': 'Hip-Hop',
  'rb': 'R&B',
  'pop': 'Pop',
  'rock': 'Rock',
  'country': 'Country',
  'electronic': 'Electronic',
  'latin': 'Latin',
  'other': 'Other',
};

/** SEO description paragraphs for each genre */
export const GENRE_DESCRIPTIONS: Record<string, string> = {
  'Hip-Hop': 'Find upcoming Hip-Hop and rap tour dates, concert tickets, and live show schedules. From stadium tours to intimate club shows, discover when your favorite rappers and Hip-Hop artists are performing near you.',
  'R&B': 'Browse R&B tour dates and concert schedules for the top rhythm and blues artists. Get tickets to upcoming R&B shows and never miss a live performance.',
  'Pop': 'Discover Pop music tour dates and concert tickets for the biggest artists in the world. Stay up to date on upcoming Pop concerts, arena tours, residencies, and festival appearances.',
  'Rock': 'Find Rock concert tour dates, tickets, and venue information. From classic rock legends to modern alternative acts, see who is touring near you.',
  'Country': 'Browse Country music tour dates and get tickets to upcoming concerts. From Nashville stars to rising acts, find Country shows and festival lineups.',
  'Electronic': 'Discover Electronic and dance music tour dates, festival appearances, and DJ sets. Find tickets for EDM concerts, club nights, and music festivals.',
  'Latin': 'Find Latin music tour dates, reggaeton concerts, and live show tickets. Discover upcoming Latin pop, salsa, bachata, and reggaeton tours near you. Browse schedules for the biggest Latin artists on tour.',
  'Other': 'Browse tour dates and concert tickets across all music genres. Discover upcoming live shows and get tickets to concerts near you.',
};

/** Long-form SEO content rendered on genre landing pages, by genre */
export const GENRE_LONG_CONTENT: Record<string, { headline: string; paragraphs: string[] }> = {
  'Hip-Hop': {
    headline: 'Hip-Hop & Rap Concerts in 2026',
    paragraphs: [
      'Hip-Hop is the most-toured genre in the United States, and 2026 is shaping up to be one of the busiest years on record. From stadium runs by Drake, Kendrick Lamar, and Post Malone to club-circuit tours from independent rappers, there are upcoming hip hop concerts in nearly every major U.S. city this year.',
      'Looking for rap concerts near you? TourWax tracks every announced rap and hip-hop tour from Ticketmaster and SeatGeek, with daily updates so you never miss a date. Browse upcoming hip hop concerts by city for Houston, Atlanta, Los Angeles, New York, Chicago, and dozens more, or search for a specific rapper to see their full tour schedule.',
      'Common questions we hear: What rappers are on tour right now? Which hip hop concerts are happening in Dallas tonight? When does the next major rap festival happen? The artist list above shows every Hip-Hop and rap artist with confirmed upcoming dates. Click any name to see their full schedule, ticket prices, and venue details.',
    ],
  },
  'Pop': {
    headline: 'Pop Tours & Stadium Concerts in 2026',
    paragraphs: [
      '2026 is a banner year for pop music tours. Bruno Mars, Harry Styles, Taylor Swift, Sabrina Carpenter, and Olivia Rodrigo are all touring, with stadium runs, multi-night residencies, and global routings that touch every continent.',
      'TourWax tracks every announced pop tour from Ticketmaster and SeatGeek so you can compare ticket prices and find the best dates. Browse pop tour dates by artist, see who has tickets on sale today, or check city pages to find pop concerts happening near you.',
      'Looking for openers? We publish dedicated guides for every major 2026 pop tour, including Bruno Mars, Harry Styles, and Post Malone. The artist list above shows every pop artist with confirmed upcoming dates.',
    ],
  },
};
