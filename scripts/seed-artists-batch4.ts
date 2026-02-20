import { config } from 'dotenv';
// Load .env.local BEFORE any other imports
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { nanoid } from 'nanoid';
import { slugify } from '@/lib/slugify';

// Batch 4: 50 more high-profile touring artists across genres
const SEED_ARTISTS = [
  // Pop
  { name: 'Katy Perry', genre: 'Pop' },
  { name: 'Miley Cyrus', genre: 'Pop' },
  { name: 'Sam Smith', genre: 'Pop' },
  { name: 'Halsey', genre: 'Pop' },
  { name: 'Benson Boone', genre: 'Pop' },
  { name: 'Jonas Brothers', genre: 'Pop' },
  { name: 'Charlie Puth', genre: 'Pop' },
  { name: 'Sia', genre: 'Pop' },
  { name: 'Lizzo', genre: 'Pop' },
  { name: 'Demi Lovato', genre: 'Pop' },

  // Hip-Hop
  { name: 'Eminem', genre: 'Hip-Hop' },
  { name: 'Cardi B', genre: 'Hip-Hop' },
  { name: 'Lil Uzi Vert', genre: 'Hip-Hop' },
  { name: 'Logic', genre: 'Hip-Hop' },
  { name: '50 Cent', genre: 'Hip-Hop' },
  { name: 'Macklemore', genre: 'Hip-Hop' },

  // R&B
  { name: 'Frank Ocean', genre: 'R&B' },
  { name: 'H.E.R.', genre: 'R&B' },
  { name: 'Khalid', genre: 'R&B' },
  { name: 'John Legend', genre: 'R&B' },

  // Rock
  { name: 'U2', genre: 'Rock' },
  { name: 'Muse', genre: 'Rock' },
  { name: 'The Killers', genre: 'Rock' },
  { name: 'AC/DC', genre: 'Rock' },
  { name: 'Tool', genre: 'Rock' },
  { name: 'Greta Van Fleet', genre: 'Rock' },
  { name: 'The Lumineers', genre: 'Rock' },
  { name: 'System of a Down', genre: 'Metal' },

  // Country
  { name: 'Kenny Chesney', genre: 'Country' },
  { name: 'Jason Aldean', genre: 'Country' },
  { name: 'Eric Church', genre: 'Country' },
  { name: 'Carrie Underwood', genre: 'Country' },
  { name: 'Tim McGraw', genre: 'Country' },

  // Latin
  { name: 'Anuel AA', genre: 'Latin' },
  { name: 'Nicky Jam', genre: 'Latin' },
  { name: 'Romeo Santos', genre: 'Latin' },
  { name: 'Anitta', genre: 'Latin' },
  { name: 'Bad Gyal', genre: 'Latin' },

  // Alternative/Indie
  { name: 'Lana Del Rey', genre: 'Alternative' },
  { name: 'Florence + The Machine', genre: 'Alternative' },
  { name: 'Mac DeMarco', genre: 'Alternative' },
  { name: 'Khruangbin', genre: 'Alternative' },
  { name: 'Beach House', genre: 'Alternative' },

  // EDM/Electronic
  { name: 'David Guetta', genre: 'EDM' },
  { name: 'Martin Garrix', genre: 'EDM' },
  { name: 'Illenium', genre: 'EDM' },
  { name: 'Odesza', genre: 'EDM' },

  // Metal
  { name: 'Iron Maiden', genre: 'Metal' },
  { name: 'Ghost', genre: 'Metal' },
  { name: 'Disturbed', genre: 'Metal' },
];

async function main() {
  console.log('🌱 Seeding batch 4 artists (50 more)...\n');

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

  console.log(`\n✅ Batch 4 seeding completed! Added: ${added}, Skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
