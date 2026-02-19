import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { nanoid } from 'nanoid';
import * as fs from 'fs';

/**
 * Import artists from a CSV file
 *
 * CSV Format (with header):
 * name,genre,twitter_handle
 * Taylor Swift,Pop,taylorswift13
 * Drake,Hip-Hop,Drake
 *
 * Usage:
 * 1. Create artists.csv in the project root
 * 2. Run: npm run import:csv
 */

interface CsvArtist {
  name: string;
  genre?: string;
  twitter_handle?: string;
}

function parseCSV(content: string): CsvArtist[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  const artists: CsvArtist[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const artist: CsvArtist = {
      name: values[0],
      genre: values[1] || undefined,
      twitter_handle: values[2] || undefined,
    };

    if (artist.name) {
      artists.push(artist);
    }
  }

  return artists;
}

async function importFromCSV(filePath: string = 'artists.csv') {
  console.log(`📄 Importing artists from ${filePath}...\n`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    console.log('\nCreate a CSV file with this format:');
    console.log('name,genre,twitter_handle');
    console.log('Taylor Swift,Pop,taylorswift13');
    console.log('Drake,Hip-Hop,Drake');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const csvArtists = parseCSV(content);

  console.log(`Found ${csvArtists.length} artists in CSV\n`);

  let added = 0;
  let skipped = 0;

  for (const artist of csvArtists) {
    try {
      await db.insert(artists).values({
        id: nanoid(),
        name: artist.name,
        genre: artist.genre || null,
        imageUrl: null,
        spotifyId: null,
        ticketmasterId: null,
        bandsintownId: null,
        seatgeekId: null,
        isActive: true,
      });
      added++;
      console.log(`  ✓ Added ${artist.name}`);
    } catch (error: any) {
      if (error.code === '23505') {
        skipped++;
        console.log(`  - ${artist.name} (already exists)`);
      } else {
        console.error(`  ✗ Error adding ${artist.name}:`, error);
      }
    }
  }

  console.log(`\n✅ CSV import completed!`);
  console.log(`  Added: ${added} artists`);
  console.log(`  Skipped: ${skipped} artists`);
  console.log(`\nNext steps:`);
  console.log(`  1. Run 'npm run fetch:tours' to get tour dates`);
  console.log(`  2. Run 'npm run fetch:news' to get news articles`);
}

const csvFile = process.argv[2] || 'artists.csv';
importFromCSV(csvFile)
  .catch(console.error)
  .finally(() => process.exit(0));
