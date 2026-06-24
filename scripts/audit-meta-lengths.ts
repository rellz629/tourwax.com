import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, venues } from '@/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { slugify } from '@/lib/slugify';
import { normalizeGenre } from '@/lib/genres';
import {
  generateArtistTitle,
  generateArtistDescription,
  generateCityTitle,
  generateCityDescription,
  generateGenreTitle,
  generateGenreDescription,
  generateVenueTitle,
  generateVenueDescription,
  pageTitle,
  trimForMeta,
} from '@/lib/seo';
import {
  getAllArtistIndexCounts,
  getAllVenueIndexCounts,
  getAllCityIndexCounts,
} from '@/lib/event-counts';
import { shouldNoindexArtist, shouldNoindexVenue, shouldNoindexCity } from '@/lib/seo-pruning';

const SUFFIX = ' | TourWax';
const YEAR = 2026;

type Stat = { type: string; total: number; titleOver: number; descBad: number; worstTitle: [number, string]; worstDesc: [number, string] };

function track(stat: Stat, rawTitle: string, rawDesc: string, label: string) {
  void label;
  stat.total++;
  // Mirror production: pageTitle() drops the " | TourWax" suffix when it would
  // overflow; trimForMeta() clamps the description to <=160 on a word boundary.
  const t = pageTitle(rawTitle);
  const rendered = typeof t === 'string' ? t + SUFFIX : t.absolute;
  const desc = trimForMeta(rawDesc);
  if (rendered.length > 70) {
    stat.titleOver++;
    if (rendered.length > stat.worstTitle[0]) stat.worstTitle = [rendered.length, rendered];
  }
  if (desc.length < 25 || desc.length > 160) {
    stat.descBad++;
    if (desc.length > stat.worstDesc[0]) stat.worstDesc = [desc.length, desc.slice(0, 90) + '…'];
  }
}

function newStat(type: string): Stat {
  return { type, total: 0, titleOver: 0, descBad: 0, worstTitle: [0, ''], worstDesc: [0, ''] };
}

async function main() {
  const now = new Date();

  // ---------- ARTISTS ----------
  const artistStat = newStat('artist');
  const [artistRows, countsByArtistId] = await Promise.all([
    db.select({ id: artists.id, name: artists.name, genre: artists.genre }).from(artists).where(eq(artists.isActive, true)),
    getAllArtistIndexCounts(now),
  ]);
  for (const a of artistRows) {
    const counts = countsByArtistId.get(a.id) ?? { lifetime: 0, upcoming: 0 };
    if (shouldNoindexArtist(counts)) continue;
    const title = generateArtistTitle(a.name, counts.upcoming, YEAR);
    const desc = generateArtistDescription(a.name, a.genre, counts.upcoming, ['Los Angeles, CA', 'New York, NY'], now, 45);
    track(artistStat, title, desc, a.name);
  }

  // ---------- VENUES ----------
  const venueStat = newStat('venue');
  const venueCounts = await getAllVenueIndexCounts(now);
  // need city per venue slug
  const venueCityRows = await db.select({ name: venues.name, city: venues.city }).from(venues);
  const cityBySlug = new Map<string, { name: string; city: string | null }>();
  for (const v of venueCityRows) cityBySlug.set(slugify(v.name), { name: v.name, city: v.city });
  for (const [slug, counts] of venueCounts.entries()) {
    if (shouldNoindexVenue(counts)) continue;
    const meta = cityBySlug.get(slug);
    const title = generateVenueTitle(counts.name, meta?.city ?? null, counts.upcoming, YEAR);
    const desc = generateVenueDescription(counts.name, meta?.city ?? null, counts.upcoming, ['Taylor Swift', 'Drake', 'Coldplay'], now);
    track(venueStat, title, desc, counts.name);
  }

  // ---------- CITIES ----------
  const cityStat = newStat('city');
  const cityCounts = await getAllCityIndexCounts(now);
  // map slug -> a representative "City, ST"
  const cityNameRows = await db
    .select({ city: venues.city, state: venues.state })
    .from(venues)
    .where(and(isNotNull(venues.city)))
    .groupBy(venues.city, venues.state);
  const nameBySlug = new Map<string, { city: string; state: string | null }>();
  for (const r of cityNameRows) {
    if (!r.city) continue;
    const slug = slugify(r.city);
    if (!nameBySlug.has(slug)) nameBySlug.set(slug, { city: r.city, state: r.state });
  }
  for (const [slug, counts] of cityCounts.entries()) {
    if (shouldNoindexCity(counts)) continue;
    const meta = nameBySlug.get(slug);
    if (!meta) continue;
    const title = generateCityTitle(meta.city, meta.state, counts.upcoming, YEAR);
    const desc = generateCityDescription(meta.city, meta.state, counts.upcoming, ['Taylor Swift', 'Drake', 'Coldplay'], ['Arena'], now);
    track(cityStat, title, desc, meta.city);
  }

  // ---------- GENRES ----------
  const genreStat = newStat('genre');
  const genreArtists = await db.select({ genre: artists.genre, name: artists.name }).from(artists).where(eq(artists.isActive, true));
  const byGenreName = new Map<string, string[]>();
  for (const a of genreArtists) {
    const g = normalizeGenre(a.genre);
    if (!byGenreName.has(g)) byGenreName.set(g, []);
    byGenreName.get(g)!.push(a.name);
  }
  for (const [g, names] of byGenreName.entries()) {
    const title = generateGenreTitle(g, names.length, YEAR, names.slice(0, 2));
    const desc = generateGenreDescription(g, names.length, names.length * 2, names);
    track(genreStat, title, desc, g);
  }

  // ---------- REPORT ----------
  const stats = [artistStat, venueStat, cityStat, genreStat];
  console.log('\n=== META LENGTH AUDIT (indexable pages, year ' + YEAR + ', incl. " | TourWax" suffix) ===\n');
  for (const s of stats) {
    const tPct = s.total ? Math.round((s.titleOver / s.total) * 100) : 0;
    const dPct = s.total ? Math.round((s.descBad / s.total) * 100) : 0;
    console.log(`${s.type.toUpperCase().padEnd(8)} ${s.total} pages | title>70: ${s.titleOver} (${tPct}%) | desc out-of-range: ${s.descBad} (${dPct}%)`);
    if (s.worstTitle[0]) console.log(`   worst title (${s.worstTitle[0]}): ${s.worstTitle[1]}`);
    if (s.worstDesc[0]) console.log(`   worst desc  (${s.worstDesc[0]}): ${s.worstDesc[1]}`);
    console.log('');
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
