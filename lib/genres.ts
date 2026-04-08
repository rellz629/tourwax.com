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
  'Hip-Hop': 'Find upcoming Hip-Hop and rap tour dates, concert tickets, and live show schedules. From stadium tours to intimate club shows, discover when your favorite Hip-Hop artists are performing near you.',
  'R&B': 'Browse R&B tour dates and concert schedules for the top rhythm and blues artists. Get tickets to upcoming R&B shows and never miss a live performance.',
  'Pop': 'Discover Pop music tour dates and concert tickets for the biggest artists in the world. Stay up to date on upcoming Pop concerts, arena tours, and festival appearances.',
  'Rock': 'Find Rock concert tour dates, tickets, and venue information. From classic rock legends to modern alternative acts, see who is touring near you.',
  'Country': 'Browse Country music tour dates and get tickets to upcoming concerts. From Nashville stars to rising acts, find Country shows and festival lineups.',
  'Electronic': 'Discover Electronic and dance music tour dates, festival appearances, and DJ sets. Find tickets for EDM concerts, club nights, and music festivals.',
  'Latin': 'Find Latin music tour dates, reggaeton concerts, and live show tickets. Discover upcoming Latin pop, salsa, bachata, and reggaeton tours near you. Browse schedules for the biggest Latin artists on tour.',
  'Other': 'Browse tour dates and concert tickets across all music genres. Discover upcoming live shows and get tickets to concerts near you.',
};
