import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { nanoid } from 'nanoid';
import { searchArtist } from '@/lib/spotify';
import { slugify } from '@/lib/slugify';

/**
 * Import artists from Spotify by searching for specific artist names
 * This is more reliable than generic search queries
 */

const POPULAR_ARTISTS = [
  // Pop
  'Taylor Swift', 'Ariana Grande', 'Billie Eilish', 'Dua Lipa', 'Olivia Rodrigo',
  'Harry Styles', 'Selena Gomez', 'Miley Cyrus', 'Lady Gaga', 'Katy Perry',
  'Bruno Mars', 'Shawn Mendes', 'Charlie Puth', 'Sam Smith', 'Demi Lovato',

  // Hip-Hop/Rap
  'Drake', 'Kendrick Lamar', 'Travis Scott', 'Post Malone', 'Kanye West',
  'J. Cole', 'Lil Baby', 'DaBaby', '21 Savage', 'Future',
  'Megan Thee Stallion', 'Cardi B', 'Nicki Minaj', 'Doja Cat', 'Tyler, The Creator',

  // R&B
  'The Weeknd', 'SZA', 'H.E.R.', 'Khalid', 'Bryson Tiller',
  'Frank Ocean', 'Jhené Aiko', 'Summer Walker', 'Daniel Caesar', 'Brent Faiyaz',

  // Rock/Alternative
  'Imagine Dragons', 'Twenty One Pilots', 'Foo Fighters', 'Arctic Monkeys', 'The 1975',
  'Green Day', 'Metallica', 'Coldplay', 'Muse', 'Radiohead',

  // Country
  'Morgan Wallen', 'Luke Combs', 'Chris Stapleton', 'Carrie Underwood', 'Luke Bryan',
  'Blake Shelton', 'Thomas Rhett', 'Kane Brown', 'Jason Aldean', 'Miranda Lambert',

  // Latin
  'Bad Bunny', 'J Balvin', 'Karol G', 'Ozuna', 'Maluma',
  'Anuel AA', 'Daddy Yankee', 'Rauw Alejandro', 'Rosalía', 'Peso Pluma',

  // EDM/Electronic
  'The Chainsmokers', 'Calvin Harris', 'Marshmello', 'David Guetta', 'Zedd',
  'Martin Garrix', 'Kygo', 'Diplo', 'Skrillex', 'deadmau5',

  // Classic/Legacy
  'The Beatles', 'Queen', 'Led Zeppelin', 'Pink Floyd', 'The Rolling Stones',
  'Fleetwood Mac', 'AC/DC', 'Nirvana', 'U2', 'Red Hot Chili Peppers',

  // More Recent Pop
  'Sabrina Carpenter', 'Tate McRae', 'Gracie Abrams', 'Conan Gray', 'Reneé Rapp',
  'Laufey', 'Noah Kahan', 'Lewis Capaldi', 'Ed Sheeran', 'Justin Bieber',
];

async function importByName() {
  console.log(`🎵 Importing ${POPULAR_ARTISTS.length} popular artists from Spotify...\n`);

  let added = 0;
  let skipped = 0;
  let notFound = 0;

  for (const artistName of POPULAR_ARTISTS) {
    try {
      console.log(`🔍 Searching for: ${artistName}`);

      const spotifyArtist = await searchArtist(artistName);

      if (!spotifyArtist) {
        console.log(`  ⚠️  Not found on Spotify`);
        notFound++;
        await new Promise(resolve => setTimeout(resolve, 200));
        continue;
      }

      // Insert into database
      await db.insert(artists).values({
        id: nanoid(),
        slug: slugify(spotifyArtist.name),
        name: spotifyArtist.name,
        genre: spotifyArtist.genres?.[0] || null,
        imageUrl: spotifyArtist.images?.[0]?.url || null,
        spotifyId: spotifyArtist.id,
        ticketmasterId: null,
        bandsintownId: null,
        seatgeekId: null,
        isActive: true,
      });

      added++;
      console.log(`  ✓ Added: ${spotifyArtist.name} (${spotifyArtist.genres?.[0] || 'Unknown'})`);

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error: any) {
      if (error.code === '23505') {
        skipped++;
        console.log(`  - Already exists`);
      } else {
        console.error(`  ✗ Error: ${error.message}`);
      }
    }
  }

  console.log(`\n✅ Import completed!`);
  console.log(`  Added: ${added} artists`);
  console.log(`  Skipped (already exist): ${skipped} artists`);
  console.log(`  Not found: ${notFound} artists`);
  console.log(`  Total in database: ${added + 20} artists (including original 20)`);
  console.log(`\n📝 Next steps:`);
  console.log(`  1. Run 'npm run fetch:tours' to get tour dates`);
  console.log(`  2. Run 'npm run fetch:news' to get news articles`);
}

importByName()
  .catch(console.error)
  .finally(() => process.exit(0));
