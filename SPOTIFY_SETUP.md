# Fixing Spotify 403 Error

## The Problem

Your Spotify app is in **Development Mode**, which limits API access. The authentication works (you get a valid token), but search requests return:

```
403 Forbidden: Check settings on developer.spotify.com/dashboard, the user may not be registered.
```

## The Solution

You need to request **Extended Quota Mode** for your Spotify app.

### Steps to Request Extended Quota Mode

1. **Go to your Spotify Developer Dashboard:**
   - Visit: https://developer.spotify.com/dashboard
   - Log in and select your app

2. **Click "Settings" (top right)**

3. **Scroll down to "Quota Extension"**

4. **Click "Request Extension"**

5. **Fill out the form:**
   - **App Name:** TourWax (or whatever you named it)
   - **What does your app do?**
     ```
     TourWax displays tour dates and news for popular music artists.
     We use the Spotify API to discover and import artist information
     (names, images, genres) to populate our database. No user
     authentication is needed - we only use client credentials flow
     to search for artists and retrieve their basic profile data.
     ```
   - **How will you use the Spotify API?**
     ```
     - Artist Search API to discover popular artists
     - We retrieve artist names, images, genres, and popularity scores
     - Client credentials flow only (no user data)
     - Used for initial database seeding and periodic updates
     ```
   - **Are you using audio features?** NO
   - **Are you using personalization?** NO

6. **Submit the request**

7. **Wait for approval (usually 1-3 business days)**

Once approved, your app will work with all Spotify API endpoints without restrictions.

---

## Alternative: Use Ticketmaster Import (Works Now!)

While waiting for Spotify approval, you can import artists from Ticketmaster instead:

```bash
# Import artists who are currently touring
npm run import:ticketmaster

# This will add 100-300 artists with upcoming events
# Then fetch their tour dates
npm run fetch:tours
```

**Advantages:**
- ✅ Works immediately (you already have the API key)
- ✅ Only adds artists who are actually touring
- ✅ Includes artist images and genres
- ✅ No approval process needed

---

## After Spotify Approval

Once your Spotify app is approved for Extended Quota Mode:

```bash
# Import popular artists from Spotify
npm run import:spotify

# Fetch tour dates for new artists
npm run fetch:tours

# Fetch news articles
npm run fetch:news
```

This will add 100-150 artists in one run (top artists + 5 genres).

---

## Quick Start (Without Waiting)

```bash
# Option 1: Ticketmaster (touring artists)
npm run import:ticketmaster
npm run fetch:tours

# Option 2: CSV import (manual curation)
# Create artists.csv with: name,genre,twitter_handle
npm run import:csv

# Option 3: Wait for Spotify approval
# Follow steps above, then use npm run import:spotify
```

See **SCALING_ARTISTS.md** for full details on all import methods.
