import { TwitterApi } from 'twitter-api-v2';

/**
 * X (Twitter) client for @TourWaxUpdates.
 *
 * Uses OAuth 1.0a user context (required for posting). Pricing is
 * pay-per-use: $0.015 per text-only post, $0.20 per post containing a
 * link (X auto-links bare domains, so avoid them unless intentional).
 */
export function getXClient(): TwitterApi {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = process.env;

  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
    throw new Error(
      'Missing X API credentials. Ensure X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, and X_ACCESS_TOKEN_SECRET are set in .env.local'
    );
  }

  return new TwitterApi({
    appKey: X_API_KEY,
    appSecret: X_API_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_TOKEN_SECRET,
  });
}

export async function postTweet(text: string): Promise<{ id: string; url: string }> {
  if (text.length === 0) {
    throw new Error('Tweet text is empty');
  }
  if (text.length > 280) {
    throw new Error(`Tweet is ${text.length} characters (max 280)`);
  }

  const client = getXClient();
  const result = await client.v2.tweet(text);

  return {
    id: result.data.id,
    url: `https://x.com/TourWaxUpdates/status/${result.data.id}`,
  };
}
