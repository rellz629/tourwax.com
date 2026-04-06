import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events, newsArticles } from '@/db/schema';
import { eq, gte, and, desc, count } from 'drizzle-orm';
import Parser from 'rss-parser';

const rssParser = new Parser();

const TOUR_KEYWORDS = [
  'tour', 'announces', 'announced', 'dates', 'concert', 'tickets',
  'on sale', 'presale', 'farewell', 'reunion', 'residency',
  'festival', 'headline', 'headlining', 'co-headlining',
  'north america', 'world tour', 'summer tour', 'fall tour',
  'spring tour', 'winter tour', 'arena tour', 'stadium tour',
];

interface TrendingResult {
  artistName: string;
  artistSlug: string;
  genre: string | null;
  newsCount: number;
  eventCount: number;
  tourKeywordHits: number;
  topHeadlines: string[];
  score: number;
}

async function findTrending() {
  console.log('🔍 Scanning for trending tour announcements...\n');

  // Get existing blog post slugs to filter out already-covered artists
  const fs = await import('fs');
  const path = await import('path');
  const matter = (await import('gray-matter')).default;
  const blogDir = path.join(process.cwd(), 'content/blog');
  const existingSlugs = new Set<string>();

  for (const file of fs.readdirSync(blogDir).filter(f => f.endsWith('.md'))) {
    const raw = fs.readFileSync(path.join(blogDir, file), 'utf-8');
    const { data } = matter(raw);
    existingSlugs.add(data.slug);
  }

  // Get artists with recent news (last 14 days)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Get news article counts per artist in last 14 days
  const recentNews = await db
    .select({
      artistId: newsArticles.artistId,
      articleCount: count(),
    })
    .from(newsArticles)
    .where(gte(newsArticles.publishedAt, fourteenDaysAgo))
    .groupBy(newsArticles.artistId)
    .orderBy(desc(count()));

  if (recentNews.length === 0) {
    console.log('No recent news found. Run `npm run fetch:news` first.\n');
    return;
  }

  // Get top 50 artists by news volume
  const topArtistIds = recentNews.slice(0, 50).map(r => r.artistId);

  const results: TrendingResult[] = [];

  for (const artistId of topArtistIds) {
    // Get artist info
    const [artist] = await db.select().from(artists).where(eq(artists.id, artistId));
    if (!artist) continue;

    // Check if we already have a blog post about this artist
    const possibleSlug = `${artist.slug}-tour-2026`;
    const alreadyCovered = [...existingSlugs].some(s => s.includes(artist.slug));
    if (alreadyCovered) continue;

    // Get their recent news articles
    const articles = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.artistId, artistId))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(15);

    // Score tour keyword relevance
    let tourKeywordHits = 0;
    const headlines: string[] = [];

    for (const article of articles) {
      const text = `${article.title} ${article.summary || ''}`.toLowerCase();
      const hits = TOUR_KEYWORDS.filter(kw => text.includes(kw)).length;
      tourKeywordHits += hits;
      if (hits > 0) {
        headlines.push(article.title);
      }
    }

    // Get upcoming event count
    const [eventResult] = await db
      .select({ count: count() })
      .from(events)
      .where(and(eq(events.artistId, artistId), gte(events.eventDate, now)));

    const eventCount = eventResult?.count || 0;
    const newsCount = recentNews.find(r => r.artistId === artistId)?.articleCount || 0;

    // Composite score: news buzz + tour keywords + event volume
    const score = (newsCount * 2) + (tourKeywordHits * 3) + Math.min(eventCount, 20);

    if (tourKeywordHits > 0 || newsCount >= 3) {
      results.push({
        artistName: artist.name,
        artistSlug: artist.slug,
        genre: artist.genre,
        newsCount,
        eventCount,
        tourKeywordHits,
        topHeadlines: headlines.slice(0, 3),
        score,
      });
    }
  }

  // Also scan Google News for broad trending tour announcements
  console.log('📡 Checking Google News for trending tour announcements...\n');
  try {
    const queries = [
      'concert tour announced 2026',
      'new tour dates announced music',
      'farewell tour 2026',
      'reunion tour 2026',
    ];

    const googleHeadlines: { title: string; link: string; pubDate: string }[] = [];

    for (const query of queries) {
      try {
        const feed = await rssParser.parseURL(
          `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
        );
        for (const item of feed.items.slice(0, 5)) {
          if (item.title && item.link && item.pubDate) {
            googleHeadlines.push({
              title: item.title,
              link: item.link,
              pubDate: item.pubDate,
            });
          }
        }
        await new Promise(r => setTimeout(r, 500));
      } catch {
        // Skip failed RSS queries
      }
    }

    if (googleHeadlines.length > 0) {
      console.log('── Google News Trending Headlines ──');
      const seen = new Set<string>();
      for (const h of googleHeadlines) {
        if (seen.has(h.title)) continue;
        seen.add(h.title);
        const date = new Date(h.pubDate).toLocaleDateString();
        console.log(`  ${date}  ${h.title}`);
      }
      console.log('');
    }
  } catch {
    console.log('  (Google News scan skipped)\n');
  }

  // Sort by score and display
  results.sort((a, b) => b.score - a.score);

  if (results.length === 0) {
    console.log('No uncovered trending artists found. Your blog is up to date!\n');
    return;
  }

  console.log('── Top Trending Artists (Not Yet Covered) ──\n');
  console.log(`${'Rank'.padEnd(5)} ${'Artist'.padEnd(28)} ${'Genre'.padEnd(12)} ${'News'.padEnd(6)} ${'Keywords'.padEnd(9)} ${'Events'.padEnd(8)} Score`);
  console.log('─'.repeat(85));

  for (let i = 0; i < Math.min(results.length, 20); i++) {
    const r = results[i];
    console.log(
      `${String(i + 1).padEnd(5)} ${r.artistName.padEnd(28)} ${(r.genre || 'N/A').padEnd(12)} ${String(r.newsCount).padEnd(6)} ${String(r.tourKeywordHits).padEnd(9)} ${String(r.eventCount).padEnd(8)} ${r.score}`
    );
    if (r.topHeadlines.length > 0) {
      for (const h of r.topHeadlines) {
        console.log(`      └─ ${h.substring(0, 78)}`);
      }
    }
  }

  console.log(`\n📝 To generate a blog draft, run:`);
  console.log(`   npx dotenv -e .env.local -- tsx scripts/generate-blog-draft.ts <artist-slug>\n`);
  console.log(`   Example: npx dotenv -e .env.local -- tsx scripts/generate-blog-draft.ts ${results[0]?.artistSlug || 'artist-name'}\n`);
}

findTrending()
  .catch(console.error)
  .finally(() => process.exit(0));
