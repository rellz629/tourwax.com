/**
 * City slug-collision resolution.
 *
 * /concerts/[city] slugs come from slugify(venue.city), which collides for
 * same-name cities in different places: Portland OR vs Portland ME, Birmingham
 * GB vs Birmingham AL, Hamburg DE vs Hamburg NY. Before 2026-08 the page
 * filtered events by city NAME only, so it mixed both cities' events under an
 * arbitrarily chosen title ("Concerts in Hamburg, NY" listing German shows).
 *
 * At the same time, the same physical city appears under multiple raw
 * (state, country) spellings across sources: Toronto ON/CA vs ON/Canada,
 * Milwaukee WI vs Wi, Dublin's postal-district states (D2, D7, ...). Those must
 * keep merging.
 *
 * This module normalizes locations and groups a slug's venue rows into
 * physical cities: state-level identity for US/Canada, country-level elsewhere.
 * The DOMINANT location (most lifetime events, then upcoming) owns the bare
 * slug: the page renders only its events and the sitemap counts only them.
 * Secondary locations get no page (their events remain reachable via artist
 * and venue pages) — deliberately no new thin URLs during the Google indexing
 * recovery. Lifetime-first dominance keeps a slug's identity from flipping as
 * near-term event counts fluctuate.
 */

import { slugify } from './slugify';

const COUNTRY_ALIASES: Record<string, string> = {
  CANADA: 'CA',
  UK: 'GB',
  'UNITED KINGDOM': 'GB',
  USA: 'US',
  'UNITED STATES': 'US',
  FRANCE: 'FR',
  GERMANY: 'DE',
  'PUERTO RICO': 'PR',
};

export function normalizeCountry(country: string | null | undefined): string {
  const c = (country ?? '').trim().toUpperCase();
  return COUNTRY_ALIASES[c] ?? c;
}

export function normalizeState(state: string | null | undefined): string {
  return (state ?? '').trim().toUpperCase();
}

/** Uppercase raw spellings that normalize to the given country code, for SQL
 *  `upper(country) IN (...)` comparisons ("CA" → ["CA", "CANADA"]). */
export function rawCountryTokens(normCountry: string): string[] {
  return [normCountry, ...Object.keys(COUNTRY_ALIASES).filter((k) => COUNTRY_ALIASES[k] === normCountry)];
}

export interface CityLocationRow {
  city: string;
  state: string | null;
  country: string | null;
  upcoming: number;
  lifetime: number;
}

export interface CityLocation {
  /** Normalized identity, e.g. "US|NY" or "DE|". */
  key: string;
  displayCity: string;
  /** Normalized state for US/CA locations, null elsewhere. */
  displayState: string | null;
  displayCountry: string;
  /** Raw values as stored on venues — use with cityLocationWhere-style filters. */
  cityNames: string[];
  states: (string | null)[];
  countries: (string | null)[];
  upcoming: number;
  lifetime: number;
}

function locationKey(row: { state: string | null; country: string | null }): string {
  const country = normalizeCountry(row.country);
  // State-level identity only where states disambiguate same-name cities;
  // elsewhere "state" is often a postal district of one city (Dublin D2/D7).
  if (country === 'US' || country === 'CA') return `${country}|${normalizeState(row.state)}`;
  return `${country}|`;
}

/**
 * Groups per-(city, state, country) count rows into physical cities per slug.
 * Returns slug → locations sorted dominant-first. Row order does not affect
 * the result.
 */
export function resolveCityLocations(rows: CityLocationRow[]): Map<string, CityLocation[]> {
  interface Group {
    key: string;
    rows: CityLocationRow[];
    upcoming: number;
    lifetime: number;
  }
  const bySlug = new Map<string, Map<string, Group>>();

  for (const row of rows) {
    if (!row.city) continue;
    const slug = slugify(row.city);
    const key = locationKey(row);
    if (!bySlug.has(slug)) bySlug.set(slug, new Map());
    const groups = bySlug.get(slug)!;
    const group = groups.get(key) ?? { key, rows: [], upcoming: 0, lifetime: 0 };
    group.rows.push(row);
    group.upcoming += row.upcoming;
    group.lifetime += row.lifetime;
    groups.set(key, group);
  }

  const result = new Map<string, CityLocation[]>();
  for (const [slug, groups] of bySlug) {
    const locations = [...groups.values()]
      .sort((a, b) => b.lifetime - a.lifetime || b.upcoming - a.upcoming || a.key.localeCompare(b.key))
      .map((g): CityLocation => {
        const heaviest = [...g.rows].sort(
          (a, b) => b.lifetime - a.lifetime || b.upcoming - a.upcoming || a.city.localeCompare(b.city)
        )[0];
        const country = normalizeCountry(heaviest.country);
        const isStateLevel = country === 'US' || country === 'CA';
        return {
          key: g.key,
          displayCity: heaviest.city,
          displayState: isStateLevel && normalizeState(heaviest.state) ? normalizeState(heaviest.state) : null,
          displayCountry: country,
          cityNames: [...new Set(g.rows.map((r) => r.city))],
          states: [...new Set(g.rows.map((r) => r.state))],
          countries: [...new Set(g.rows.map((r) => r.country))],
          upcoming: g.upcoming,
          lifetime: g.lifetime,
        };
      });
    result.set(slug, locations);
  }
  return result;
}
