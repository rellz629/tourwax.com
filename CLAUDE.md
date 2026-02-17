# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TourWax is a live music tour dates and news aggregation platform built with Next.js 15, TypeScript, and Neon Postgres. It fetches tour data from Ticketmaster and SeatGeek APIs, aggregates artist news, and displays events with venue information.

## Development Commands

### Core Development
```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production
npm run lint         # Run ESLint
```

### Database Management
```bash
npm run db:generate  # Generate Drizzle migrations from schema changes in db/schema.ts
npm run db:migrate   # Apply migrations to database
npm run db:studio    # Open Drizzle Studio GUI for database inspection
```

### Data Operations
```bash
npm run seed                # Seed database with initial artists
npm run fetch:tours         # Fetch tour dates for all active artists
npm run fetch:news          # Fetch news articles for artists
npm run fetch:bios          # Fetch artist biographies
npm run import:spotify      # Import artists from Spotify
npm run import:ticketmaster # Import artists with events from Ticketmaster
npm run import:csv          # Import artists from CSV file
npm run update:affiliate    # Update existing Ticketmaster events with affiliate tracking
```

All data operation scripts use `dotenv -e .env.local -- tsx scripts/<script-name>.ts` pattern and require environment variables to be set in `.env.local`.

## Architecture

### Database Layer

**Two-Driver Pattern**: The project uses different Neon drivers depending on context:
- **HTTP Driver** (`@neondatabase/serverless` with `neon()`) - Used in `db/index.ts` for app routes and pages. Better for Vercel serverless functions.
- **Pool/Serverless Driver** (`Pool` from `@neondatabase/serverless`) - Used in `scripts/migrate.ts` for running migrations. Required for Drizzle migration operations.

**Schema** (`db/schema.ts`):
- `artists` - Artist profiles with external API IDs (Spotify, Ticketmaster, SeatGeek, Bandsintown)
- `venues` - Venue information including geolocation
- `events` - Concert/tour events linking artists to venues. Includes `source` field to track which API provided the data.
- `news_articles` - News aggregated for each artist
- `tweets` - Twitter content for artists

**Database Access**: Import `db` from `@/db` for queries. The database uses Drizzle ORM with the schema available at `@/db/schema`.

### Frontend Architecture

**Next.js App Router** with Static Site Generation (SSG) + Incremental Static Regeneration (ISR):
- Artist pages use `generateStaticParams()` to pre-build top 100 artists at build time
- `revalidate: 1800` (30 minutes) for ISR on artist pages
- Server Components for data fetching (no client-side state management needed for most pages)
- SEO metadata generated via `generateMetadata()` async function
- Structured data (JSON-LD) for search engines via `StructuredData` component

**Key Routes**:
- `/` - Homepage
- `/artists` - Artist listing page
- `/artists/[slug]` - Individual artist page with tours, news, and biography
- `/api/health` - Health check endpoint
- `/api/artist/[slug]` - Artist API endpoint

### API Integration Layer (`lib/`)

**Ticketmaster** (`lib/ticketmaster.ts`):
- `searchArtistEvents(artistName)` - Returns events, venues, ticketmasterId, and artistInfo
- Requires `TICKETMASTER_API_KEY` environment variable
- Returns normalized data matching `NewEvent` and `NewVenue` types

**SeatGeek** (`lib/seatgeek.ts`):
- `searchArtistEvents(artistName)` - Returns events, venues, seatgeekId, and artistInfo
- Requires `SEATGEEK_CLIENT_ID` and `SEATGEEK_CLIENT_SECRET` environment variables
- Returns normalized data matching `NewEvent` and `NewVenue` types

**Spotify** (`lib/spotify.ts`):
- OAuth-based authentication for accessing artist data
- Used for importing artists and fetching artist metadata

**News API** (`lib/news-api.ts`):
- Fetches news articles for artists
- Requires `NEWS_API_KEY` environment variable

