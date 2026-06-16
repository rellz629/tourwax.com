/**
 * Deactivate "junk artists" — DB rows whose name matches a festival/tribute/
 * concert/presents pattern, have no curated metadata, and have thin or zero
 * events. These were created during Ticketmaster/SeatGeek imports because
 * those APIs sometimes return festival names or package names in their
 * "attractions" / "performer" fields, and the import script flattened them
 * into the artists table.
 *
 * Phase 1B of the late-April-2026 Google indexing recovery. Sets isActive=false
 * so the rows leave the sitemap, leave generateStaticParams, and stop polluting
 * the artist page-type quality signals. They are NOT deleted — if any turn out
 * to be real artists, flipping isActive back to true restores everything.
 *
 * Run:
 *   npm run deactivate:junk-artists -- --dry-run    (default)
 *   npm run deactivate:junk-artists -- --apply
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events, eventArtists } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { nonArtistReason } from '@/lib/non-artist';

/**
 * Classify a name's "non-artist-ness":
 *   - 'strong': a festival brand, booking agency/promoter, tribute act, or tour
 *     bus. These are virtually always not-an-artist regardless of any imported
 *     metadata, because Spotify and Ticketmaster assign Spotify IDs to festival
 *     accounts and images to event-poster art. The festival/promoter/tribute
 *     check is shared with the import guard (lib/non-artist) and is unanchored,
 *     so it catches mid-name brands like "Discovery Festival - Dundee" that the
 *     old end-anchored pattern missed.
 *   - 'weak': contains "concert" / "symphony" / "classical". Could be a real
 *     artist ("Lang Lang plays the symphony", etc.) so we keep the metadata gate.
 *   - null: looks like a normal artist name.
 */
function classifyName(name: string): 'strong' | 'weak' | null {
  if (nonArtistReason(name)) return 'strong';
  const lower = name.toLowerCase().trim();
  if (/\btour bus\b/i.test(lower)) return 'strong';
  if (/\bconcert\b|\bsymphony\b|\bclassical\b/i.test(lower)) return 'weak';
  return null;
}

interface Stats {
  considered: number;
  matched: number;
  alreadyInactive: number;
  hadMetadata: number;
  hadEvents: number;
  wouldDeactivate: number;
  applied: number;
  examplesByReason: Map<string, string[]>;
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY (will mutate DB)'}\n`);

  // One round-trip: every artist plus their event counts.
  const rows = await db
    .select({
      id: artists.id,
      slug: artists.slug,
      name: artists.name,
      isActive: artists.isActive,
      bio: artists.bio,
      imageUrl: artists.imageUrl,
      spotifyId: artists.spotifyId,
      eventCount: sql<number>`count(${eventArtists.eventId})::int`,
    })
    .from(artists)
    .leftJoin(eventArtists, eq(eventArtists.artistId, artists.id))
    .leftJoin(events, eq(events.id, eventArtists.eventId))
    .groupBy(
      artists.id,
      artists.slug,
      artists.name,
      artists.isActive,
      artists.bio,
      artists.imageUrl,
      artists.spotifyId,
    );

  const stats: Stats = {
    considered: rows.length,
    matched: 0,
    alreadyInactive: 0,
    hadMetadata: 0,
    hadEvents: 0,
    wouldDeactivate: 0,
    applied: 0,
    examplesByReason: new Map(),
  };

  const toDeactivate: typeof rows = [];
  const examples = (reason: string, line: string) => {
    if (!stats.examplesByReason.has(reason)) stats.examplesByReason.set(reason, []);
    const list = stats.examplesByReason.get(reason)!;
    if (list.length < 5) list.push(line);
  };

  for (const r of rows) {
    const cls = classifyName(r.name);
    if (!cls) continue;
    stats.matched++;

    if (!r.isActive) {
      stats.alreadyInactive++;
      examples('already-inactive', `${r.slug} (${r.name})`);
      continue;
    }

    // Strong patterns (ends in "Festival" / "Fest", "A Tribute to ...") are
    // deactivated regardless of metadata. Festivals get Spotify IDs and poster
    // art too; that's not enough to keep them in the artists surface.
    if (cls === 'strong') {
      stats.wouldDeactivate++;
      examples('would-deactivate (strong)', `${r.slug} (${r.name}, ${r.eventCount} events)`);
      toDeactivate.push(r);
      continue;
    }

    // Weak patterns ("presents" / "concert" / "symphony" / "classical") need
    // the metadata + thin-events gate to avoid false positives like real
    // classical artists.
    const hasMetadata =
      (!!r.bio && r.bio.length > 50) || !!r.imageUrl || !!r.spotifyId;
    if (hasMetadata && r.eventCount >= 3) {
      stats.hadMetadata++;
      examples('weak + metadata + events — keeping', `${r.slug} (${r.name}, ${r.eventCount} events)`);
      continue;
    }
    if (r.eventCount >= 5) {
      stats.hadEvents++;
      examples('weak + 5+ events — keeping', `${r.slug} (${r.name}, ${r.eventCount} events)`);
      continue;
    }
    stats.wouldDeactivate++;
    examples('would-deactivate (weak + thin)', `${r.slug} (${r.name}, ${r.eventCount} events)`);
    toDeactivate.push(r);
  }

  console.log('Summary');
  console.log('-------');
  console.log(`  Considered:           ${stats.considered}`);
  console.log(`  Name-pattern match:   ${stats.matched}`);
  console.log(`    Already inactive:   ${stats.alreadyInactive}`);
  console.log(`    Kept (metadata):    ${stats.hadMetadata}`);
  console.log(`    Kept (>= 3 events): ${stats.hadEvents}`);
  console.log(`    Would deactivate:   ${stats.wouldDeactivate}`);
  console.log('');

  for (const [reason, list] of stats.examplesByReason.entries()) {
    console.log(`  Sample [${reason}]:`);
    for (const l of list) console.log(`    - ${l}`);
    console.log('');
  }

  // Always write the full candidate list to a CSV for review, dry-run or not.
  const fs = await import('fs');
  const csvLines = [
    'slug,name,event_count,classification,has_bio,has_image,has_spotify',
    ...toDeactivate.map((r) => {
      const cls = classifyName(r.name)!;
      return [
        r.slug,
        `"${r.name.replace(/"/g, '""')}"`,
        r.eventCount,
        cls,
        !!r.bio && r.bio.length > 50,
        !!r.imageUrl,
        !!r.spotifyId,
      ].join(',');
    }),
  ];
  fs.writeFileSync('audit-output/junk-artist-candidates.csv', csvLines.join('\n') + '\n');
  console.log(`Wrote ${toDeactivate.length} candidates to audit-output/junk-artist-candidates.csv\n`);

  if (dryRun) {
    console.log('DRY RUN — no DB writes performed.');
    console.log('Re-run with `npm run deactivate:junk-artists -- --apply` to mutate.');
    process.exit(0);
  }

  console.log(`Applying isActive=false to ${toDeactivate.length} artist rows...`);
  for (const r of toDeactivate) {
    await db.update(artists).set({ isActive: false }).where(eq(artists.id, r.id));
    stats.applied++;
  }
  console.log(`Done. Deactivated: ${stats.applied}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
