/**
 * Spotify API Integration for Artist Discovery
 *
 * Setup:
 * 1. Go to https://developer.spotify.com/dashboard
 * 2. Create an app
 * 3. Get Client ID and Client Secret
 * 4. Add to .env.local:
 *    SPOTIFY_CLIENT_ID=your_client_id
 *    SPOTIFY_CLIENT_SECRET=your_client_secret
 */

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyArtist {
  id: string;
  name: string;
  images: Array<{ url: string; height: number; width: number }>;
  genres: string[];
  popularity: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Spotify auth error: ${response.status}`);
  }

  const data: SpotifyTokenResponse = await response.json();

  // Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000) - 60000, // Expire 1 min early
  };

  return data.access_token;
}

export async function searchArtist(artistName: string): Promise<SpotifyArtist | null> {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    q: artistName,
    type: 'artist',
    limit: '1',
  });

  const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const artist = data.artists?.items?.[0];

  return artist || null;
}

export async function getTopArtistsByGenre(
  genre: string,
  limit: number = 50
): Promise<SpotifyArtist[]> {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    q: `genre:"${genre}"`,
    type: 'artist',
    limit: limit.toString(),
  });

  const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  const data = await response.json();
  return data.artists?.items || [];
}

export async function getTopArtists(limit: number = 50): Promise<SpotifyArtist[]> {
  const token = await getAccessToken();

  // Limit must be between 1-50 for Spotify search API
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  const url = `https://api.spotify.com/v1/search?q=a&type=artist&limit=${safeLimit}`;
  console.log('Search URL:', url);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Spotify API error details:', errorData);
    throw new Error(`Spotify API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const artists = data.artists?.items || [];

  // Sort by popularity (highest first) and return top results
  // Note: Some artists may have undefined popularity
  return artists.sort((a: SpotifyArtist, b: SpotifyArtist) =>
    (b.popularity || 0) - (a.popularity || 0)
  );
}

/**
 * Common music genres for discovery
 */
export const GENRES = [
  'pop',
  'rock',
  'hip-hop',
  'country',
  'r-n-b',
  'electronic',
  'indie',
  'metal',
  'alternative',
  'latin',
  'jazz',
  'blues',
  'reggae',
  'folk',
  'punk',
];
