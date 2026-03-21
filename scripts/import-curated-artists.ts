import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events, newsArticles, tweets } from '@/db/schema';
import { slugify } from '@/lib/slugify';
import { nanoid } from 'nanoid';
import { sql } from 'drizzle-orm';

/**
 * Import a curated list of ~300 top touring artists across all genres.
 *
 * This script:
 * 1. Clears existing events, news, tweets (they reference artists via FK)
 * 2. Clears existing artists
 * 3. Inserts each curated artist with a nanoid, slugified slug, and genre
 * 4. Skips duplicates (same slug) gracefully
 *
 * Usage:
 *   npm run import:curated
 *   # or directly:
 *   dotenv -e .env.local -- tsx scripts/import-curated-artists.ts
 */

interface CuratedArtist {
  name: string;
  genre: string;
}

// ─── Curated Artist List ─────────────────────────────────────────────────────
// Organized by genre. Artists that could fit multiple genres are listed once
// under their primary genre.

const HIP_HOP_RAP: CuratedArtist[] = [
  { name: 'Drake', genre: 'Hip-Hop/Rap' },
  { name: 'Kendrick Lamar', genre: 'Hip-Hop/Rap' },
  { name: 'Travis Scott', genre: 'Hip-Hop/Rap' },
  { name: 'J. Cole', genre: 'Hip-Hop/Rap' },
  { name: 'Future', genre: 'Hip-Hop/Rap' },
  { name: 'Lil Baby', genre: 'Hip-Hop/Rap' },
  { name: '21 Savage', genre: 'Hip-Hop/Rap' },
  { name: 'Metro Boomin', genre: 'Hip-Hop/Rap' },
  { name: 'Nicki Minaj', genre: 'Hip-Hop/Rap' },
  { name: 'Megan Thee Stallion', genre: 'Hip-Hop/Rap' },
  { name: 'Lil Wayne', genre: 'Hip-Hop/Rap' },
  { name: 'Eminem', genre: 'Hip-Hop/Rap' },
  { name: 'Jay-Z', genre: 'Hip-Hop/Rap' },
  { name: 'Kanye West', genre: 'Hip-Hop/Rap' },
  { name: 'A$AP Rocky', genre: 'Hip-Hop/Rap' },
  { name: 'Tyler, The Creator', genre: 'Hip-Hop/Rap' },
  { name: 'Playboi Carti', genre: 'Hip-Hop/Rap' },
  { name: 'Lil Uzi Vert', genre: 'Hip-Hop/Rap' },
  { name: 'Young Thug', genre: 'Hip-Hop/Rap' },
  { name: 'Gunna', genre: 'Hip-Hop/Rap' },
  { name: 'Rod Wave', genre: 'Hip-Hop/Rap' },
  { name: 'NBA YoungBoy', genre: 'Hip-Hop/Rap' },
  { name: 'Cardi B', genre: 'Hip-Hop/Rap' },
  { name: 'Ice Spice', genre: 'Hip-Hop/Rap' },
  { name: 'Juice WRLD', genre: 'Hip-Hop/Rap' },
  { name: 'Post Malone', genre: 'Hip-Hop/Rap' },
  { name: 'Wiz Khalifa', genre: 'Hip-Hop/Rap' },
  { name: 'Ludacris', genre: 'Hip-Hop/Rap' },
  { name: 'Joyner Lucas', genre: 'Hip-Hop/Rap' },
  { name: 'Logic', genre: 'Hip-Hop/Rap' },
  { name: 'JID', genre: 'Hip-Hop/Rap' },
  { name: 'Denzel Curry', genre: 'Hip-Hop/Rap' },
  { name: 'Pusha T', genre: 'Hip-Hop/Rap' },
  { name: 'Freddie Gibbs', genre: 'Hip-Hop/Rap' },
  { name: 'Vince Staples', genre: 'Hip-Hop/Rap' },
  { name: 'Chance the Rapper', genre: 'Hip-Hop/Rap' },
  { name: 'Kid Cudi', genre: 'Hip-Hop/Rap' },
  { name: 'Mac Miller', genre: 'Hip-Hop/Rap' },
  { name: 'Lil Durk', genre: 'Hip-Hop/Rap' },
  { name: 'Moneybagg Yo', genre: 'Hip-Hop/Rap' },
  { name: 'GloRilla', genre: 'Hip-Hop/Rap' },
  { name: 'Sexyy Red', genre: 'Hip-Hop/Rap' },
  { name: 'Offset', genre: 'Hip-Hop/Rap' },
  { name: 'Quavo', genre: 'Hip-Hop/Rap' },
  { name: '2 Chainz', genre: 'Hip-Hop/Rap' },
];

