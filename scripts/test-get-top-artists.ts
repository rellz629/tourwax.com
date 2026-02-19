import { config } from 'dotenv';
config({ path: '.env.local' });

import { getTopArtists } from '@/lib/spotify';

async function test() {
  console.log('Testing getTopArtists function...\n');

  try {
    const artists = await getTopArtists(10);
    console.log(`\n✅ Success! Found ${artists.length} artists`);
    console.log('\nFirst 5 artists:');
    artists.slice(0, 5).forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.name} (Popularity: ${a.popularity})`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

test().finally(() => process.exit(0));
