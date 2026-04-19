import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events, venues, newsArticles, eventArtists } from '@/db/schema';
import { eq, isNotNull, sql } from 'drizzle-orm';

async function showStats() {
  console.log('📊 TourWax Database Statistics\n');
  console.log('='.repeat(50));

  // Total artists
  const totalArtists = await db.select({ count: sql<number>`count(*)` }).from(artists);
  console.log(`\n👤 Artists: ${totalArtists[0].count}`);

  // Active artists
  const activeArtists = await db.select({ count: sql<number>`count(*)` })
    .from(artists)
    .where(eq(artists.isActive, true));
  console.log(`   └─ Active: ${activeArtists[0].count}`);

  // Artists with images
  const artistsWithImages = await db.select({ count: sql<number>`count(*)` })
    .from(artists)
    .where(isNotNull(artists.imageUrl));
  console.log(`   └─ With images: ${artistsWithImages[0].count}`);

  // Artists with Ticketmaster ID
  const artistsWithTM = await db.select({ count: sql<number>`count(*)` })
    .from(artists)
    .where(isNotNull(artists.ticketmasterId));
  console.log(`   └─ With Ticketmaster ID: ${artistsWithTM[0].count}`);

  // Artists with Spotify ID
  const artistsWithSpotify = await db.select({ count: sql<number>`count(*)` })
    .from(artists)
    .where(isNotNull(artists.spotifyId));
  console.log(`   └─ With Spotify ID: ${artistsWithSpotify[0].count}`);

  // Total venues
  const totalVenues = await db.select({ count: sql<number>`count(*)` }).from(venues);
  console.log(`\n🏟️  Venues: ${totalVenues[0].count}`);

  // Total events
  const totalEvents = await db.select({ count: sql<number>`count(*)` }).from(events);
  console.log(`\n🎫 Events: ${totalEvents[0].count}`);

  // Events in the future
  const futureEvents = await db.select({ count: sql<number>`count(*)` })
    .from(events)
    .where(sql`event_date >= NOW()`);
  console.log(`   └─ Upcoming: ${futureEvents[0].count}`);

  // Artists with events
  const artistsWithEvents = await db.select({
    count: sql<number>`count(distinct ${eventArtists.artistId})`
  }).from(eventArtists);
  console.log(`   └─ Artists with events: ${artistsWithEvents[0].count}`);

  // Total news articles
  const totalNews = await db.select({ count: sql<number>`count(*)` }).from(newsArticles);
  console.log(`\n📰 News Articles: ${totalNews[0].count}`);

  // Artists with news
  const artistsWithNews = await db.select({
    count: sql<number>`count(distinct ${newsArticles.artistId})`
  }).from(newsArticles);
  console.log(`   └─ Artists with news: ${artistsWithNews[0].count}`);

  // Top 10 artists by event count
  const topArtists = await db.select({
    artistName: artists.name,
    eventCount: sql<number>`count(${events.id})`,
  })
    .from(events)
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .groupBy(artists.id, artists.name)
    .orderBy(sql`count(${events.id}) desc`)
    .limit(10);

  console.log(`\n🌟 Top 10 Artists by Event Count:`);
  topArtists.forEach((artist, index) => {
    console.log(`   ${index + 1}. ${artist.artistName}: ${artist.eventCount} events`);
  });

  console.log('\n' + '='.repeat(50));
}

showStats()
  .catch(console.error)
  .finally(() => process.exit(0));
