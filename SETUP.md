# TourWax Setup Guide

## Quick Start

Your TourWax project is ready! Follow these steps to get it running:

### 1. Configure Your Environment Variables

Copy the example file and add your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual credentials:

```env
# Get your Neon connection string from: https://console.neon.tech
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# Your Ticketmaster API key
TICKETMASTER_API_KEY=your_key_here

# Your SeatGeek credentials
SEATGEEK_CLIENT_ID=your_client_id_here
SEATGEEK_CLIENT_SECRET=your_secret_here
```

#### Getting Your Neon Database URL

1. Go to https://console.neon.tech
2. Select your project (or create a new one)
3. Click "Connection Details"
4. Copy the connection string
5. Paste it into `.env.local` as DATABASE_URL

### 2. Set Up the Database

Generate migration files from the schema:
```bash
npm run db:generate
```

Apply migrations to your Neon database:
```bash
npm run db:migrate
```

### 3. Seed Initial Data

Add starter artists to your database:
```bash
npm run seed
```

This adds 20 popular artists across different genres (Taylor Swift, Drake, Metallica, etc.)

### 4. Fetch Tour Data

Pull the latest tour dates from Ticketmaster and SeatGeek:
```bash
npm run fetch:tours
```

This will take a few minutes as it queries both APIs for each artist.

### 5. Start the Dev Server

```bash
npm run dev
```

Visit http://localhost:3000 to see your site!

## What You'll See

- **Homepage** - Featured artists with upcoming tours and a list of coming shows
- **Artists Page** - All artists grouped by genre
- **Artist Detail Pages** - Tour dates, venue info, and ticket links for each artist

## Database Management

View and manage your database with Drizzle Studio:
```bash
npm run db:studio
```

This opens a GUI at http://localhost:4983 where you can:
- Browse all tables
- Run queries
- Edit data manually
- View relationships

## Automation Setup

### Option 1: Vercel Cron (Recommended for Production)

Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/fetch-tours",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Then create the API route at `app/api/cron/fetch-tours/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    await execAsync('tsx scripts/fetch-tours.ts');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
```

### Option 2: GitHub Actions

Create `.github/workflows/fetch-tours.yml`:

```yaml
name: Fetch Tour Data
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:  # Manual trigger

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run fetch:tours
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          TICKETMASTER_API_KEY: ${{ secrets.TICKETMASTER_API_KEY }}
          SEATGEEK_CLIENT_ID: ${{ secrets.SEATGEEK_CLIENT_ID }}
```

## Adding More Artists

You can add artists manually through Drizzle Studio or by creating a script:

```typescript
import { db } from '@/db';
import { artists } from '@/db/schema';
import { nanoid } from 'nanoid';

await db.insert(artists).values({
  id: nanoid(),
  name: 'Artist Name',
  genre: 'Genre',
  isActive: true,
});
```

## Next Steps

1. **Customize the design** - Edit components in `app/` and styles in `app/globals.css`
2. **Add news fetching** - Implement `scripts/fetch-news.ts` using News API or RSS feeds
3. **Set up monitoring** - Add error tracking with Sentry or similar
4. **Configure domain** - Point tourwax.com to your Vercel deployment
5. **Add analytics** - Integrate Google Analytics or Plausible

## Troubleshooting

### Database Connection Issues
- Verify your DATABASE_URL is correct
- Check that your Neon database is active (it auto-pauses on free tier)
- Ensure you're using `?sslmode=require` in the connection string

### API Rate Limits
- Ticketmaster: 5,000 calls/day (free tier)
- SeatGeek: 5,000 calls/day (free tier)
- Add delays between requests in fetch scripts if needed

### No Events Showing
- Run `npm run fetch:tours` to populate data
- Check that artists exist in database (`npm run seed`)
- Verify API keys are correct

## Deployment

Deploy to Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
# Then deploy to production
vercel --prod
```

## Support

For issues or questions:
- Check the README.md
- Review the code comments in `/lib` and `/scripts`
- Test API connections manually using the scripts
