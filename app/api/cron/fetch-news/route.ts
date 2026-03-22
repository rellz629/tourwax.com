import { NextResponse } from 'next/server';
import { db } from '@/db';
import { artists, newsArticles, tweets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { fetchArtistNews } from '@/lib/news-api';
import { fetchArtistTweets, ARTIST_TWITTER_HANDLES } from '@/lib/twitter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH_SIZE = 5;

async function fetchNewsForArtist(artistId: string, artistName: string) {
  let articlesStored = 0;
  let tweetsStored = 0;

  const articles = await fetchArtistNews(artistName);

  if (articles.length > 0) {
    const articlesWithIds = articles.map(article => ({
      ...article,
      id: nanoid(),
      artistId,
    }));

    await db.transaction(async (tx) => {
      await tx.delete(newsArticles).where(eq(newsArticles.artistId, artistId));
      await tx.insert(newsArticles).values(articlesWithIds);
    });
    articlesStored = articles.length;
  }

  const twitterHandle = ARTIST_TWITTER_HANDLES[artistName];
  if (twitterHandle) {
    const artistTweets = await fetchArtistTweets(twitterHandle);

    if (artistTweets.length > 0) {
      const tweetsWithData = artistTweets.map(tweet => ({
        id: tweet.id,
        artistId,
        tweetText: tweet.text,
        twitterHandle,
        tweetUrl: `https://twitter.com/${twitterHandle}/status/${tweet.id}`,
        publishedAt: new Date(tweet.created_at),
      }));

      await db.transaction(async (tx) => {
        await tx.delete(tweets).where(eq(tweets.artistId, artistId));
        await tx.insert(tweets).values(tweetsWithData);
      });
      tweetsStored = artistTweets.length;
    }
  }

  return { articles: articlesStored, tweets: tweetsStored };
}

async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const allArtists = await db.select().from(artists).where(eq(artists.isActive, true));

    const results = await processBatch(
      allArtists,
      BATCH_SIZE,
      (artist) => fetchNewsForArtist(artist.id, artist.name),
    );

    let processed = 0;
    let totalArticles = 0;
    let totalTweets = 0;
    const errors: string[] = [];

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        processed++;
        totalArticles += result.value.articles;
        totalTweets += result.value.tweets;
      } else {
        errors.push(`${allArtists[idx].name}: ${result.reason}`);
      }
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      processed,
      totalArtists: allArtists.length,
      articlesStored: totalArticles,
      tweetsStored: totalTweets,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      duration: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
