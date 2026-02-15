# TourWax

A live music tour dates and news aggregation platform built with Next.js, TypeScript, and Neon Postgres.

## Features

- 🎵 **Automatic Tour Date Updates** - Fetches tour dates from Ticketmaster and SeatGeek APIs
- 📰 **Artist News Aggregation** - (Coming soon) Automated news fetching for each artist
- 🗺️ **Venue Information** - Detailed venue data including location, capacity, and links
- 🔄 **Scheduled Updates** - Automated data refresh via cron jobs
- ⚡ **Fast Performance** - Built on Next.js 15 with ISR and edge optimization
- 💾 **Serverless Database** - Powered by Neon's serverless Postgres

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Database**: Neon Postgres (serverless)
- **ORM**: Drizzle ORM
- **APIs**: Ticketmaster Discovery API, SeatGeek API
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Neon account and database (free tier available at [neon.tech](https://neon.tech))
- API keys for Ticketmaster and/or SeatGeek

### Installation

1. Clone or navigate to the repository:
```bash
cd tourwax.com
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your credentials:
```env
DATABASE_URL=your_neon_database_connection_string
TICKETMASTER_API_KEY=your_ticketmaster_api_key
SEATGEEK_CLIENT_ID=your_seatgeek_client_id
SEATGEEK_CLIENT_SECRET=your_seatgeek_client_secret
```

4. Generate and run database migrations:
```bash
npm run db:generate
npm run db:migrate
```

5. Seed the database with initial artists:
```bash
npm run seed
```

6. Fetch initial tour data:
```bash
npm run fetch:tours
```

7. Start the development server:
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the site.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Drizzle migrations from schema
- `npm run db:migrate` - Apply migrations to database
- `npm run db:studio` - Open Drizzle Studio (database GUI)
- `npm run fetch:tours` - Manually fetch tour dates for all artists
- `npm run fetch:news` - (Coming soon) Fetch news articles

## Database Schema

### Tables

- **artists** - Artist profiles with external API IDs
- **venues** - Venue information including location and capacity
- **events** - Concert/tour events linking artists to venues
- **news_articles** - News articles associated with artists

## Automation

For production, set up cron jobs or scheduled functions to run:

- `npm run fetch:tours` - Every 4-6 hours
- `npm run fetch:news` - Every 6-12 hours (when implemented)

### Vercel Cron (Recommended)

Add to `vercel.json`:
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

## Getting API Keys

### Ticketmaster
1. Visit [Ticketmaster Developer Portal](https://developer.ticketmaster.com/)
2. Create an account and request an API key
3. Free tier: 5,000 API calls per day

### SeatGeek
1. Visit [SeatGeek Developer](https://seatgeek.com/account/develop)
2. Register an application
3. Copy your Client ID

## Deployment

Recommended: Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy

## Roadmap

- [ ] News aggregation implementation
- [ ] User accounts and favorites
- [ ] Email alerts for new tour dates
- [ ] Price tracking and alerts
- [ ] Mobile app
- [ ] Advanced search and filtering

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
