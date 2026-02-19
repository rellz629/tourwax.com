import { config } from 'dotenv';
// Load .env.local BEFORE any other imports
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { nanoid } from 'nanoid';
import { slugify } from '@/lib/slugify';

// Batch 3: 50 more high-profile touring artists across genres
const SEED_ARTISTS = [
  // Pop
  { name: 'Olivia Rodrigo', genre: 'Pop' },
  { name: 'Bruno Mars', genre: 'Pop' },
  { name: 'Lady Gaga', genre: 'Pop' },
  { name: 'P!nk', genre: 'Pop' },
  { name: 'Shawn Mendes', genre: 'Pop' },
  { name: 'Camila Cabello', genre: 'Pop' },
  { name: 'Doja Cat', genre: 'Pop' },

  // Hip-Hop
  { name: 'Travis Scott', genre: 'Hip-Hop' },
  { name: 'J. Cole', genre: 'Hip-Hop' },
  { name: '21 Savage', genre: 'Hip-Hop' },
  { name: 'Future', genre: 'Hip-Hop' },
  { name: 'Nicki Minaj', genre: 'Hip-Hop' },
  { name: 'Megan Thee Stallion', genre: 'Hip-Hop' },
  { name: 'Lil Baby', genre: 'Hip-Hop' },
  { name: 'Playboi Carti', genre: 'Hip-Hop' },

  // R&B
  { name: 'SZA', genre: 'R&B' },
  { name: 'Jhené Aiko', genre: 'R&B' },
  { name: 'Daniel Caesar', genre: 'R&B' },
  { name: 'Summer Walker', genre: 'R&B' },
  { name: 'Brent Faiyaz', genre: 'R&B' },

  // Rock
  { name: 'Imagine Dragons', genre: 'Rock' },
  { name: 'twenty one pilots', genre: 'Rock' },
  { name: 'Arctic Monkeys', genre: 'Rock' },
  { name: 'My Chemical Romance', genre: 'Rock' },
  { name: 'Weezer', genre: 'Rock' },
  { name: 'Queens of the Stone Age', genre: 'Rock' },
  { name: 'The Black Keys', genre: 'Rock' },

  // Country
  { name: 'Kane Brown', genre: 'Country' },
  { name: 'Hardy', genre: 'Country' },
  { name: 'Cody Johnson', genre: 'Country' },
  { name: 'Thomas Rhett', genre: 'Country' },
  { name: 'Megan Moroney', genre: 'Country' },

  // Latin
  { name: 'Daddy Yankee', genre: 'Latin' },
  { name: 'Shakira', genre: 'Latin' },
  { name: 'Ozuna', genre: 'Latin' },
  { name: 'Maluma', genre: 'Latin' },
  { name: 'Becky G', genre: 'Latin' },

  // Alternative/Indie
  { name: 'Radiohead', genre: 'Alternative' },
  { name: 'The 1975', genre: 'Alternative' },
  { name: 'Bon Iver', genre: 'Alternative' },
  { name: 'Phoebe Bridgers', genre: 'Alternative' },
  { name: 'Vampire Weekend', genre: 'Alternative' },
  { name: 'Glass Animals', genre: 'Alternative' },

  // EDM/Electronic
  { name: 'Skrillex', genre: 'EDM' },
  { name: 'Deadmau5', genre: 'EDM' },
  { name: 'Tiësto', genre: 'EDM' },
  { name: 'Diplo', genre: 'EDM' },

  // Metal
  { name: 'Avenged Sevenfold', genre: 'Metal' },
  { name: 'Slipknot', genre: 'Metal' },
  { name: 'Bring Me The Horizon', genre: 'Metal' },
];

async function main() {
  console.log('🌱 Seeding batch 3 artists (50 more)...\n');

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

  console.log(`\n✅ Batch 3 seeding completed! Added: ${added}, Skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
