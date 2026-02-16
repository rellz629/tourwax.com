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
  return name
    .normalize('NFD')                    // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, '')     // Remove diacritics/accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')        // Keep only letters, numbers, spaces, hyphens
    .replace(/\s+/g, '-')                // Replace spaces with hyphens
    .replace(/-+/g, '-')                 // Replace multiple hyphens with single hyphen
    .trim();
}
