# Scaling Beyond 20 Artists

This guide explains how to grow your artist database from 20 to hundreds or thousands of artists.

## 🎯 Quick Comparison

| Method | Artists | Effort | Best For |
|--------|---------|--------|----------|
| **Spotify API** | 100-500+ | Low | Quick scaling with popular artists |
| **Ticketmaster** | 100-300 | Low | Artists currently touring |
| **CSV Import** | Unlimited | Medium | Curated lists, specific artists |
| **Manual** | 1-10 at a time | High | Highly curated selection |

---

## Option 1: Spotify API (Recommended)

**Best for:** Quickly adding 100-500 popular artists

### Setup

1. **Get Spotify API Credentials** (Free):
   ```bash
   # Visit: https://developer.spotify.com/dashboard
   # Click "Create app"
   # Fill in app name and description
   # Copy Client ID and Client Secret
   ```

2. **Add to `.env.local`**:
   ```env
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   ```

3. **Import Artists**:
   ```bash
   npm run import:spotify
   ```

### What You Get

- ✅ Top 50 most popular artists globally
- ✅ Top 20 artists per genre (pop, rock, hip-hop, country, r&b)
- ✅ Artist images from Spotify
- ✅ Genre tags
- ✅ ~100-150 unique artists in one run

### Customization

Edit `scripts/import-spotify-artists.ts` to:
- Change number of artists per genre (default: 20)
- Add more genres from the GENRES list
- Filter by popularity threshold
- Search specific artist names

### After Import

```bash
# Fetch tour dates for new artists
npm run fetch:tours

# Fetch news articles
npm run fetch:news
```

---

## Option 2: Ticketmaster API

**Best for:** Adding artists who are actually touring right now

### Advantages

- ✅ Already have the API key
- ✅ Only adds artists with upcoming events
- ✅ Guarantees tour date availability
- ✅ Artist images included

### Usage

```bash
npm run import:ticketmaster
```

### What Happens

1. Searches Ticketmaster for artists by genre
2. Gets ~100-300 artists with upcoming events
3. Automatically includes Ticketmaster IDs
4. Adds artist images and genres

### After Import

```bash
# Immediately fetch their tour dates
npm run fetch:tours
```

---

## Option 3: CSV Import

**Best for:** Specific artist lists, curated selections

### Create CSV File

Create `artists.csv` in project root:

```csv
name,genre,twitter_handle
Billie Eilish,Pop,billieeilish
The Weeknd,R&B,theweeknd
Metallica,Metal,Metallica
```

### Import

```bash
npm run import:csv
```

Or specify a different file:

```bash
npm run import:csv my-artists.csv
```

### Use Cases

- **Billboard Charts**: Copy artist names from Billboard Hot 100
- **Festival Lineups**: Import all artists from a festival
- **Genre-Specific**: Build a country music or metal-focused site
- **Local Artists**: Add regional/local artists manually

### Where to Get Lists

- Billboard Charts (https://www.billboard.com/charts/)
- Festival lineups (Coachella, Lollapalooza, etc.)
- Spotify playlists (copy artist names)
- Music blogs and publications

---

## Option 4: Manual Addition

**Best for:** Highly curated, one-off additions

### Via Drizzle Studio (GUI)

```bash
npm run db:studio
```

1. Open http://localhost:4983
2. Click "artists" table
3. Click "Add Row"
4. Fill in:
   - **id**: Leave blank (auto-generated)
   - **name**: Artist name
   - **genre**: Genre (optional)
   - **isActive**: true
5. Click "Save"

---

## 📊 Recommended Strategy

### Phase 1: Initial Scale (100-200 artists)
```bash
# Get popular artists from Spotify
npm run import:spotify

# Get touring artists from Ticketmaster
npm run import:ticketmaster

# Fetch tour dates
npm run fetch:tours

# Fetch news
npm run fetch:news
```

**Result:** 150-300 artists with tours and news

### Phase 2: Genre Expansion (300-500 artists)

Edit `scripts/import-spotify-artists.ts`:
- Increase artists per genre from 20 to 50
- Add more genres from GENRES list

```bash
npm run import:spotify
npm run fetch:tours
npm run fetch:news
```

### Phase 3: Targeted Curation (500+ artists)

- Import from specific sources via CSV
- Add niche genres
- Include local/regional artists
- Festival lineups

---

## 🔄 Ongoing Maintenance

### Weekly

```bash
# Add new trending artists
npm run import:spotify

# Update tour dates
npm run fetch:tours

# Refresh news
npm run fetch:news
```

### Monthly

- Review inactive artists (no events, no news)
- Mark inactive: `UPDATE artists SET is_active = false WHERE ...`
- Add emerging artists from charts/festivals

---

## 💰 API Costs & Limits

### Spotify API
- **Cost:** FREE
- **Limit:** No strict limits for client credentials flow
- **Rate limits:** Reasonable (won't hit during import)

### Ticketmaster API
- **Cost:** FREE
- **Limit:** 5,000 API calls/day
- **Rate limits:** ~5 requests/second

### News API
- **Cost:** FREE (100 requests/day)
- **Impact:** Limit artists with `is_active = true` to stay under limit
- **Strategy:** Only fetch news for artists with upcoming events

---

## 🎯 Targeting Strategies

### By Popularity
Focus on top 500 most popular artists (Spotify)

### By Activity
Only artists with events in next 6 months (Ticketmaster)

### By Genre
Build genre-specific sites:
- Country music only
- Metal/hard rock
- Electronic/EDM
- Hip-hop/rap

### By Region
Filter Ticketmaster by venue location/region

### By Festival
Import lineups from major festivals

---

## 📈 Performance Considerations

### Database
- 1,000 artists = ~10,000 events = ~5,000 news articles
- Total DB size: ~50-100 MB
- Neon free tier: 0.5 GB (plenty of room)

### Page Load
- Artist listing page: Fast with proper indexing
- Search: Add full-text search for 500+ artists

### Cron Jobs
- With 100 artists: ~2-3 minutes to fetch tours
- With 500 artists: ~10-15 minutes
- Solution: Split into batches or run parallel

---

## 🚀 Next Steps

1. Choose your import method
2. Get API credentials if needed
3. Run import script
4. Fetch tours and news
5. Review results in Drizzle Studio
6. Adjust and repeat

Start with **Spotify import** for quickest results!