const POP: CuratedArtist[] = [
  { name: 'Taylor Swift', genre: 'Pop' },
  { name: 'Billie Eilish', genre: 'Pop' },
  { name: 'Dua Lipa', genre: 'Pop' },
  { name: 'Harry Styles', genre: 'Pop' },
  { name: 'Olivia Rodrigo', genre: 'Pop' },
  { name: 'The Weeknd', genre: 'Pop' },
  { name: 'Bruno Mars', genre: 'Pop' },
  { name: 'Ed Sheeran', genre: 'Pop' },
  { name: 'Ariana Grande', genre: 'Pop' },
  { name: 'Lady Gaga', genre: 'Pop' },
  { name: 'Justin Bieber', genre: 'Pop' },
  { name: 'Adele', genre: 'Pop' },
  { name: 'Rihanna', genre: 'Pop' },
  { name: 'Pink', genre: 'Pop' },
  { name: 'Katy Perry', genre: 'Pop' },
  { name: 'Miley Cyrus', genre: 'Pop' },
  { name: 'Demi Lovato', genre: 'Pop' },
  { name: 'Selena Gomez', genre: 'Pop' },
  { name: 'Sabrina Carpenter', genre: 'Pop' },
  { name: 'Chappell Roan', genre: 'Pop' },
  { name: 'Tate McRae', genre: 'Pop' },
  { name: 'Doja Cat', genre: 'Pop' },
  { name: 'Lana Del Rey', genre: 'Pop' },
  { name: 'Charli XCX', genre: 'Pop' },
  { name: 'Troye Sivan', genre: 'Pop' },
  { name: 'Khalid', genre: 'Pop' },
  { name: 'Sam Smith', genre: 'Pop' },
  { name: 'Lizzo', genre: 'Pop' },
  { name: 'Halsey', genre: 'Pop' },
  { name: 'Camila Cabello', genre: 'Pop' },
  { name: 'Shawn Mendes', genre: 'Pop' },
  { name: 'John Legend', genre: 'Pop' },
  { name: 'Benson Boone', genre: 'Pop' },
  { name: 'Gracie Abrams', genre: 'Pop' },
  { name: 'Renee Rapp', genre: 'Pop' },
  { name: 'Jonas Brothers', genre: 'Pop' },
  { name: 'Shakira', genre: 'Pop' },
  { name: 'Sia', genre: 'Pop' },
  { name: 'Elton John', genre: 'Pop' },
  { name: 'Billy Joel', genre: 'Pop' },
  { name: 'Madonna', genre: 'Pop' },
];

