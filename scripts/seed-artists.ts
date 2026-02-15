import { db } from '@/db';
import { artists } from '@/db/schema';
import { nanoid } from 'nanoid';

// Starter list of popular artists across genres
const SEED_ARTISTS = [
  { name: 'Taylor Swift', genre: 'Pop' },
  { name: 'Beyoncé', genre: 'R&B' },
  { name: 'The Weeknd', genre: 'R&B' },
  { name: 'Drake', genre: 'Hip-Hop' },
  { name: 'Bad Bunny', genre: 'Latin' },
  { name: 'Ed Sheeran', genre: 'Pop' },
  { name: 'Coldplay', genre: 'Rock' },
  { name: 'Billie Eilish', genre: 'Pop' },
  { name: 'Harry Styles', genre: 'Pop' },
  { name: 'Dua Lipa', genre: 'Pop' },
  { name: 'Post Malone', genre: 'Hip-Hop' },
  { name: 'Ariana Grande', genre: 'Pop' },
  { name: 'The Rolling Stones', genre: 'Rock' },
  { name: 'Metallica', genre: 'Metal' },
  { name: 'Foo Fighters', genre: 'Rock' },
  { name: 'Green Day', genre: 'Rock' },
  { name: 'Luke Combs', genre: 'Country' },
  { name: 'Morgan Wallen', genre: 'Country' },
  { name: 'Tyler, The Creator', genre: 'Hip-Hop' },
  { name: 'Kendrick Lamar', genre: 'Hip-Hop' },
];

async function main() {
  console.log('🌱 Seeding artists...\n');

  for (const artist of SEED_ARTISTS) {
    try {
      await db.insert(artists).values({
        id: nanoid(),
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
    } catch (error: any) {
      if (error.code === '23505') {
        console.log(`  - ${artist.name} already exists`);
      } else {
        console.error(`  ✗ Error adding ${artist.name}:`, error);
      }
    }
  }

  console.log('\n✅ Artist seeding completed!');
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