**Data Fetching Pattern**: `scripts/fetch-tours.ts` demonstrates the pattern:
1. Fetch from both Ticketmaster and SeatGeek in parallel using `Promise.allSettled()`
2. Merge results and deduplicate events
3. Upsert venues first (they're referenced by events)
4. Upsert events with conflict handling on `source + externalId`
5. Update artist records with API IDs and metadata (image, genre)

### Scripts Organization

Scripts in `scripts/` directory are organized by function:
- **fetch-***: Fetch data from external APIs (tours, news, bios)
- **import-***: Import artists from various sources (Spotify, Ticketmaster, CSV)
- **fix-***: Data cleanup and repair scripts
- **check-***: Validation and verification scripts
- **show-***: Display stats and summaries

All scripts load environment variables from `.env.local` using `dotenv` at the top of the file.

## Key Patterns

### Slugification
Use `slugify()` from `lib/slugify.ts` for generating URL-friendly artist slugs. Slugs must be unique and are indexed in the database.

### SEO & Metadata
- `lib/seo.ts` - Contains `generateArtistMetadata()` and `SITE_URL` constant
- `lib/schema.ts` - JSON-LD schema generators for structured data (`generatePersonSchema`, `generateMusicEventSchema`, `generateBreadcrumbSchema`)
- Always include OpenGraph and Twitter card metadata
- Use `StructuredData` component to inject JSON-LD into pages

### Image Handling
`next.config.ts` configures `remotePatterns` for external images from:
- `s1.ticketm.net` (Ticketmaster)
- `seatgeek.com` (SeatGeek)
- `i.scdn.co` and `**.scdn.co` (Spotify)

Use Next.js `<Image>` component with these domains.

### Error Handling in Data Fetching
Use `Promise.allSettled()` when fetching from multiple APIs to ensure one failure doesn't block others. Check for `status === 'fulfilled'` before processing results.

### Affiliate Tracking
**Ticketmaster Affiliate Program** (`lib/affiliate.ts`):
- Uses Impact Radius tracking via `ticketmaster.evyy.net`
- Affiliate ID: `6993168`, Campaign ID: `264167`, Creative ID: `4272`
- `getTicketmasterAffiliateUrl(url)` - Wraps Ticketmaster URLs with affiliate tracking
- `getAffiliateUrl(url, source)` - Generic function that applies appropriate affiliate tracking based on event source

**Automatic Integration**:
- All Ticketmaster ticket URLs are automatically wrapped with affiliate tracking when displayed on artist pages
- New events fetched via `scripts/fetch-tours.ts` automatically have affiliate tracking applied before storage
- Use `npm run update:affiliate` to retroactively update existing Ticketmaster events with affiliate URLs

**Adding New Affiliate Programs**:
1. Add configuration to `AFFILIATE_CONFIG` in `lib/affiliate.ts`
2. Create a source-specific function (e.g., `getSeatGeekAffiliateUrl`)
3. Update the `getAffiliateUrl()` switch statement to handle the new source
4. Update `scripts/fetch-tours.ts` to apply tracking when processing events from that source

## Environment Variables

Required in `.env.local`:
- `DATABASE_URL` - Neon Postgres connection string
- `TICKETMASTER_API_KEY` - Ticketmaster Discovery API key
- `SEATGEEK_CLIENT_ID` - SeatGeek client ID
- `SEATGEEK_CLIENT_SECRET` - SeatGeek client secret
- `NEWS_API_KEY` - (Optional) News API key
- Spotify credentials - (Optional) For Spotify integration

See `.env.example` for template.

## Database Migrations

When modifying `db/schema.ts`:
1. Run `npm run db:generate` to create migration files in `drizzle/` directory
2. Review the generated SQL migration
3. Run `npm run db:migrate` to apply migration to database
4. Migration script uses Pool driver, not HTTP driver

## Deployment

Recommended: Vercel
- Automatically builds and deploys on push to main branch
- Set environment variables in Vercel dashboard
- Consider setting up Vercel Cron for scheduled data fetching:
  - Tour fetching: every 4-6 hours
  - News fetching: every 6-12 hours

## Testing Data Operations

To test the full data pipeline locally:
1. Ensure `.env.local` is configured with valid API keys
2. Run `npm run seed` to add initial artists
3. Run `npm run fetch:tours` to populate events and venues
4. Run `npm run fetch:news` to populate news articles
5. Run `npm run dev` and visit artist pages to verify data

## Common Workflows

### Adding a New Artist Manually
Use `scripts/import-from-csv.ts` or create a script that inserts into the `artists` table with required fields: `id`, `slug`, `name`, `isActive`.

### Updating Artist Data
Run `npm run fetch:tours` to refresh all tour dates and update artist metadata (images, genres, API IDs).

### Fixing Duplicate Events
Check `scripts/fix-duplicates-and-images.ts` for patterns on deduplication logic.

### Adding a New External API
1. Create new file in `lib/` with typed interfaces
2. Implement search function returning normalized `NewEvent[]` and `NewVenue[]`
3. Add API ID field to `artists` table schema if needed
4. Update `scripts/fetch-tours.ts` to include new source in parallel fetching
5. Update event deduplication logic to handle new source