const ROCK: CuratedArtist[] = [
  { name: 'Foo Fighters', genre: 'Rock' },
  { name: 'Red Hot Chili Peppers', genre: 'Rock' },
  { name: 'Green Day', genre: 'Rock' },
  { name: 'The Rolling Stones', genre: 'Rock' },
  { name: 'Pearl Jam', genre: 'Rock' },
  { name: 'AC/DC', genre: 'Rock' },
  { name: "Guns N' Roses", genre: 'Rock' },
  { name: 'U2', genre: 'Rock' },
  { name: 'Coldplay', genre: 'Rock' },
  { name: 'Imagine Dragons', genre: 'Rock' },
  { name: 'Twenty One Pilots', genre: 'Rock' },
  { name: 'The Black Keys', genre: 'Rock' },
  { name: 'Arctic Monkeys', genre: 'Rock' },
  { name: 'Kings of Leon', genre: 'Rock' },
  { name: 'Muse', genre: 'Rock' },
  { name: 'System of a Down', genre: 'Rock' },
  { name: 'Rage Against the Machine', genre: 'Rock' },
  { name: 'Weezer', genre: 'Rock' },
  { name: 'Blink-182', genre: 'Rock' },
  { name: 'Fall Out Boy', genre: 'Rock' },
  { name: 'My Chemical Romance', genre: 'Rock' },
  { name: 'Paramore', genre: 'Rock' },
  { name: 'The Offspring', genre: 'Rock' },
  { name: 'Sum 41', genre: 'Rock' },
  { name: 'Linkin Park', genre: 'Rock' },
  { name: 'Avenged Sevenfold', genre: 'Rock' },
  { name: 'Tool', genre: 'Rock' },
  { name: 'Queens of the Stone Age', genre: 'Rock' },
  { name: 'The Killers', genre: 'Rock' },
  { name: 'Incubus', genre: 'Rock' },
  { name: 'Stone Temple Pilots', genre: 'Rock' },
  { name: 'Godsmack', genre: 'Rock' },
  { name: 'Disturbed', genre: 'Rock' },
  { name: 'Three Days Grace', genre: 'Rock' },
  { name: 'Bruce Springsteen', genre: 'Rock' },
  { name: 'Tom Petty and the Heartbreakers', genre: 'Rock' },
  { name: 'Fleetwood Mac', genre: 'Rock' },
  { name: 'The Eagles', genre: 'Rock' },
];

const RNB: CuratedArtist[] = [
  { name: 'SZA', genre: 'R&B' },
  { name: 'Beyonce', genre: 'R&B' },
  { name: 'Daniel Caesar', genre: 'R&B' },
  { name: 'Summer Walker', genre: 'R&B' },
  { name: 'Brent Faiyaz', genre: 'R&B' },
  { name: 'H.E.R.', genre: 'R&B' },
  { name: 'Chris Brown', genre: 'R&B' },
  { name: 'Usher', genre: 'R&B' },
  { name: 'Tyla', genre: 'R&B' },
  { name: 'Frank Ocean', genre: 'R&B' },
  { name: 'Jhene Aiko', genre: 'R&B' },
  { name: 'Kehlani', genre: 'R&B' },
  { name: 'Lucky Daye', genre: 'R&B' },
  { name: 'Snoh Aalegra', genre: 'R&B' },
  { name: 'Victoria Monet', genre: 'R&B' },
  { name: 'Jazmine Sullivan', genre: 'R&B' },
  { name: 'Chloe Bailey', genre: 'R&B' },
  { name: 'Ella Mai', genre: 'R&B' },
  { name: 'Bryson Tiller', genre: 'R&B' },
  { name: '6LACK', genre: 'R&B' },
  { name: 'Giveon', genre: 'R&B' },
  { name: 'Ari Lennox', genre: 'R&B' },
  { name: 'Anderson .Paak', genre: 'R&B' },
  { name: 'Tory Lanez', genre: 'R&B' },
];

