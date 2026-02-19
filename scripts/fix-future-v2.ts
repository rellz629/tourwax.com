import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, newsArticles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchArtistNews } from '@/lib/news-api';

async function fixFuture() {
  console.log('🔧 Fixing Future (rapper) - v2...\n');

  const [artist] = await db.select()
    .from(artists)
    .where(eq(artists.name, 'Future'));

  if (!artist) {
    console.log('❌ Future not found');
    return;
  }

  // Step 1: Get proper artist image from Spotify API directly
  console.log('1️⃣ Getting proper artist photo from Spotify...');

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  // Get access token
  const authResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });

  const authData = await authResponse.json();
  const token = authData.access_token;

  // Get artist data using the Spotify ID we already have
  if (artist.spotifyId) {
    const artistResponse = await fetch(`https://api.spotify.com/v1/artists/${artist.spotifyId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (artistResponse.ok) {
      const artistData = await artistResponse.json();
      if (artistData.images && artistData.images.length > 0) {
        const artistPhoto = artistData.images[0].url;

        await db.update(artists)
          .set({ imageUrl: artistPhoto })
          .where(eq(artists.id, artist.id));

        console.log('  ✓ Updated to artist photo');
        console.log('    New URL:', artistPhoto.substring(0, 80) + '...');
      }
    }
  }

  // Step 2: Try multiple news search strategies
  console.log('\n2️⃣ Fetching relevant news articles...');

  const searchTerms = [
    'Future hip-hop',
    'Future music artist',
    'rapper Future',
  ];

  let allArticles: any[] = [];

  for (const searchTerm of searchTerms) {
    console.log(`  Trying: "${searchTerm}"`);
    try {
      const articles = await fetchArtistNews(searchTerm);
      console.log(`    Found: ${articles.length} articles`);

      // Filter to only include articles that mention "Future" and music-related terms
      const relevant = articles.filter(article => {
        const text = (article.title + ' ' + (article.description || '')).toLowerCase();
        return (
          text.includes('future') &&
          (text.includes('rapper') ||
           text.includes('hip-hop') ||
           text.includes('hip hop') ||
           text.includes('music') ||
           text.includes('album') ||
           text.includes('song') ||
           text.includes('track') ||
           text.includes('concert'))
        );
      });

      console.log(`    Relevant: ${relevant.length} articles`);
      allArticles.push(...relevant);

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`    ✗ Error:`, error);
    }
  }

  // Remove duplicates
  const uniqueArticles = Array.from(
    new Map(allArticles.map(a => [a.url, a])).values()
  );

  console.log(`\n  Total unique relevant articles: ${uniqueArticles.length}`);

  if (uniqueArticles.length > 0) {
    // Delete old articles
    await db.delete(newsArticles)
      .where(eq(newsArticles.artistId, artist.id));

    // Insert new articles
    await db.insert(newsArticles).values(
      uniqueArticles.map(article => ({
        ...article,
        artistId: artist.id,
      }))
    );

    console.log('\n  New articles:');
    uniqueArticles.slice(0, 5).forEach(a => {
      console.log(`    - ${a.title.substring(0, 70)}...`);
    });
  } else {
    console.log('  ⚠️  No relevant articles found');
  }

  console.log('\n✅ Completed!');
}

fixFuture()
  .catch(console.error)
  .finally(() => process.exit(0));
