/**
 * Re-attribute events that were imported under a promoter / booking-agency
 * "attraction" (e.g. "Winiary Bookings") to their real headlining artist(s).
 *
 * Ticketmaster returns promoters, agencies, and festival brands in its
 * `attractions` field, and the import flattens those into the `artists` table.
 * That produces bogus artist pages and lets a promoter outrank real artists by
 * event count. This script fixes the data:
 *
 *   1. Parse the real headliner(s) out of each event title (stripping support
 *      acts, special guests, tour names, and "New Date" markers; splitting
 *      co-headline bills on "+", " x ", and " / ").
 *   2. Match each headliner to an existing artist (by slug, then by
 *      case-insensitive name); create a new artist row when none exists;
 *      reactivate a matched-but-inactive artist (an upcoming show is strong
 *      evidence it is a real performer).
 *   3. Link the event to the real artist(s) and remove the promoter link.
 *   4. Festival-titled events ("... Festival", "... Fest") have no single
 *      headliner, so they are left untouched and reported for manual review.
 *   5. Finally, deactivate the promoter row (isActive=false, reversible — the
 *      same philosophy as deactivate-junk-artists.ts). It is not deleted.
 *
 * Run:
 *   npm run reattribute:promoter -- --dry-run            (default; no writes)
 *   npm run reattribute:promoter -- --apply
 *   npm run reattribute:promoter -- --apply --slug some-other-promoter
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events, eventArtists } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { slugify } from '@/lib/slugify';
import { nanoid } from 'nanoid';
import fs from 'fs';

interface ParseResult {
  festival: boolean;
  names: string[];
}

/** Remove parentheticals, stray quotes, and collapse whitespace on one name. */
function cleanToken(s: string): string {
  return s
    .replace(/\s*\([^)]*\)\s*$/, '') // trailing "(BOA)" alt-spelling
    .replace(/["“”„']+/g, '') // stray quote characters
    .replace(/\s+-\s+.*$/, '') // trailing " - tour name" on a co-bill token
    .replace(/\s+(?:[A-Za-z]{2,}(?:\/[A-Za-z]{2,})?\s+)*tour\b.*$/i, '') // "Emmure EU/UK Tour" -> "Emmure"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract the headlining artist name(s) from a raw Ticketmaster event title.
 * Returns { festival: true } for festival-branded titles, which have no single
 * headliner and should not be turned into an artist.
 */
export function parseHeadliners(raw: string): ParseResult {
  let s = raw.trim();

  // Leading "*CANCELED* " / "*CANCELLED* " marker.
  s = s.replace(/^\*[^*]*\*\s*/, '');

  // Festivals have no single headliner.
  if (/\bfestival\b|\bfest\b/i.test(s)) return { festival: true, names: [] };

  // Tour names are usually quoted — drop everything from the first quote on.
  // e.g. HELLRIPPER "GOATKRAFT & GRANITE" Europe / UK - Tour 2026 -> HELLRIPPER
  s = s.replace(/\s*["“„].*$/, '');

  // "|" only ever fronts support acts / special guests / "New Date" here, never
  // a co-headliner, so keep the part before it.
  s = s.split('|')[0];

  // Strip trailing support / special-guest / featuring clauses.
  s = s.replace(/\s*[,;]?\s*(support|special guests?|guests?|feat\.?|ft\.?)\b.*$/i, '');

  // Strip a trailing tour-name clause introduced by " - ".
  // e.g. Sean Paul - Rise Jamaica -> Sean Paul
  s = s.split(/\s+-\s+/)[0];

  // Strip a trailing single-quoted tour name. e.g. Cat Power 'The Greatest Tour'
  s = s.replace(/\s*'[^']*'\s*$/, '');

  // Co-headline bills: split on "+", " x ", and " / " (spaced, so AC/DC and
  // "Of Mice & Men" stay intact — we deliberately never split on "&"/"and"/"y").
  const parts = s.split(/\s*\+\s*|\s+x\s+|\s+\/\s+/i);
  const names = parts.map(cleanToken).filter((n) => n.length > 0);

  return { festival: false, names };
}

interface ArtistRow {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  const slugArgIdx = process.argv.indexOf('--slug');
  const promoterSlug = slugArgIdx >= 0 ? process.argv[slugArgIdx + 1] : 'winiary-bookings';

  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'APPLY (will mutate DB)'}`);
  console.log(`Promoter slug: ${promoterSlug}\n`);

  const promoter = await db.query.artists.findFirst({
    where: eq(artists.slug, promoterSlug),
  });
  if (!promoter) {
    console.error(`No artist found with slug "${promoterSlug}". Nothing to do.`);
    process.exit(1);
  }

  // Promoter's events.
  const promoEvents = await db
    .select({ id: events.id, name: events.name, date: events.eventDate })
    .from(events)
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .where(eq(eventArtists.artistId, promoter.id));

  // Preload every artist for in-memory matching. Maps are kept current as we
  // create rows so duplicate headliners within this run reuse the same artist.
  const allArtists = await db
    .select({ id: artists.id, slug: artists.slug, name: artists.name, isActive: artists.isActive })
    .from(artists);
  const bySlug = new Map<string, ArtistRow>();
  const byLowerName = new Map<string, ArtistRow>();
  for (const a of allArtists) {
    bySlug.set(a.slug, a);
    if (!byLowerName.has(a.name.toLowerCase())) byLowerName.set(a.name.toLowerCase(), a);
  }

  const stats = {
    events: promoEvents.length,
    festivalsSkipped: 0,
    unparseable: 0,
    matched: 0,
    created: 0,
    reactivated: 0,
    linksAdded: 0,
    promoterLinksRemoved: 0,
  };
  const csv: string[] = ['event_name,event_date,outcome,artists'];
  const festivalReview: string[] = [];

  // Resolve a headliner name to an artist id, creating/reactivating as needed.
  async function resolveArtist(name: string): Promise<{ id: string; how: string } | null> {
    const slug = slugify(name);
    if (!slug) return null;

    let match = bySlug.get(slug) ?? byLowerName.get(name.toLowerCase());
    if (match) {
      if (!match.isActive) {
        if (!dryRun) {
          await db.update(artists).set({ isActive: true, updatedAt: new Date() }).where(eq(artists.id, match.id));
        }
        match.isActive = true;
        stats.reactivated++;
        return { id: match.id, how: 'reactivated' };
      }
      stats.matched++;
      return { id: match.id, how: 'matched' };
    }

    // Create a new artist row.
    const id = nanoid();
    const row: ArtistRow = { id, slug, name, isActive: true };
    if (!dryRun) {
      await db
        .insert(artists)
        .values({ id, slug, name, isActive: true })
        .onConflictDoNothing();
    }
    bySlug.set(slug, row);
    byLowerName.set(name.toLowerCase(), row);
    stats.created++;
    return { id, how: 'created' };
  }

  for (const ev of promoEvents) {
    const parsed = parseHeadliners(ev.name);
    const dateStr = ev.date instanceof Date ? ev.date.toISOString().slice(0, 10) : String(ev.date);

    if (parsed.festival) {
      stats.festivalsSkipped++;
      festivalReview.push(`${ev.name} (${dateStr})`);
      csv.push(`"${ev.name.replace(/"/g, '""')}",${dateStr},festival-skip,`);
      continue;
    }
    if (parsed.names.length === 0) {
      stats.unparseable++;
      csv.push(`"${ev.name.replace(/"/g, '""')}",${dateStr},unparseable,`);
      continue;
    }

    const resolvedLabels: string[] = [];
    let attachedAny = false;
    for (const name of parsed.names) {
      const r = await resolveArtist(name);
      if (!r) continue;
      if (r.id === promoter.id) continue; // never re-link the promoter to itself
      if (!dryRun) {
        await db
          .insert(eventArtists)
          .values({ eventId: ev.id, artistId: r.id })
          .onConflictDoNothing();
      }
      stats.linksAdded++;
      attachedAny = true;
      resolvedLabels.push(`${name} [${r.how}]`);
    }

    // Only detach the promoter once a real artist is attached, so we never
    // orphan an event we could not re-attribute.
    if (attachedAny) {
      if (!dryRun) {
        await db
          .delete(eventArtists)
          .where(and(eq(eventArtists.eventId, ev.id), eq(eventArtists.artistId, promoter.id)));
      }
      stats.promoterLinksRemoved++;
    }
    csv.push(`"${ev.name.replace(/"/g, '""')}",${dateStr},reattributed,"${resolvedLabels.join('; ').replace(/"/g, '""')}"`);
  }

  // Deactivate the promoter once its real events are re-attributed.
  let promoterRemaining = 0;
  if (stats.promoterLinksRemoved > 0 || stats.events > 0) {
    const left = await db
      .select({ eventId: eventArtists.eventId })
      .from(eventArtists)
      .where(eq(eventArtists.artistId, promoter.id));
    promoterRemaining = dryRun
      ? stats.events - stats.promoterLinksRemoved
      : left.length;
    if (!dryRun) {
      await db.update(artists).set({ isActive: false, updatedAt: new Date() }).where(eq(artists.id, promoter.id));
    }
  }

  fs.mkdirSync('audit-output', { recursive: true });
  fs.writeFileSync('audit-output/promoter-reattribution.csv', csv.join('\n') + '\n');

  console.log('Summary');
  console.log('-------');
  console.log(`  Promoter events:            ${stats.events}`);
  console.log(`  Reattributed events:        ${stats.promoterLinksRemoved}`);
  console.log(`  Festival events skipped:    ${stats.festivalsSkipped}`);
  console.log(`  Unparseable events:         ${stats.unparseable}`);
  console.log(`  Artist links added:         ${stats.linksAdded}`);
  console.log(`    matched existing artist:  ${stats.matched}`);
  console.log(`    created new artist:       ${stats.created}`);
  console.log(`    reactivated artist:       ${stats.reactivated}`);
  console.log(`  Promoter links removed:     ${stats.promoterLinksRemoved}`);
  console.log(`  Promoter links remaining:   ${promoterRemaining} (festival/unparseable)`);
  console.log(`  Promoter deactivated:       ${dryRun ? 'NO (dry run)' : 'yes (isActive=false)'}`);
  console.log('');
  if (festivalReview.length) {
    console.log('Festival/unparseable events left for manual review:');
    for (const f of festivalReview) console.log(`  - ${f}`);
    console.log('');
  }
  console.log('Wrote audit-output/promoter-reattribution.csv');

  if (dryRun) {
    console.log('\nDRY RUN — no DB writes performed.');
    console.log('Re-run with `npm run reattribute:promoter -- --apply` to mutate.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
