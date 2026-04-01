import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq, isNull, and } from 'drizzle-orm';

const MB_BASE = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'TourWax/1.0 (https://www.tourwax.com)';

// MusicBrainz requires rate limiting: max 1 request per second
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface MBArtist {
  id: string;
  name: string;
  score: number;
  disambiguation?: string;
  type?: string;
}

interface MBSearchResponse {
  artists: MBArtist[];
  count: number;
}

async function searchArtist(name: string): Promise<string | null> {
  const params = new URLSearchParams({
    query: `artist:"${name}"`,
    fmt: 'json',
    limit: '5',
  });

  const response = await fetch(`${MB_BASE}/artist?${params}`, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`  MusicBrainz error ${response.status} for "${name}"`);
    return null;
  }

  const data: MBSearchResponse = await response.json();
  if (!data.artists || data.artists.length === 0) return null;

  // Find exact name match with highest score
  const exactMatch = data.artists.find(
    a => a.name.toLowerCase() === name.toLowerCase() && a.score >= 90
  );

  if (exactMatch) return exactMatch.id;

  // Fall back to highest scoring result if score >= 95
  if (data.artists[0].score >= 95) return data.artists[0].id;

  return null;
}

async function main() {
  // Get all active artists without a MusicBrainz ID
  const artistsToFetch = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(and(
      eq(artists.isActive, true),
      isNull(artists.musicbrainzId),
    ))
    .orderBy(artists.name);

  console.log(`Found ${artistsToFetch.length} artists without MusicBrainz IDs\n`);

  let found = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < artistsToFetch.length; i++) {
    const artist = artistsToFetch[i];
    const progress = `[${i + 1}/${artistsToFetch.length}]`;

    try {
      const mbid = await searchArtist(artist.name);

      if (mbid) {
        await db
          .update(artists)
          .set({ musicbrainzId: mbid, updatedAt: new Date() })
          .where(eq(artists.id, artist.id));
        console.log(`${progress} ✅ ${artist.name} → ${mbid}`);
        found++;
      } else {
        console.log(`${progress} ❌ ${artist.name} — no match`);
        notFound++;
      }
    } catch (err) {
      console.error(`${progress} ⚠️  ${artist.name} — error:`, (err as Error).message);
      errors++;
    }

    // Rate limit: 1 request per second
    await sleep(1100);
  }

  console.log(`\nDone! Found: ${found}, Not found: ${notFound}, Errors: ${errors}`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
