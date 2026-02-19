import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events, venues, newsArticles } from '@/db/schema';
import { sql } from 'drizzle-orm';

/**
 * Reset database to original state (before Ticketmaster import)
 * This will:
 * 1. Delete all events
 * 2. Delete all venues
 * 3. Delete all news articles
 * 4. Delete all artists
 * 5. Re-seed the original 20 artists
 */

const ORIGINAL_20_ARTISTS = [
  'Taylor Swift',
  'Beyoncé',
  'The Weeknd',
  'Drake',
  'Bad Bunny',
  'Ed Sheeran',
  'Ariana Grande',
  'Justin Bieber',
  'Billie Eilish',
  'Post Malone',
  'Dua Lipa',
  'Harry Styles',
  'Olivia Rodrigo',
  'Travis Scott',
  'Kendrick Lamar',
  'Doja Cat',
  'The Beatles',
  'Queen',
  'Led Zeppelin',
  'Pink Floyd',
];

async function resetDatabase() {
  console.log('🔄 Resetting database to original state...\n');

  // Show current state
  const currentArtists = await db.select({ count: sql<number>`count(*)` }).from(artists);
  const currentEvents = await db.select({ count: sql<number>`count(*)` }).from(events);
  const currentVenues = await db.select({ count: sql<number>`count(*)` }).from(venues);
  const currentNews = await db.select({ count: sql<number>`count(*)` }).from(newsArticles);

  console.log('📊 Current state:');
  console.log(`   Artists: ${currentArtists[0].count}`);
  console.log(`   Events: ${currentEvents[0].count}`);
  console.log(`   Venues: ${currentVenues[0].count}`);
  console.log(`   News: ${currentNews[0].count}\n`);

  // Delete all data
  console.log('🗑️  Deleting all data...');
  await db.delete(newsArticles);
  console.log('   ✓ Deleted all news articles');

  await db.delete(events);
  console.log('   ✓ Deleted all events');

  await db.delete(venues);
  console.log('   ✓ Deleted all venues');

  await db.delete(artists);
  console.log('   ✓ Deleted all artists\n');

  // Re-seed original 20 artists
  console.log('🌱 Re-seeding original 20 artists...\n');

  const { nanoid } = await import('nanoid');

  for (const artistName of ORIGINAL_20_ARTISTS) {
    await db.insert(artists).values({
      id: nanoid(),
      name: artistName,
      genre: null,
      imageUrl: null,
      spotifyId: null,
      ticketmasterId: null,
      bandsintownId: null,
      seatgeekId: null,
      isActive: true,
    });
    console.log(`   ✓ Added ${artistName}`);
  }

  console.log('\n✅ Database reset complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Request Extended Quota Mode for Spotify (see SPOTIFY_SETUP.md)');
  console.log('   2. Once approved, run: npm run import:spotify');
  console.log('   3. Then: npm run fetch:tours');
  console.log('   4. Finally: npm run fetch:news');
}

resetDatabase()
  .catch(console.error)
  .finally(() => process.exit(0));
