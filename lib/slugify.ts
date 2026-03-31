/**
 * Generate a URL-friendly slug from artist name
 *
 * Examples:
 * - "Taylor Swift" → "taylor-swift"
 * - "The Weeknd" → "the-weeknd"
 * - "21 Savage" → "21-savage"
 * - "Tyler, The Creator" → "tyler-the-creator"
 * - "Jhené Aiko" → "jhene-aiko"
 * - "Beyoncé" → "beyonce"
 */
export function slugify(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')                    // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, '')     // Remove diacritics/accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')        // Keep only letters, numbers, spaces, hyphens
    .replace(/\s+/g, '-')                // Replace spaces with hyphens
    .replace(/-+/g, '-')                 // Replace multiple hyphens with single hyphen
    .trim();
}

/**
 * Generate a URL-friendly slug for an event page
 *
 * Format: "{artist-slug}-at-{venue-slug}-{YYYY-MM-DD}"
 * Example: "drake-at-madison-square-garden-2025-03-15"
 */
export function eventSlug(artistName: string, venueName: string | null, eventDate: Date): string {
  const artistPart = slugify(artistName || 'unknown');
  const venuePart = venueName ? slugify(venueName) : 'tba';
  const datePart = eventDate.toISOString().slice(0, 10);
  return `${artistPart}-at-${venuePart}-${datePart}`;
}

/**
 * Parse the date from the end of an event slug (last 10 chars = YYYY-MM-DD)
 */
export function parseDateFromEventSlug(slug: string): string | null {
  const match = slug.match(/(\d{4}-\d{2}-\d{2})$/);
  return match ? match[1] : null;
}
