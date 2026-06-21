/**
 * Venue canonicalization.
 *
 * Ticketmaster and SeatGeek each create their own venue record for the same
 * physical place, often under different names ("Wolf Trap" vs "Wolf Trap Filene
 * Center" vs "Filene Center at The Wolf Trap") and occasionally with a geocoding
 * error. Every read path already collapses venues that share slugify(name); this
 * utility groups the records that *should* share an identity so that collapse
 * actually catches them.
 *
 * Records are clustered within the same (state, city) when they look like the
 * same venue by coordinates (within ~300m) or by name (one name's significant
 * tokens are a subset of the other's, or strong token overlap). Clustering is
 * computed live from whatever venue set a page already loads, so new duplicates
 * from future fetches canonicalize automatically.
 */

import { slugify } from './slugify';

export interface VenueLike {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}

export interface VenueCluster {
  canonicalId: string;
  canonicalName: string;
  canonicalSlug: string;
  memberIds: string[];
}

const STOPWORDS = new Set(['the', 'at', 'of', 'by', 'a', 'an', 'and', 'for', 'on', 'in', 'to', 'presents', 'presented', 'powered']);
// Generic venue-type words carry no identity on their own — two records need a
// shared *strong* (non-generic) token to merge, so "Riviera Theatre" and "Vic
// Theatre" don't collapse just because both are theatres.
const GENERIC = new Set([
  'theatre', 'theater', 'hall', 'center', 'centre', 'arena', 'stadium', 'club',
  'ballroom', 'amphitheater', 'amphitheatre', 'pavilion', 'room', 'live', 'music', 'lounge',
]);
// Tight: only co-located records (same building) merge on coordinates, and only
// when one name is a subset of the other. A broad radius chains distinct
// downtown venues together; co-located different rooms (Heaven/Hell) must not.
const SAME_COORD_METERS = 60;
const JACCARD_THRESHOLD = 0.6;

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics so "Café" == "Cafe"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function nameTokens(s: string): string[] {
  return normalizeName(s).split(/\s+/).filter(Boolean);
}

interface Fingerprint {
  norm: string;        // normalized name with the city/state suffix removed, for exact matching
  core: Set<string>;   // identity tokens: name minus stopwords, city/state, and generic words
}

/**
 * Builds a venue fingerprint. `norm` drops the venue's own city/state tokens so
 * "The National - Richmond" matches "The National". `core` further drops
 * stopwords and generic venue-type words, so "The Chicago Theatre" in Chicago
 * reduces to nothing matchable (won't be swallowed by "Riviera Theatre -
 * Chicago"), while "Wolf Trap" keeps {wolf, trap}.
 */
function fingerprint(v: VenueLike): Fingerprint {
  const cityState = new Set([...nameTokens(v.city ?? ''), ...nameTokens(v.state ?? '')]);
  const nameWithoutCity = nameTokens(v.name).filter((t) => !cityState.has(t));
  const core = new Set(nameWithoutCity.filter((t) => !STOPWORDS.has(t) && !GENERIC.has(t)));
  return { norm: nameWithoutCity.join(' '), core };
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0) return false;
  for (const t of a) if (!b.has(t)) return false;
  return true;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function metersBetween(a: VenueLike, b: VenueLike): number | null {
  const aLat = parseFloat(a.latitude ?? '');
  const aLng = parseFloat(a.longitude ?? '');
  const bLat = parseFloat(b.latitude ?? '');
  const bLng = parseFloat(b.longitude ?? '');
  if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return null;
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Whether two venue records in the same city are the same physical venue. */
function sameVenue(a: VenueLike, fa: Fingerprint, b: VenueLike, fb: Fingerprint): boolean {
  // Identical name (covers source spelling/accent/punctuation variants).
  if (fa.norm === fb.norm) return true;

  const [small, large] =
    fa.core.size <= fb.core.size ? [fa.core, fb.core] : [fb.core, fa.core];
  const subset = isSubset(small, large);

  // Name match needs >=2 core tokens so single-word venues ("Webster Hall" vs
  // "Webster Theatre", both -> {webster}) don't merge on one shared word.
  if (small.size >= 2 && subset) return true;
  if (small.size >= 2 && jaccard(fa.core, fb.core) >= JACCARD_THRESHOLD) return true;

  // Co-located (same building) and one name is a subset of the other. Catches
  // single-token cases like "The Dome" vs "The Dome by Rutter Mills" (identical
  // coordinates) while keeping co-located different rooms ("Heaven" vs "Hell",
  // neither a subset) apart.
  const dist = metersBetween(a, b);
  if (dist !== null && dist <= SAME_COORD_METERS && small.size >= 1 && subset) return true;

  return false;
}

function groupKey(v: VenueLike): string {
  return `${(v.state ?? '').toLowerCase().trim()}|${(v.city ?? '').toLowerCase().trim()}`;
}

/**
 * Clusters venue records and returns a map from each venue id to its cluster.
 * `weightOf` (e.g. upcoming event count) picks the canonical member — the
 * heaviest wins, ties broken by the longer (more descriptive) name.
 */
export function clusterVenues(
  venuesList: VenueLike[],
  weightOf?: (id: string) => number
): Map<string, VenueCluster> {
  const byGroup = new Map<string, VenueLike[]>();
  for (const v of venuesList) {
    const k = groupKey(v);
    if (!byGroup.has(k)) byGroup.set(k, []);
    byGroup.get(k)!.push(v);
  }

  const result = new Map<string, VenueCluster>();

  for (const group of byGroup.values()) {
    // Union-find over the group.
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      let r = x;
      while (parent.get(r) !== r) r = parent.get(r)!;
      let c = x;
      while (parent.get(c) !== r) {
        const next = parent.get(c)!;
        parent.set(c, r);
        c = next;
      }
      return r;
    };
    const union = (x: string, y: string) => parent.set(find(x), find(y));
    for (const v of group) parent.set(v.id, v.id);

    const fps = new Map(group.map((v) => [v.id, fingerprint(v)]));
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (sameVenue(group[i], fps.get(group[i].id)!, group[j], fps.get(group[j].id)!)) {
          union(group[i].id, group[j].id);
        }
      }
    }

    const clusters = new Map<string, VenueLike[]>();
    for (const v of group) {
      const root = find(v.id);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root)!.push(v);
    }

    for (const members of clusters.values()) {
      const canonical = members.reduce((best, v) => {
        const wv = weightOf?.(v.id) ?? 0;
        const wb = weightOf?.(best.id) ?? 0;
        if (wv !== wb) return wv > wb ? v : best;
        return v.name.length > best.name.length ? v : best;
      });
      const cluster: VenueCluster = {
        canonicalId: canonical.id,
        canonicalName: canonical.name,
        canonicalSlug: slugify(canonical.name),
        memberIds: members.map((m) => m.id),
      };
      for (const m of members) result.set(m.id, cluster);
    }
  }

  return result;
}
