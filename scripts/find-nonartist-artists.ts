/**
 * Read-only sweep that surfaces active `artists` rows that are probably NOT real
 * performing artists — promoters, booking agencies, festival brands, venues —
 * so they can be re-attributed (scripts/reattribute-promoter-events.ts) or
 * deactivated (scripts/deactivate-junk-artists.ts).
 *
 * Two independent signals:
 *   A. Name match     — isLikelyNonArtist() / nonArtistReason() from
 *      lib/non-artist (catches "...Bookings", "...Festival", tributes).
 *   B. Name-mismatch  — a promoter's events are named after OTHER artists, so
 *      the events almost never contain the promoter's own name. "Winiary
 *      Bookings" headlined 0 of its 175 events. A real touring artist headlines
 *      most of theirs, so its name appears in most event titles. We flag active
 *      artists with many upcoming events whose name matches a low fraction of
 *      those event titles. (A no-Spotify/no-bio heuristic was tried and
 *      discarded — most rows in this DB lack a Spotify id, so it flagged real
 *      artists like Foreigner and Wu-Tang Clan.)
 *
 * Writes audit-output/nonartist-suspects.csv. Makes NO database writes.
 *
 * Run:
 *   npm run find:nonartists
 *   npm run find:nonartists -- --min-events 25 --max-match 0.15
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events, eventArtists } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { slugify } from '@/lib/slugify';
import { nonArtistReason } from '@/lib/non-artist';
import fs from 'fs';

/** Does an event title contain the artist's name as a whole hyphen-delimited run? */
function titleMatchesArtist(artistSlug: string, eventName: string): boolean {
  if (!artistSlug) return false;
  const eventSlug = slugify(eventName);
  if (!eventSlug) return false;
  return (`-${eventSlug}-`).includes(`-${artistSlug}-`);
}

async function main() {
  const minArgIdx = process.argv.indexOf('--min-events');
  const minEvents = minArgIdx >= 0 ? parseInt(process.argv[minArgIdx + 1], 10) : 15;
  const maxArgIdx = process.argv.indexOf('--max-match');
  const maxMatch = maxArgIdx >= 0 ? parseFloat(process.argv[maxArgIdx + 1]) : 0.2;

  // Active artists with their upcoming-event counts and the event titles.
  const rows = await db
    .select({
      id: artists.id,
      slug: artists.slug,
      name: artists.name,
      upcoming: sql<number>`count(${events.id}) filter (where ${events.eventDate} >= now())::int`,
      eventNames: sql<string[]>`coalesce(array_agg(${events.name}) filter (where ${events.eventDate} >= now()), '{}')`,
    })
    .from(artists)
    .leftJoin(eventArtists, eq(eventArtists.artistId, artists.id))
    .leftJoin(events, eq(events.id, eventArtists.eventId))
    .where(eq(artists.isActive, true))
    .groupBy(artists.id, artists.slug, artists.name);

  interface Suspect {
    slug: string;
    name: string;
    upcoming: number;
    matchRatio: number;
    reasons: string[];
  }
  const suspects: Suspect[] = [];

  for (const r of rows) {
    const reasons: string[] = [];
    const nameReason = nonArtistReason(r.name);
    if (nameReason) reasons.push(`name:${nameReason}`);

    const names = r.eventNames ?? [];
    const matches = names.filter((n) => titleMatchesArtist(r.slug, n)).length;
    const matchRatio = names.length > 0 ? matches / names.length : 1;
    if (r.upcoming >= minEvents && matchRatio < maxMatch) {
      reasons.push(`name-mismatch:${matches}/${names.length}-titles-match`);
    }

    if (reasons.length) {
      suspects.push({ slug: r.slug, name: r.name, upcoming: r.upcoming, matchRatio, reasons });
    }
  }

  suspects.sort((a, b) => a.matchRatio - b.matchRatio || b.upcoming - a.upcoming);

  const csv = ['slug,name,upcoming_events,match_ratio,reasons'];
  for (const s of suspects) {
    csv.push(`${s.slug},"${s.name.replace(/"/g, '""')}",${s.upcoming},${s.matchRatio.toFixed(3)},"${s.reasons.join('; ')}"`);
  }
  fs.mkdirSync('audit-output', { recursive: true });
  fs.writeFileSync('audit-output/nonartist-suspects.csv', csv.join('\n') + '\n');

  console.log(`Scanned ${rows.length} active artists (min-events: ${minEvents}, max-match: ${maxMatch})\n`);
  console.log(`Found ${suspects.length} suspect(s):\n`);
  for (const s of suspects.slice(0, 40)) {
    console.log(`  ${String(s.upcoming).padStart(4)} ev  ${(s.matchRatio * 100).toFixed(0).padStart(3)}% match  ${s.slug}  (${s.name})  [${s.reasons.join(', ')}]`);
  }
  if (suspects.length > 40) console.log(`  ... and ${suspects.length - 40} more (see CSV)`);
  console.log(`\nWrote audit-output/nonartist-suspects.csv`);
  console.log('Read-only — no DB writes. Review, then re-attribute or deactivate as appropriate.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
