import { config } from 'dotenv';
config({ path: '.env.local' });

async function testSpotifyAuth() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  console.log('🔐 Testing Spotify Authentication...\n');
  console.log(`Client ID: ${clientId?.substring(0, 10)}...`);
  console.log(`Client Secret: ${clientSecret?.substring(0, 10)}...\n`);

  // Test authentication
  const authResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });

  console.log(`Auth Response Status: ${authResponse.status}`);

  if (!authResponse.ok) {
    const errorText = await authResponse.text();
    console.error('❌ Authentication failed:', errorText);
    return;
  }

  const authData = await authResponse.json();
  console.log('✅ Authentication successful!');
  console.log(`Token: ${authData.access_token.substring(0, 20)}...`);
  console.log(`Expires in: ${authData.expires_in} seconds\n`);

  const token = authData.access_token;

  // Test 1: Search for a specific well-known artist (Taylor Swift)
  console.log('🎤 Test 1: Searching for "Taylor Swift"...');
  const test1 = await fetch('https://api.spotify.com/v1/search?q=Taylor%20Swift&type=artist&limit=1', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log(`Status: ${test1.status}`);
  if (test1.ok) {
    const data1 = await test1.json();
    const artist = data1.artists?.items?.[0];
    if (artist) {
      console.log(`✅ Found: ${artist.name} (Popularity: ${artist.popularity})`);
    } else {
      console.log('❌ No artist found');
    }
  } else {
    const errorText = await test1.text();
    console.log(`❌ Error: ${errorText}`);
  }

  console.log('');

  // Test 2: Search for multiple artists with a simple query
  console.log('🎤 Test 2: Searching for popular artists with "a"...');
  const test2 = await fetch('https://api.spotify.com/v1/search?q=a&type=artist&limit=10', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log(`Status: ${test2.status}`);
  if (test2.ok) {
    const data2 = await test2.json();
    const artists = data2.artists?.items || [];
    console.log(`✅ Found ${artists.length} artists`);
    artists.slice(0, 3).forEach((a: any) => {
      console.log(`  - ${a.name} (Popularity: ${a.popularity})`);
    });
  } else {
    const errorText = await test2.text();
    console.log(`❌ Error: ${errorText}`);
  }

  console.log('');

  // Test 3: Try genre search (this might be the problem)
  console.log('🎤 Test 3: Searching for genre:"pop"...');
  const test3 = await fetch('https://api.spotify.com/v1/search?q=genre%3A%22pop%22&type=artist&limit=10', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log(`Status: ${test3.status}`);
  if (test3.ok) {
    const data3 = await test3.json();
    const artists = data3.artists?.items || [];
    console.log(`✅ Found ${artists.length} artists`);
  } else {
    const errorText = await test3.text();
    console.log(`❌ Error: ${errorText}`);
  }

  console.log('');

  // Test 4: Try year search (this is likely invalid)
  console.log('🎤 Test 4: Searching for year:2020-2026...');
  const test4 = await fetch('https://api.spotify.com/v1/search?q=year%3A2020-2026&type=artist&limit=10', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log(`Status: ${test4.status}`);
  if (test4.ok) {
    const data4 = await test4.json();
    const artists = data4.artists?.items || [];
    console.log(`✅ Found ${artists.length} artists`);
  } else {
    const errorText = await test4.text();
    console.log(`❌ Error: ${errorText}`);
  }
}

testSpotifyAuth()
  .catch(console.error)
  .finally(() => process.exit(0));
