import { config } from 'dotenv';
config({ path: '.env.local' });

async function checkFuture() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  // Get token
  const authResp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });

  const authData = await authResp.json();
  const token = authData.access_token;

  // Get Future artist data
  const artistResp = await fetch('https://api.spotify.com/v1/artists/1RyvyyTE3xzB2ZywiAwp0i', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const artist = await artistResp.json();
  console.log('Future - Spotify Artist Data:');
  console.log('Name:', artist.name);
  console.log('\nImages:');
  artist.images.forEach((img: any, i: number) => {
    console.log(`  ${i + 1}. ${img.width}x${img.height}: ${img.url}`);
  });
}

checkFuture()
  .catch(console.error)
  .finally(() => process.exit(0));