const COUNTRY: CuratedArtist[] = [
  { name: 'Morgan Wallen', genre: 'Country' },
  { name: 'Luke Combs', genre: 'Country' },
  { name: 'Chris Stapleton', genre: 'Country' },
  { name: 'Zach Bryan', genre: 'Country' },
  { name: 'Bailey Zimmerman', genre: 'Country' },
  { name: 'Jason Aldean', genre: 'Country' },
  { name: 'Luke Bryan', genre: 'Country' },
  { name: 'Kenny Chesney', genre: 'Country' },
  { name: 'Tim McGraw', genre: 'Country' },
  { name: 'Carrie Underwood', genre: 'Country' },
  { name: 'Miranda Lambert', genre: 'Country' },
  { name: 'Kane Brown', genre: 'Country' },
  { name: 'Thomas Rhett', genre: 'Country' },
  { name: 'Lainey Wilson', genre: 'Country' },
  { name: 'Jelly Roll', genre: 'Country' },
  { name: 'Cody Johnson', genre: 'Country' },
  { name: 'Parker McCollum', genre: 'Country' },
  { name: 'Jon Pardi', genre: 'Country' },
  { name: 'Dierks Bentley', genre: 'Country' },
  { name: 'Eric Church', genre: 'Country' },
  { name: 'Keith Urban', genre: 'Country' },
  { name: 'Maren Morris', genre: 'Country' },
  { name: 'Kacey Musgraves', genre: 'Country' },
  { name: 'Turnpike Troubadours', genre: 'Country' },
  { name: 'Tyler Childers', genre: 'Country' },
  { name: 'Hank Williams Jr', genre: 'Country' },
  { name: 'George Strait', genre: 'Country' },
  { name: 'Reba McEntire', genre: 'Country' },
  { name: 'Dolly Parton', genre: 'Country' },
  { name: 'Blake Shelton', genre: 'Country' },
  { name: 'Toby Keith', genre: 'Country' },
  { name: 'Sam Hunt', genre: 'Country' },
  { name: 'Old Dominion', genre: 'Country' },
  { name: 'Riley Green', genre: 'Country' },
];

const ALTERNATIVE: CuratedArtist[] = [
  { name: 'Radiohead', genre: 'Alternative' },
  { name: 'Tame Impala', genre: 'Alternative' },
  { name: 'The 1975', genre: 'Alternative' },
  { name: 'Glass Animals', genre: 'Alternative' },
  { name: 'Gorillaz', genre: 'Alternative' },
  { name: 'Vampire Weekend', genre: 'Alternative' },
  { name: 'The Strokes', genre: 'Alternative' },
  { name: 'Death Cab for Cutie', genre: 'Alternative' },
  { name: 'Modest Mouse', genre: 'Alternative' },
  { name: 'MGMT', genre: 'Alternative' },
  { name: 'Phoenix', genre: 'Alternative' },
  { name: 'Two Door Cinema Club', genre: 'Alternative' },
  { name: 'Foster the People', genre: 'Alternative' },
  { name: 'Cage the Elephant', genre: 'Alternative' },
  { name: 'alt-J', genre: 'Alternative' },
  { name: 'The National', genre: 'Alternative' },
  { name: 'Bon Iver', genre: 'Alternative' },
  { name: 'Fleet Foxes', genre: 'Alternative' },
  { name: 'Lord Huron', genre: 'Alternative' },
  { name: 'Mt. Joy', genre: 'Alternative' },
  { name: 'Hozier', genre: 'Alternative' },
  { name: 'Kaleo', genre: 'Alternative' },
  { name: 'The Lumineers', genre: 'Alternative' },
  { name: 'Mumford & Sons', genre: 'Alternative' },
  { name: 'Mac DeMarco', genre: 'Alternative' },
  { name: 'The War on Drugs', genre: 'Alternative' },
  { name: 'Arcade Fire', genre: 'Alternative' },
  { name: 'The Smashing Pumpkins', genre: 'Alternative' },
  { name: 'Beck', genre: 'Alternative' },
];

