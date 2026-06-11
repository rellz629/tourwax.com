/**
 * Verify the lib/event-counts.ts invariant: the bulk helpers (used by the
 * sitemap filter) and the per-entity helpers (used by the pages' noindex
 * decisions) return identical counts, so a URL can never be noindexed while
 * still listed in sitemap.xml.
 *
 * Samples artists, venues, and cities; compares bulk vs per-entity counts; and
 * reports how the previously mismatched Ahrefs "noindex page in sitemap" URLs
 * (2026-06-09 crawl) now classify.
 *
 * Run: dotenv -e .env.local -- tsx scripts/check-index-count-consistency.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('@/db');
  const { artists, venues } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const { slugify } = await import('@/lib/slugify');
  const {
    getAllArtistIndexCounts,
    getArtistIndexCounts,
    getAllVenueIndexCounts,
    getVenueIndexCounts,
    getAllCityIndexCounts,
    getCityIndexCounts,
  } = await import('@/lib/event-counts');
  const { shouldNoindexArtist, shouldNoindexVenue, shouldNoindexCity } = await import('@/lib/seo-pruning');

  const now = new Date();
  let failures = 0;

  // ---- Artists ----
  const [bulkArtists, artistRows] = await Promise.all([
    getAllArtistIndexCounts(now),
    db.select({ id: artists.id, slug: artists.slug }).from(artists).where(eq(artists.isActive, true)),
  ]);

  const sampleArtists = artistRows.filter((_, i) => i % Math.ceil(artistRows.length / 25) === 0).slice(0, 25);
  for (const a of sampleArtists) {
    const bulk = bulkArtists.get(a.id) ?? { lifetime: 0, upcoming: 0 };
    const single = await getArtistIndexCounts(a.id, now);
    if (bulk.lifetime !== single.lifetime || bulk.upcoming !== single.upcoming) {
      failures++;
      console.log(`ARTIST MISMATCH ${a.slug}: bulk=${JSON.stringify(bulk)} single=${JSON.stringify(single)}`);
    }
  }
  console.log(`Artists: sampled ${sampleArtists.length}, mismatches so far: ${failures}`);

  // ---- Venues ----
  const [bulkVenues, allVenueRows] = await Promise.all([
    getAllVenueIndexCounts(now),
    db.select({ id: venues.id, name: venues.name }).from(venues),
  ]);
  const venueIdsBySlug = new Map<string, string[]>();
  for (const v of allVenueRows) {
    if (!v.name) continue;
    const slug = slugify(v.name);
    const list = venueIdsBySlug.get(slug) ?? [];
    list.push(v.id);
    venueIdsBySlug.set(slug, list);
  }
  const venueSlugs = [...bulkVenues.keys()];
  const sampleVenues = venueSlugs.filter((_, i) => i % Math.ceil(venueSlugs.length / 15) === 0).slice(0, 15);
  for (const slug of sampleVenues) {
    const bulk = bulkVenues.get(slug)!;
    const single = await getVenueIndexCounts(venueIdsBySlug.get(slug) ?? [], now);
    if (bulk.lifetime !== single.lifetime || bulk.upcoming !== single.upcoming) {
      failures++;
      console.log(`VENUE MISMATCH ${slug}: bulk=${JSON.stringify(bulk)} single=${JSON.stringify(single)}`);
    }
  }
  console.log(`Venues: sampled ${sampleVenues.length}, mismatches so far: ${failures}`);

  // ---- Cities ----
  const bulkCities = await getAllCityIndexCounts(now);
  const allCityRows = await db.selectDistinct({ city: venues.city }).from(venues);
  const cityNamesBySlug = new Map<string, string[]>();
  for (const c of allCityRows) {
    if (!c.city) continue;
    const slug = slugify(c.city);
    const list = cityNamesBySlug.get(slug) ?? [];
    list.push(c.city);
    cityNamesBySlug.set(slug, list);
  }
  const citySlugs = [...bulkCities.keys()];
  const sampleCities = citySlugs.filter((_, i) => i % Math.ceil(citySlugs.length / 15) === 0).slice(0, 15);
  for (const slug of sampleCities) {
    const bulk = bulkCities.get(slug)!;
    const single = await getCityIndexCounts(cityNamesBySlug.get(slug) ?? [], now);
    if (bulk.lifetime !== single.lifetime || bulk.upcoming !== single.upcoming) {
      failures++;
      console.log(`CITY MISMATCH ${slug}: bulk=${JSON.stringify(bulk)} single=${JSON.stringify(single)}`);
    }
  }
  console.log(`Cities: sampled ${sampleCities.length}, mismatches so far: ${failures}`);

  // ---- Sitemap impact under the new dedup counts ----
  const artistBySlug = new Map(artistRows.map((a) => [a.slug, a.id]));
  let artistsIn = 0;
  for (const a of artistRows) {
    const c = bulkArtists.get(a.id) ?? { lifetime: 0, upcoming: 0 };
    if (!shouldNoindexArtist(c)) artistsIn++;
  }
  let venuesIn = 0;
  for (const c of bulkVenues.values()) if (!shouldNoindexVenue(c)) venuesIn++;
  let citiesIn = 0;
  for (const c of bulkCities.values()) if (!shouldNoindexCity(c)) citiesIn++;
  console.log(`\nSitemap surface under dedup counts: artists ${artistsIn}/${artistRows.length}, venues ${venuesIn}/${bulkVenues.size}, cities ${citiesIn}/${bulkCities.size}`);

  // ---- Previously mismatched URLs (Ahrefs 2026-06-09 noindex-in-sitemap) ----
  const args = process.argv.slice(2);
  const listPath = args.find((a) => a.endsWith('.txt'));
  if (listPath) {
    const fs = await import('fs');
    const urls = fs.readFileSync(listPath, 'utf-8').split('\n').map((l) => l.trim()).filter(Boolean);
    let nowExcluded = 0, nowIndexed = 0, unknown = 0;
    for (const url of urls) {
      const path = url.replace(/https:\/\/(www\.)?tourwax\.com/, '');
      const [, section, slug] = path.split('/');
      let counts = null;
      if (section === 'artists') {
        const id = artistBySlug.get(slug);
        counts = id ? (bulkArtists.get(id) ?? { lifetime: 0, upcoming: 0 }) : null;
        if (counts) (shouldNoindexArtist(counts) ? nowExcluded++ : nowIndexed++); else unknown++;
      } else if (section === 'venues') {
        counts = bulkVenues.get(slug) ?? null;
        if (counts) (shouldNoindexVenue(counts) ? nowExcluded++ : nowIndexed++); else { nowExcluded++; }
      } else if (section === 'concerts') {
        counts = bulkCities.get(slug) ?? null;
        if (counts) (shouldNoindexCity(counts) ? nowExcluded++ : nowIndexed++); else { nowExcluded++; }
      } else unknown++;
    }
    console.log(`\nPreviously mismatched URLs (${urls.length}): now consistently EXCLUDED from sitemap+index: ${nowExcluded}, now consistently INDEXED both: ${nowIndexed}, unknown (inactive/missing): ${unknown}`);
  }

  console.log(failures === 0 ? '\nPASS: bulk and per-entity counts agree.' : `\nFAIL: ${failures} mismatches.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
