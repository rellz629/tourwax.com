import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, newsArticles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { searchArtist } from '@/lib/spotify';
import { fetchArtistNews } from '@/lib/news-api';

async function fixFuture() {
  console.log('🔧 Fixing Future (rapper)...\n');

  // Get Future's current data
  const [artist] = await db.select()
    .from(artists)
    .where(eq(artists.name, 'Future'));

  if (!artist) {
    console.log('❌ Future not found in database');
    return;
  }

  console.log('Current data:');
  console.log('  ID:', artist.id);
  console.log('  Name:', artist.name);
  console.log('  Image:', artist.imageUrl?.substring(0, 80) + '...');
  console.log('  Spotify ID:', artist.spotifyId);

  // Step 1: Fix the image
  console.log('\n1️⃣ Updating image from Spotify...');

  try {
    const spotifyData = await searchArtist('Future rapper');
    if (spotifyData && spotifyData.images && spotifyData.images.length > 0) {
      const bestImage = spotifyData.images[0].url;

      await db.update(artists)
        .set({
          imageUrl: bestImage,
          spotifyId: spotifyData.id
        })
        .where(eq(artists.id, artist.id));

      console.log('  ✓ Updated to high-res Spotify image');
      console.log('    New image:', bestImage.substring(0, 80) + '...');
    }
  } catch (error) {
    console.log('  ✗ Error updating image:', error);
  }

  // Step 2: Fix the news articles
  console.log('\n2️⃣ Fixing news articles...');

  // Delete current irrelevant news
  const currentNews = await db.select()
    .from(newsArticles)
    .where(eq(newsArticles.artistId, artist.id));

  console.log(`  Found ${currentNews.length} current articles`);
  currentNews.slice(0, 3).forEach(n => {
    console.log(`    - ${n.title.substring(0, 60)}...`);
  });

  // Delete old articles
  await db.delete(newsArticles)
    .where(eq(newsArticles.artistId, artist.id));
  console.log('  ✓ Deleted old articles');

  // Fetch new articles with better search
  console.log('  Fetching new articles with "Future rapper"...');

  try {
    const newArticles = await fetchArtistNews('Future rapper');

    if (newArticles.length > 0) {
      await db.insert(newsArticles).values(
        newArticles.map(article => ({
          ...article,
          artistId: artist.id,
        }))
      );
      console.log(`  ✓ Added ${newArticles.length} relevant articles`);
      newArticles.slice(0, 3).forEach(a => {
        console.log(`    - ${a.title.substring(0, 60)}...`);
      });
    } else {
      console.log('  ⚠️  No articles found with "Future rapper"');
    }
  } catch (error) {
    console.log('  ✗ Error fetching news:', error);
  }

  console.log('\n✅ Future fixes completed!');
}

fixFuture()
  .catch(console.error)
  .finally(() => process.exit(0));