const ELECTRONIC: CuratedArtist[] = [
  { name: 'Calvin Harris', genre: 'Electronic/Dance' },
  { name: 'Marshmello', genre: 'Electronic/Dance' },
  { name: 'Skrillex', genre: 'Electronic/Dance' },
  { name: 'Diplo', genre: 'Electronic/Dance' },
  { name: 'Tiesto', genre: 'Electronic/Dance' },
  { name: 'David Guetta', genre: 'Electronic/Dance' },
  { name: 'Zedd', genre: 'Electronic/Dance' },
  { name: 'Martin Garrix', genre: 'Electronic/Dance' },
  { name: 'Deadmau5', genre: 'Electronic/Dance' },
  { name: 'Kygo', genre: 'Electronic/Dance' },
  { name: 'Fisher', genre: 'Electronic/Dance' },
  { name: 'Illenium', genre: 'Electronic/Dance' },
  { name: 'Excision', genre: 'Electronic/Dance' },
  { name: 'Rezz', genre: 'Electronic/Dance' },
  { name: 'Subtronics', genre: 'Electronic/Dance' },
  { name: 'DJ Snake', genre: 'Electronic/Dance' },
  { name: 'Alesso', genre: 'Electronic/Dance' },
  { name: 'Porter Robinson', genre: 'Electronic/Dance' },
  { name: 'Madeon', genre: 'Electronic/Dance' },
  { name: 'ODESZA', genre: 'Electronic/Dance' },
  { name: 'Rufus Du Sol', genre: 'Electronic/Dance' },
  { name: 'Above & Beyond', genre: 'Electronic/Dance' },
  { name: 'Kaskade', genre: 'Electronic/Dance' },
  { name: 'Disclosure', genre: 'Electronic/Dance' },
  { name: 'Flume', genre: 'Electronic/Dance' },
  { name: 'Jamie xx', genre: 'Electronic/Dance' },
  { name: 'Fred again..', genre: 'Electronic/Dance' },
  { name: 'John Summit', genre: 'Electronic/Dance' },
  { name: 'Chris Lake', genre: 'Electronic/Dance' },
  { name: 'Bassnectar', genre: 'Electronic/Dance' },
  { name: 'The Chainsmokers', genre: 'Electronic/Dance' },
  { name: 'Swedish House Mafia', genre: 'Electronic/Dance' },
];

const LATIN: CuratedArtist[] = [
  { name: 'Bad Bunny', genre: 'Latin' },
  { name: 'Peso Pluma', genre: 'Latin' },
  { name: 'Junior H', genre: 'Latin' },
  { name: 'Fuerza Regida', genre: 'Latin' },
  { name: 'Grupo Frontera', genre: 'Latin' },
  { name: 'Natanael Cano', genre: 'Latin' },
  { name: 'J Balvin', genre: 'Latin' },
  { name: 'Ozuna', genre: 'Latin' },
  { name: 'Daddy Yankee', genre: 'Latin' },
  { name: 'Karol G', genre: 'Latin' },
  { name: 'Rauw Alejandro', genre: 'Latin' },
  { name: 'Anuel AA', genre: 'Latin' },
  { name: 'Farruko', genre: 'Latin' },
  { name: 'Maluma', genre: 'Latin' },
  { name: 'Nicky Jam', genre: 'Latin' },
  { name: 'Becky G', genre: 'Latin' },
  { name: 'Rosalia', genre: 'Latin' },
  { name: 'Luis Miguel', genre: 'Latin' },
  { name: 'Marc Anthony', genre: 'Latin' },
  { name: 'Enrique Iglesias', genre: 'Latin' },
  { name: 'Romeo Santos', genre: 'Latin' },
  { name: 'Aventura', genre: 'Latin' },
  { name: 'Myke Towers', genre: 'Latin' },
  { name: 'Yandel', genre: 'Latin' },
  { name: 'Don Omar', genre: 'Latin' },
  { name: 'Wisin', genre: 'Latin' },
];

