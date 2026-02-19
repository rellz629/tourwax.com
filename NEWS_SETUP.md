# News & Twitter/X Integration Setup

This guide explains how to set up news article fetching and Twitter/X feeds for your artists.

## News API Setup

### 1. Get Your News API Key

1. Visit [https://newsapi.org/](https://newsapi.org/)
2. Click "Get API Key" and sign up for a free account
3. Copy your API key from the dashboard

### 2. Free Tier Limits

- **100 requests per day**
- **News from last 30 days**
- Perfect for testing and small-scale projects

For production with 20 artists, fetching once per day uses 20 requests/day (well within limits).

### 3. Add to Environment Variables

Open `.env.local` and add:

```env
NEWS_API_KEY=your_news_api_key_here
```

### 4. Test News Fetching

```bash
npm run fetch:news
```

This will fetch the latest news articles for all artists and store them in your database.

---

## Twitter/X Integration (Using Free Embed Widgets)

TourWax uses **free Twitter embed widgets** instead of the expensive Twitter API ($100/month). This gives you live Twitter feeds at no cost!

### How It Works

Twitter's embed widgets are loaded via JavaScript and display the latest tweets from each artist automatically. No API key needed!

### Already Configured

✅ All 20 artists have Twitter handles configured
✅ Widget automatically loads on artist pages
✅ Shows 5 most recent tweets per artist
✅ Always up-to-date (no manual updates needed)
✅ Completely free!

### What Users See

- Live Twitter timeline on each artist's page
- Latest 5 tweets with images, videos, links
- Direct links to view tweets on Twitter
- Fully responsive and mobile-friendly

---

## ~~Twitter/X API Setup~~ (Not Needed - Using Free Embeds Instead)

### 1. Get Twitter Developer Access

1. Visit [https://developer.twitter.com/](https://developer.twitter.com/)
2. Sign up for a Developer Account (requires Twitter/X account)
3. Create a new Project and App
4. Navigate to "Keys and Tokens"
5. Generate a **Bearer Token**

### 2. API Tier Options

**Free Tier ($0/month):**
- 1,500 tweets read per month
- 50 tweets write per month
- Good for: Testing only (1,500 / 20 artists = 75 tweets per artist per month)

**Basic Tier ($100/month):**
- 10,000 tweets read per month
- 1,000 tweets write per month
- Good for: Small-scale production (500 tweets per artist per month)

**Pro Tier ($5,000/month):**
- 1,000,000 tweets read per month
- Full API access
- Good for: Enterprise-scale

### 3. Add to Environment Variables

Open `.env.local` and add:

```env
TWITTER_BEARER_TOKEN=your_bearer_token_here
```

### 4. Configure Artist Twitter Handles

Twitter handles are already configured in `/lib/twitter.ts` for all seeded artists:

```typescript
{
  'Taylor Swift': 'taylorswift13',
  'Drake': 'Drake',
  'Beyoncé': 'Beyonce',
  // ... etc
}
```

To add more artists, edit this file or store handles in the database.

### 5. Test Twitter Fetching

```bash
npm run fetch:news
```

This will fetch both news articles AND tweets for all artists.

---

## Alternatives to Twitter API

If Twitter API costs are prohibitive, consider these alternatives:

### Option 1: Twitter RSS Bridge (Free)

Use [RSS Bridge](https://github.com/RSS-Bridge/rss-bridge) to create RSS feeds from Twitter profiles without API access.

- Self-hosted or use public instances
- No API key needed
- May be against Twitter's ToS

### Option 2: Manual Curation

- Manually add important tweets to the database
- Use Drizzle Studio: `npm run db:studio`
- Good for highlighting key announcements only

### Option 3: Embed Twitter Widget

Instead of fetching via API, embed Twitter's official timeline widget:

```html
<a class="twitter-timeline"
   href="https://twitter.com/artisthandle"
   data-tweet-limit="5">
   Tweets by @artisthandle
</a>
<script async src="https://platform.twitter.com/widgets.js"></script>
```

Pros: Free, no API needed, always up-to-date
Cons: Less control, requires client-side JavaScript

---

## Automation Setup

### Cron Schedule Recommendations

**News Fetching:**
- Run every 12-24 hours
- News API free tier: 100 requests/day
- 20 artists = 20 requests (leaves room for growth)

**Twitter Fetching:**
- Run every 6-12 hours (if using paid tier)
- Free tier: Too limited for automated fetching (manual updates recommended)

### Vercel Cron Example

Create `app/api/cron/fetch-news/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    await execAsync('npm run fetch:news');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
```

Then in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/fetch-news",
      "schedule": "0 */12 * * *"
    }
  ]
}
```

---

## Cost Estimation

### News API
- **Free tier**: $0/month (100 requests/day)
- **Paid**: $449/month (unlimited requests)

For 20 artists fetching once/day: **Free tier is sufficient**

### Twitter API
- **Free tier**: $0/month (1,500 tweets/month) - Testing only
- **Basic tier**: $100/month (10,000 tweets/month) - Small production
- **Pro tier**: $5,000/month - Enterprise

**Recommendation for TourWax:**
- Start with News API (free tier)
- Skip Twitter API initially or use embed widgets
- Add Twitter API later when revenue justifies cost

---

## Testing

### Test News Fetching

```bash
# Fetch news for all artists
npm run fetch:news

# Check database
npm run db:studio
# Navigate to news_articles and tweets tables
```

### Verify on Site

1. Visit http://localhost:3000
2. Click on any artist with events (e.g., The Weeknd)
3. Scroll to sidebar - you should see:
   - Latest news articles (if NEWS_API_KEY is set)
   - Latest tweets (if TWITTER_BEARER_TOKEN is set)

---

## Troubleshooting

### "No news articles found"
- Check NEWS_API_KEY is set correctly
- Verify artist name spelling matches news sources
- Some artists may not have recent news coverage

### "No tweets fetched"
- Check TWITTER_BEARER_TOKEN is set correctly
- Verify Twitter handle exists in ARTIST_TWITTER_HANDLES
- Check Twitter API rate limits (might be exhausted on free tier)

### Rate Limit Errors
- News API: Wait 24 hours or upgrade to paid tier
- Twitter API: Wait for limit reset or upgrade tier
- Add delays between requests in fetch script (already implemented)

---

## Next Steps

1. Get News API key (free): https://newsapi.org/register
2. Add to .env.local
3. Run `npm run fetch:news`
4. Check your artist pages for news articles
5. (Optional) Get Twitter API access for tweet feeds
6. Set up automated fetching with Vercel Cron
