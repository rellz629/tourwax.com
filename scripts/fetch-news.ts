import { config } from 'dotenv';
// Load .env.local BEFORE any other imports
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, newsArticles, tweets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { fetchArtistNews } from '@/lib/news-api';
import { fetchArtistTweets, ARTIST_TWITTER_HANDLES } from '@/lib/twitter';

async function fetchNewsForArtist(artistId: string, artistName: string) {
  console.log(`\n📰 Fetching news for: ${artistName}`);

  try {
    // Fetch news articles
    const articles = await fetchArtistNews(artistName);

    if (articles.length > 0) {
      // Delete old articles for this artist
      await db.delete(newsArticles).where(eq(newsArticles.artistId, artistId));

      // Insert new articles
      const articlesWithIds = articles.map(article => ({
        ...article,
        id: nanoid(),
        artistId,
      }));

      await db.insert(newsArticles).values(articlesWithIds);
      console.log(`  ✓ Stored ${articles.length} news articles`);
    } else {
      console.log(`  ⚠️  No news articles found`);
    }

    // Fetch tweets if Twitter handle is known
    const twitterHandle = ARTIST_TWITTER_HANDLES[artistName];
    if (twitterHandle) {
      const artistTweets = await fetchArtistTweets(twitterHandle);

      if (artistTweets.length > 0) {
        // Delete old tweets for this artist
        await db.delete(tweets).where(eq(tweets.artistId, artistId));

        // Insert new tweets
        const tweetsWithData = artistTweets.map(tweet => ({
          id: tweet.id,
          artistId,
          tweetText: tweet.text,
          twitterHandle,
          tweetUrl: `https://twitter.com/${twitterHandle}/status/${tweet.id}`,
          publishedAt: new Date(tweet.created_at),
        }));

        await db.insert(tweets).values(tweetsWithData);
        console.log(`  ✓ Stored ${artistTweets.length} tweets from @${twitterHandle}`);
      } else {
        console.log(`  ℹ️  No tweets fetched (check Twitter API access)`);
      }
    } else {
      console.log(`  ℹ️  Twitter handle not configured for ${artistName}`);
    }

  } catch (error) {
    console.error(`  ❌ Error fetching news for ${artistName}:`, error);
  }
}

async function main() {
  console.log('🚀 Starting news and tweets fetch...\n');

  // Get all active artists
  const allArtists = await db.select().from(artists).where(eq(artists.isActive, true));

  console.log(`Found ${allArtists.length} active artists\n`);

  // Process artists sequentially to avoid rate limits
  for (const artist of allArtists) {
    await fetchNewsForArtist(artist.id, artist.name);
    // Delay to avoid hitting API rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ News and tweets fetch completed!');
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