const METAL: CuratedArtist[] = [
  { name: 'Metallica', genre: 'Metal' },
  { name: 'Slipknot', genre: 'Metal' },
  { name: 'Iron Maiden', genre: 'Metal' },
  { name: 'Judas Priest', genre: 'Metal' },
  { name: 'Megadeth', genre: 'Metal' },
  { name: 'Lamb of God', genre: 'Metal' },
  { name: 'Gojira', genre: 'Metal' },
  { name: 'Mastodon', genre: 'Metal' },
  { name: 'Ghost', genre: 'Metal' },
  { name: 'Spiritbox', genre: 'Metal' },
  { name: 'Bring Me the Horizon', genre: 'Metal' },
  { name: 'Parkway Drive', genre: 'Metal' },
  { name: 'Knocked Loose', genre: 'Metal' },
  { name: 'Sleep Token', genre: 'Metal' },
  { name: 'Architects', genre: 'Metal' },
  { name: 'Polaris', genre: 'Metal' },
  { name: 'Bad Omens', genre: 'Metal' },
  { name: 'Motionless in White', genre: 'Metal' },
  { name: 'Ice Nine Kills', genre: 'Metal' },
  { name: 'Falling in Reverse', genre: 'Metal' },
  { name: 'A Day to Remember', genre: 'Metal' },
  { name: 'Pantera', genre: 'Metal' },
  { name: 'Slayer', genre: 'Metal' },
  { name: 'Korn', genre: 'Metal' },
  { name: 'Rob Zombie', genre: 'Metal' },
  { name: 'Five Finger Death Punch', genre: 'Metal' },
];

const JAZZ: CuratedArtist[] = [
  { name: 'Kamasi Washington', genre: 'Jazz' },
  { name: 'Robert Glasper', genre: 'Jazz' },
  { name: 'Thundercat', genre: 'Jazz' },
  { name: 'Norah Jones', genre: 'Jazz' },
  { name: 'Diana Krall', genre: 'Jazz' },
  { name: 'Snarky Puppy', genre: 'Jazz' },
  { name: 'Herbie Hancock', genre: 'Jazz' },
  { name: 'Wynton Marsalis', genre: 'Jazz' },
  { name: 'Gregory Porter', genre: 'Jazz' },
  { name: 'Gary Clark Jr.', genre: 'Jazz' },
  { name: 'Joe Bonamassa', genre: 'Jazz' },
  { name: 'Buddy Guy', genre: 'Jazz' },
  { name: 'Tedeschi Trucks Band', genre: 'Jazz' },
  { name: 'John Mayer', genre: 'Jazz' },
];

const CLASSICAL: CuratedArtist[] = [
  { name: 'Yo-Yo Ma', genre: 'Classical' },
  { name: 'Lang Lang', genre: 'Classical' },
  { name: 'Itzhak Perlman', genre: 'Classical' },
  { name: 'Andre Rieu', genre: 'Classical' },
  { name: 'Lindsey Stirling', genre: 'Classical' },
  { name: '2Cellos', genre: 'Classical' },
  { name: 'Yuja Wang', genre: 'Classical' },
  { name: 'Joshua Bell', genre: 'Classical' },
];

const FOLK_INDIE: CuratedArtist[] = [
  { name: 'Phoebe Bridgers', genre: 'Folk/Indie' },
  { name: 'Big Thief', genre: 'Folk/Indie' },
  { name: 'Adrianne Lenker', genre: 'Folk/Indie' },
  { name: 'Waxahatchee', genre: 'Folk/Indie' },
  { name: 'boygenius', genre: 'Folk/Indie' },
  { name: 'Lucy Dacus', genre: 'Folk/Indie' },
  { name: 'Julien Baker', genre: 'Folk/Indie' },
  { name: 'Iron & Wine', genre: 'Folk/Indie' },
  { name: 'The Avett Brothers', genre: 'Folk/Indie' },
  { name: 'Jason Isbell', genre: 'Folk/Indie' },
  { name: 'Sturgill Simpson', genre: 'Folk/Indie' },
  { name: 'Shakey Graves', genre: 'Folk/Indie' },
  { name: 'Caamp', genre: 'Folk/Indie' },
  { name: 'Noah Kahan', genre: 'Folk/Indie' },
  { name: 'Maggie Rogers', genre: 'Folk/Indie' },
  { name: 'The Head and the Heart', genre: 'Folk/Indie' },
  { name: 'Vance Joy', genre: 'Folk/Indie' },
];

// ─── Combine All Artists ─────────────────────────────────────────────────────

