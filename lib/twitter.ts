// Twitter/X API integration for artist tweets

/**
 * IMPORTANT: To use this feature, you need:
 *
 * 1. Twitter Developer Account (https://developer.twitter.com)
 * 2. Create a Project and App
 * 3. Get your API credentials:
 *    - API Key (Consumer Key)
 *    - API Secret (Consumer Secret)
 *    - Bearer Token (for app-only authentication)
 *
 * 4. Add to .env.local:
 *    TWITTER_BEARER_TOKEN=your_bearer_token_here
 *
 * Twitter API Tiers:
 * - Free: Very limited (1,500 tweets/month)
 * - Basic ($100/month): 10,000 tweets/month
 * - Pro ($5,000/month): 1M tweets/month
 *
 * For a small-scale project, the Free tier may work if you fetch infrequently.
 */

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id?: string;
}

interface TwitterApiResponse {
  data?: Tweet[];
  meta?: {
    result_count: number;
  };
}

export async function fetchArtistTweets(twitterHandle: string): Promise<any[]> {
  if (!process.env.TWITTER_BEARER_TOKEN) {
    console.log('  ℹ️  TWITTER_BEARER_TOKEN not set, skipping tweets fetch');
    return [];
  }

  try {
    // First, get the user ID from the handle
    const userResponse = await fetch(
      `https://api.twitter.com/2/users/by/username/${twitterHandle}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
        },
      }
    );

    if (!userResponse.ok) {
      throw new Error(`Twitter API error: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    const userId = userData.data?.id;

    if (!userId) {
      return [];
    }

    // Get recent tweets from this user
    const tweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=10&tweet.fields=created_at`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
        },
      }
    );

    if (!tweetsResponse.ok) {
      throw new Error(`Twitter API error: ${tweetsResponse.status}`);
    }

    const tweetsData: TwitterApiResponse = await tweetsResponse.json();

    return tweetsData.data || [];
  } catch (error) {
    console.error(`  ❌ Error fetching tweets for @${twitterHandle}:`, error);
    return [];
  }
}

/**
 * Artist Twitter handles mapping
 * You can expand this list or store it in the database
 */
export const ARTIST_TWITTER_HANDLES: Record<string, string> = {
  // Pop
  'Taylor Swift': 'taylorswift13',
  'Ariana Grande': 'ArianaGrande',
  'Billie Eilish': 'billieeilish',
  'Dua Lipa': 'DUALIPA',
  'Harry Styles': 'Harry_Styles',
  'Selena Gomez': 'selenagomez',
  'Miley Cyrus': 'MileyCyrus',
  'Katy Perry': 'katyperry',
  'Lady Gaga': 'ladygaga',
  'Demi Lovato': 'ddlovato',
  'Olivia Rodrigo': 'oliviarodrigo',
  'Ed Sheeran': 'edsheeran',
  'Bruno Mars': 'BrunoMars',
  'Shawn Mendes': 'ShawnMendes',
  'Charlie Puth': 'charlieputh',
  'Sam Smith': 'samsmith',

  // Hip-Hop/Rap
  'Drake': 'Drake',
  'Kendrick Lamar': 'kendricklamar',
  'Travis Scott': 'trvisXX',
  'Kanye West': 'kanyewest',
  'J. Cole': 'JColeNC',
  'Lil Baby': 'lilbaby4PF',
  '21 Savage': '21savage',
  'Cardi B': 'iamcardib',
  'Nicki Minaj': 'NICKIMINAJ',
  'Doja Cat': 'DojaCat',
  'Post Malone': 'PostMalone',
  'DaBaby': 'DaBabyDaBaby',
  'Megan Thee Stallion': 'theestallion',
  'Future': 'future',
  'Tyler, The Creator': 'tylerthecreator',

  // R&B/Soul
  'The Weeknd': 'theweeknd',
  'SZA': 'sza',
  'H.E.R.': 'HERMusicx',
  'Khalid': 'thegreatkhalid',
  'Frank Ocean': 'frank_ocean',
  'Summer Walker': 'SUMMERWALK3R',
  'Daniel Caesar': 'danielcaesar',
  'Brent Faiyaz': 'brentfaiyaz',
  'Jhené Aiko': 'JheneAiko',
  'Bryson Tiller': 'brysontiller',

  // Rock/Alternative
  'Coldplay': 'coldplay',
  'Imagine Dragons': 'Imaginedragons',
  'Foo Fighters': 'foofighters',
  'Arctic Monkeys': 'ArcticMonkeys',
  'The 1975': 'the1975',
  'Twenty One Pilots': 'twentyonepilots',
  'Green Day': 'GreenDay',
  'Metallica': 'Metallica',
  'Muse': 'muse',

  // Other
  'Bad Bunny': 'sanbenito',
  'Beyoncé': 'Beyonce',
  'The Rolling Stones': 'RollingStones',
  'Luke Combs': 'lukecombs',
  'Morgan Wallen': 'MorganWallen',
};
