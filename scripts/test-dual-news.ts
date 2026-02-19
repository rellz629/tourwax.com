import { config } from 'dotenv';
config({ path: '.env.local' });

import { fetchArtistNews } from '@/lib/news-api';

async function testDualNews() {
  console.log('🧪 Testing dual-source news fetching\n');

  const testArtists = ['Future', 'Taylor Swift', 'Bad Bunny'];

  for (const artist of testArtists) {
    console.log(`\n📰 Testing: ${artist}`);
    console.log('='.repeat(50));

    const articles = await fetchArtistNews(artist);

    console.log(`\nFound ${articles.length} total articles:\n`);

    articles.slice(0, 5).forEach((article, i) => {
      console.log(`${i + 1}. [${article.source}] ${article.title.substring(0, 70)}...`);
      console.log(`   ${article.url.substring(0, 80)}...`);
      console.log('');
    });

    // Small delay between artists
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ Test completed!');
}

testDualNews()
  .catch(console.error)
  .finally(() => process.exit(0));