const ALL_ARTISTS: CuratedArtist[] = [
  ...HIP_HOP_RAP,
  ...POP,
  ...ROCK,
  ...RNB,
  ...COUNTRY,
  ...ALTERNATIVE,
  ...ELECTRONIC,
  ...LATIN,
  ...METAL,
  ...JAZZ,
  ...CLASSICAL,
  ...FOLK_INDIE,
];

// ─── Main Import Function ────────────────────────────────────────────────────

async function importCuratedArtists() {
  console.log('=== Curated Artist Import ===\n');
  console.log(`Total artists in curated list: ${ALL_ARTISTS.length}\n`);

  // Deduplicate by slug to handle artists that might appear in multiple genre
  // arrays (we keep the first occurrence, which is the primary genre).
  const seen = new Set<string>();
  const deduplicated: CuratedArtist[] = [];
  for (const artist of ALL_ARTISTS) {
    const slug = slugify(artist.name);
    if (!seen.has(slug)) {
      seen.add(slug);
      deduplicated.push(artist);
    } else {
      console.log(`  [dedup] Skipping duplicate: ${artist.name} (${artist.genre}) - already listed under another genre`);
    }
  }

  console.log(`\nAfter deduplication: ${deduplicated.length} unique artists\n`);

  // ── Step 1: Show current state ───────────────────────────────────────────
  const currentArtists = await db.select({ count: sql<number>`count(*)` }).from(artists);
  const currentEvents = await db.select({ count: sql<number>`count(*)` }).from(events);
  const currentNews = await db.select({ count: sql<number>`count(*)` }).from(newsArticles);

  console.log('Current database state:');
  console.log(`  Artists:       ${currentArtists[0].count}`);
  console.log(`  Events:        ${currentEvents[0].count}`);
  console.log(`  News Articles: ${currentNews[0].count}`);
  console.log('');

  // ── Step 2: Clear dependent tables, then artists ─────────────────────────
  console.log('Clearing existing data...');

  await db.delete(tweets);
  console.log('  Deleted all tweets');

  await db.delete(newsArticles);
  console.log('  Deleted all news articles');

  await db.delete(events);
  console.log('  Deleted all events');

  await db.delete(artists);
  console.log('  Deleted all artists');

  console.log('');

  // ── Step 3: Insert curated artists ───────────────────────────────────────
  console.log('Inserting curated artists...\n');

  let added = 0;
  let skipped = 0;
  const genreCounts: Record<string, number> = {};

  for (const artist of deduplicated) {
    const slug = slugify(artist.name);

    try {
      await db.insert(artists).values({
        id: nanoid(),
        slug,
        name: artist.name,
        genre: artist.genre,
        imageUrl: null,
        spotifyId: null,
        ticketmasterId: null,
        bandsintownId: null,
        seatgeekId: null,
        isActive: true,
      });

      added++;
      genreCounts[artist.genre] = (genreCounts[artist.genre] || 0) + 1;

      if (added % 25 === 0) {
        console.log(`  ... inserted ${added} artists`);
      }
    } catch (error: any) {
      // Unique constraint violation (duplicate slug)
      if (error.code === '23505') {
        skipped++;
        console.log(`  [skip] ${artist.name} (slug "${slug}" already exists)`);
      } else {
        console.error(`  [error] Failed to insert ${artist.name}:`, error.message || error);
      }
    }
  }

  // ── Step 4: Summary ──────────────────────────────────────────────────────
  console.log('\n=== Import Complete ===\n');
  console.log(`  Added:   ${added}`);
  console.log(`  Skipped: ${skipped}`);
  console.log('');

  console.log('Artists per genre:');
  const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
  for (const [genre, count] of sortedGenres) {
    console.log(`  ${genre.padEnd(20)} ${count}`);
  }

  console.log('\nNext steps:');
  console.log('  1. Run "npm run fetch:tours" to get tour dates for all artists');
  console.log('  2. Run "npm run fetch:news" to get news articles');
  console.log('  3. Run "npm run fetch:bios" to get artist biographies');
}

importCuratedArtists()
  .catch(console.error)
  .finally(() => process.exit(0));
