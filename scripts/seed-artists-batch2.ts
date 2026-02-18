import { config } from 'dotenv';
// Load .env.local BEFORE any other imports
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { nanoid } from 'nanoid';
import { slugify } from '@/lib/slugify';

// Batch 2: 50 more high-profile artists across genres
const SEED_ARTISTS = [
  // Pop
  { name: 'Adele', genre: 'Pop' },
  { name: 'Justin Bieber', genre: 'Pop' },
  { name: 'Sabrina Carpenter', genre: 'Pop' },
  { name: 'Chappell Roan', genre: 'Pop' },
  { name: 'Tate McRae', genre: 'Pop' },
  { name: 'Lil Nas X', genre: 'Pop' },
  { name: 'Gracie Abrams', genre: 'Pop' },
  { name: 'Reneé Rapp', genre: 'Pop' },

  // Hip-Hop
  { name: 'Lil Wayne', genre: 'Hip-Hop' },
  { name: 'A$AP Rocky', genre: 'Hip-Hop' },
  { name: 'Childish Gambino', genre: 'Hip-Hop' },
  { name: 'Ice Spice', genre: 'Hip-Hop' },
  { name: 'Jack Harlow', genre: 'Hip-Hop' },
  { name: 'Central Cee', genre: 'Hip-Hop' },
  { name: 'GloRilla', genre: 'Hip-Hop' },
  { name: 'Wiz Khalifa', genre: 'Hip-Hop' },
  { name: 'Metro Boomin', genre: 'Hip-Hop' },
  { name: 'Gunna', genre: 'Hip-Hop' },

  // R&B
  { name: 'Chris Brown', genre: 'R&B' },
  { name: 'Usher', genre: 'R&B' },
  { name: 'Kehlani', genre: 'R&B' },
  { name: 'Lucky Daye', genre: 'R&B' },

  // Rock
  { name: 'Red Hot Chili Peppers', genre: 'Rock' },
  { name: 'Blink-182', genre: 'Rock' },
  { name: 'Paramore', genre: 'Rock' },
  { name: 'Pearl Jam', genre: 'Rock' },
  { name: 'Linkin Park', genre: 'Rock' },
  { name: 'Fall Out Boy', genre: 'Rock' },

  // Country
  { name: 'Chris Stapleton', genre: 'Country' },
  { name: 'Zach Bryan', genre: 'Country' },
  { name: 'Jelly Roll', genre: 'Country' },
  { name: 'Lainey Wilson', genre: 'Country' },
  { name: 'Bailey Zimmerman', genre: 'Country' },

  // Latin
  { name: 'Karol G', genre: 'Latin' },
  { name: 'Peso Pluma', genre: 'Latin' },
  { name: 'Rauw Alejandro', genre: 'Latin' },
  { name: 'Feid', genre: 'Latin' },
  { name: 'J Balvin', genre: 'Latin' },

  // Alternative
  { name: 'Tame Impala', genre: 'Alternative' },
  { name: 'Hozier', genre: 'Alternative' },
  { name: 'Noah Kahan', genre: 'Alternative' },
  { name: 'Cigarettes After Sex', genre: 'Alternative' },
  { name: 'Mitski', genre: 'Alternative' },
  { name: 'Laufey', genre: 'Alternative' },

  // EDM
  { name: 'The Chainsmokers', genre: 'EDM' },
  { name: 'Calvin Harris', genre: 'EDM' },
  { name: 'Marshmello', genre: 'EDM' },
  { name: 'Zedd', genre: 'EDM' },

  // Other
  { name: 'Gorillaz', genre: 'Alternative' },
  { name: 'Justin Timberlake', genre: 'Pop' },
];

async function main() {
  console.log('🌱 Seeding batch 2 artists (50 more)...\n');

  let added = 0;
  let skipped = 0;

  for (const artist of SEED_ARTISTS) {
    try {
      await db.insert(artists).values({
        id: nanoid(),
        slug: slugify(artist.name),
        name: artist.name,
        genre: artist.genre,
        imageUrl: null,
        spotifyId: null,
        ticketmasterId: null,
        bandsintownId: null,
        seatgeekId: null,
        isActive: true,
      });
      console.log(`  ✓ Added ${artist.name}`);
      added++;
    } catch (error: any) {
      if (error.code === '23505') {
        console.log(`  - ${artist.name} already exists`);
        skipped++;
      } else {
        console.error(`  ✗ Error adding ${artist.name}:`, error);
      }
    }
  }

  console.log(`\n✅ Batch 2 seeding completed! Added: ${added}, Skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
