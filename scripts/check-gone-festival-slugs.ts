/**
 * Classify /festivals/ entries in lib/gone-urls.ts against the live festival
 * rollup (lib/festivals.ts). Entries matching a canonical or legacy slug of a
 * real festival should NOT 410 — the festival page 308-redirects legacy slugs
 * to the canonical URL, but middleware's GONE check fires first and blocks it.
 * The 2026-06-09 Ahrefs crawl found 203 pages linking to these 410s.
 *
 * Prints the resolvable entries (remove them from GONE_URLS) and the truly
 * dead ones (keep them).
 *
 * Run: dotenv -e .env.local -- tsx scripts/check-gone-festival-slugs.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { GONE_URLS } = await import('@/lib/gone-urls');
  const { getAllFestivals, getArchivedFestivals } = await import('@/lib/festivals');

  const [upcoming, archived] = await Promise.all([
    getAllFestivals(),
    getArchivedFestivals(),
  ]);

  const liveSlugs = new Map<string, string>(); // any slug -> canonical slug
  for (const f of [...upcoming, ...archived]) {
    for (const slug of [f.slug, f.legacySlug, ...f.legacySlugs]) {
      if (!liveSlugs.has(slug)) liveSlugs.set(slug, f.slug);
    }
  }

  const goneFestivals = [...GONE_URLS].filter((u) => u.startsWith('/festivals/'));
  const resolvable: { gone: string; canonical: string }[] = [];
  const dead: string[] = [];

  for (const url of goneFestivals) {
    const slug = url.slice('/festivals/'.length);
    const canonical = liveSlugs.get(slug);
    if (canonical) {
      resolvable.push({ gone: url, canonical: `/festivals/${canonical}` });
    } else {
      dead.push(url);
    }
  }

  console.log(`GONE festival URLs: ${goneFestivals.length}`);
  console.log(`\nRESOLVABLE — remove from GONE_URLS (page will 308 to canonical):`);
  for (const r of resolvable) {
    console.log(`  ${r.gone}  ->  ${r.canonical}${r.gone === r.canonical ? '  (CANONICAL ITSELF!)' : ''}`);
  }
  console.log(`\nTruly dead — keep 410: ${dead.length}`);
  for (const d of dead) console.log(`  ${d}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
