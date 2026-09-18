/**
 * Path-based pagination helpers.
 *
 * Paginated listings live at `<base>` (page 1) and `<base>/page/<n>` (page 2+)
 * instead of `<base>?page=<n>`. Reading `searchParams` in a page turns the
 * whole route dynamic: `revalidate` is ignored and every request, mostly bot
 * crawl, becomes a cold function render with database queries. A path segment
 * keeps every page a static/ISR entry.
 */

/**
 * Parse the `[page]` route segment. Returns the page number for a canonical
 * deep page (2+), `1` when the caller should redirect to the base path, and
 * `null` for anything that is not a plain positive integer (leading zeros,
 * signs, decimals), which the caller should 404.
 */
export function parsePageSegment(raw: string): number | null {
  if (!/^[1-9]\d{0,5}$/.test(raw)) return null;
  return Number(raw);
}

/** URL for a page of a path-paginated listing. */
export function pagePath(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}/page/${page}`;
}
