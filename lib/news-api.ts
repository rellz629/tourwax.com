import type { NewNewsArticle } from '@/db/schema';
import Parser from 'rss-parser';

const NEWS_API_URL = 'https://newsapi.org/v2/everything';
const rssParser = new Parser();

interface NewsApiArticle {
  title: string;
  description?: string;
  url: string;
  urlToImage?: string;
  publishedAt: string;
  source: { name: string };
  author?: string;
}

interface NewsApiResponse {
  status: string;
  articles?: NewsApiArticle[];
  totalResults?: number;
}

// Artists with common names need better search queries
const commonNameArtists: Record<string, string> = {
  'Future': 'Future rapper hip-hop',
  'Queen': 'Queen band music',
  'Muse': 'Muse band music',
  'The 1975': 'The 1975 band music',
};

function isRelevantArticle(title: string, description: string | undefined, artistName: string): boolean {
  const text = (title + ' ' + (description || '')).toLowerCase();
  const artistLower = artistName.toLowerCase();

  // Basic check: article must mention the artist
  if (!text.includes(artistLower)) {
    return false;
  }

  // For common-name artists, require music-related keywords
  const isCommonName = ['future', 'queen', 'muse', 'the 1975'].includes(artistLower);
  if (isCommonName) {
    const musicKeywords = [
      'rapper', 'hip-hop', 'hip hop', 'music', 'album', 'song',
      'track', 'concert', 'tour', 'performance', 'band', 'artist',
      'single', 'release', 'festival', 'show', 'performs'
    ];

    return musicKeywords.some(keyword => text.includes(keyword));
  }

  return true;
}

async function fetchFromNewsAPI(artistName: string): Promise<NewNewsArticle[]> {
  if (!process.env.NEWS_API_KEY) {
    return [];
  }

  try {
    const searchQuery = commonNameArtists[artistName] || artistName;

    const params = new URLSearchParams({
      apiKey: process.env.NEWS_API_KEY,
      q: searchQuery,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: '5', // Reduced since we're combining sources
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });

    const response = await fetch(`${NEWS_API_URL}?${params}`);

    if (!response.ok) {
      return [];
    }

    const data: NewsApiResponse = await response.json();

    if (data.status !== 'ok' || !data.articles) {
      return [];
    }

    return data.articles
      .filter(article =>
        article.title &&
        article.url &&
        article.publishedAt &&
        isRelevantArticle(article.title, article.description, artistName)
      )
      .map(article => ({
        id: '',
        artistId: '',
        title: article.title,
        summary: article.description || null,
        url: article.url,
        source: article.source.name,
        publishedAt: new Date(article.publishedAt),
        imageUrl: article.urlToImage || null,
        author: article.author || null,
      }));
  } catch (error) {
    console.error(`  ❌ NewsAPI error for ${artistName}:`, error);
    return [];
  }
}

async function fetchFromGoogleNewsRSS(artistName: string): Promise<NewNewsArticle[]> {
  try {
    const searchQuery = commonNameArtists[artistName] || artistName;
    // Add "music" or "musician" to help filter for artists
    const enhancedQuery = encodeURIComponent(`${searchQuery} music`);

    const rssUrl = `https://news.google.com/rss/search?q=${enhancedQuery}&hl=en-US&gl=US&ceid=US:en`;

    const feed = await rssParser.parseURL(rssUrl);

    return feed.items
      .filter(item =>
        item.title &&
        item.link &&
        item.pubDate &&
        isRelevantArticle(item.title, item.contentSnippet, artistName)
      )
      .slice(0, 10) // Limit to 10 from Google News
      .map(item => ({
        id: '',
        artistId: '',
        title: item.title!,
        summary: item.contentSnippet || null,
        url: item.link!,
        source: 'Google News',
        publishedAt: new Date(item.pubDate!),
        imageUrl: null,
        author: item.creator || null,
      }));
  } catch (error) {
    console.error(`  ❌ Google News RSS error for ${artistName}:`, error);
    return [];
  }
}

function deduplicateArticles(articles: NewNewsArticle[]): NewNewsArticle[] {
  const seen = new Set<string>();
  const deduplicated: NewNewsArticle[] = [];

  for (const article of articles) {
    // Create a key from URL (primary) or title (fallback)
    const key = article.url.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(article);
    }
  }

  return deduplicated;
}

export async function fetchArtistNews(artistName: string): Promise<NewNewsArticle[]> {
  try {
    console.log(`  Fetching from News API and Google News RSS...`);

    // Fetch from both sources in parallel
    const [newsApiArticles, googleNewsArticles] = await Promise.all([
      fetchFromNewsAPI(artistName),
      fetchFromGoogleNewsRSS(artistName),
    ]);

    console.log(`    News API: ${newsApiArticles.length} articles`);
    console.log(`    Google News: ${googleNewsArticles.length} articles`);

    // Combine and deduplicate
    const allArticles = [...newsApiArticles, ...googleNewsArticles];
    const deduplicated = deduplicateArticles(allArticles);

    // Sort by date (newest first)
    deduplicated.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    // Limit to 15 total articles
    const limited = deduplicated.slice(0, 15);

    console.log(`    Total after dedup: ${limited.length} articles`);

    return limited;
  } catch (error) {
    console.error(`  ❌ Error fetching news for ${artistName}:`, error);
    return [];
  }
}
