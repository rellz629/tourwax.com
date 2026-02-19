import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, newsArticles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchArtistNews } from '@/lib/news-api';

async function refetchNews() {
  console.log('📰 Re-fetching news for Future with improved filtering...\n');

  const [artist] = await db.select()
    .from(artists)
    .where(eq(artists.name, 'Future'));

  if (!artist) {
    console.log('❌ Future not found');
    return;
  }

  // Delete old articles
  await db.delete(newsArticles)
    .where(eq(newsArticles.artistId, artist.id));

  console.log('✓ Deleted old articles');

  // Fetch new articles with improved logic
  const newArticles = await fetchArtistNews('Future');

  console.log(`\nFound ${newArticles.length} relevant articles:`);

  if (newArticles.length > 0) {
    await db.insert(newsArticles).values(
      newArticles.map(article => ({
        ...article,
        artistId: artist.id,
      }))
    );

    newArticles.forEach(a => {
      console.log(`  ✓ ${a.title.substring(0, 70)}...`);
    });
  } else {
    console.log('  ⚠️  No articles found (News API might be at daily limit)');
  }

  console.log('\n✅ Completed!');
}

refetchNews()
  .catch(console.error)
  .finally(() => process.exit(0));
