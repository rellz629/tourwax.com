import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists, events, venues, newsArticles, eventArtists } from '@/db/schema';
import { eq, gte, asc, desc, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { normalizeGenre, genreSlug } from '@/lib/genres';

const artistSlug = process.argv[2];

if (!artistSlug) {
  console.error('Usage: npx dotenv -e .env.local -- tsx scripts/generate-blog-draft.ts <artist-slug>');
  console.error('Example: npx dotenv -e .env.local -- tsx scripts/generate-blog-draft.ts drake');
  process.exit(1);
}

interface EventWithVenue {
  eventDate: Date;
  name: string;
  ticketUrl: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  venueName: string | null;
  city: string | null;
  state: string | null;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function groupEventsByMonth(events: EventWithVenue[]): Map<string, EventWithVenue[]> {
  const groups = new Map<string, EventWithVenue[]>();
  for (const event of events) {
    const key = event.eventDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }
  return groups;
}

function buildPriceRange(events: EventWithVenue[]): string | null {
  const prices = events.map(e => e.minPrice).filter((p): p is number => p !== null && p > 0);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `$${min}`;
  return `$${min}–$${max}`;
}

function getCitiesOnTour(events: EventWithVenue[]): string[] {
  const cities = new Set<string>();
  for (const e of events) {
    if (e.city && e.state) {
      cities.add(`${e.city}, ${e.state}`);
    } else if (e.city) {
      cities.add(e.city);
    }
  }
  return [...cities];
}

async function generateDraft() {
  // Look up artist
  const [artist] = await db.select().from(artists).where(eq(artists.slug, artistSlug));

  if (!artist) {
    console.error(`❌ Artist not found with slug: ${artistSlug}`);
    console.error('Check the slug and try again.');
    process.exit(1);
  }

  console.log(`📝 Generating blog draft for: ${artist.name}\n`);

  const now = new Date();

  // Get upcoming events with venue info
  const upcomingEvents = await db
    .select({
      eventDate: events.eventDate,
      name: events.name,
      ticketUrl: events.ticketUrl,
      minPrice: events.minPrice,
      maxPrice: events.maxPrice,
      venueName: venues.name,
      city: venues.city,
      state: venues.state,
    })
    .from(events)
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(eq(eventArtists.artistId, artist.id), gte(events.eventDate, now)))
    .orderBy(asc(events.eventDate));

  // Get recent news
  const recentNews = await db
    .select()
    .from(newsArticles)
    .where(eq(newsArticles.artistId, artist.id))
    .orderBy(desc(newsArticles.publishedAt))
    .limit(10);

  // Build the draft
  const genre = normalizeGenre(artist.genre);
  const genreLink = `/tours/${genreSlug(genre)}`;
  const today = new Date().toISOString().split('T')[0];
  const year = new Date().getFullYear();

  const eventsByMonth = groupEventsByMonth(upcomingEvents);
  const priceRange = buildPriceRange(upcomingEvents);
  const cities = getCitiesOnTour(upcomingEvents);

  // Determine tour name from event names
  const tourNames = upcomingEvents
    .map(e => e.name)
    .filter(n => n.toLowerCase() !== artist.name.toLowerCase());
  const tourNameCounts = new Map<string, number>();
  for (const name of tourNames) {
    tourNameCounts.set(name, (tourNameCounts.get(name) || 0) + 1);
  }
  const mostCommonTourName = [...tourNameCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Determine first and last dates
  const firstEvent = upcomingEvents[0];
  const lastEvent = upcomingEvents[upcomingEvents.length - 1];

  // Build slug and title
  const tourLabel = mostCommonTourName
    ? `'${mostCommonTourName}'`
    : `${year} Tour`;
  const blogSlug = `${artistSlug}-tour-${year}`;
  const title = mostCommonTourName
    ? `${artist.name} Announces ${tourLabel} — ${upcomingEvents.length} Dates Across North America`
    : `${artist.name} ${year} Tour: ${upcomingEvents.length} Dates, Cities, and Ticket Info`;

  // Build markdown content
  let md = '';

  // Frontmatter
  md += `---\n`;
  md += `title: "${title}"\n`;
  md += `slug: "${blogSlug}"\n`;
  md += `excerpt: "${artist.name} is hitting the road with ${upcomingEvents.length} upcoming tour dates. Here's everything you need to know about the ${year} tour — dates, cities, venues, and ticket info."\n`;
  md += `author: "TourWax Team"\n`;
  md += `category: "Tour Announcement"\n`;
  md += `featuredImage: null\n`;
  md += `publishedAt: "${today}"\n`;
  md += `updatedAt: "${today}"\n`;
  md += `---\n\n`;

  // Intro
  if (firstEvent && lastEvent) {
    const firstCity = firstEvent.city && firstEvent.state
      ? `${firstEvent.city}, ${firstEvent.state}`
      : firstEvent.city || 'TBA';
    const lastCity = lastEvent.city && lastEvent.state
      ? `${lastEvent.city}, ${lastEvent.state}`
      : lastEvent.city || 'TBA';

    md += `${artist.name} has announced ${upcomingEvents.length} tour dates`;
    if (mostCommonTourName) {
      md += ` as part of the ${tourLabel} tour`;
    }
    md += `. The run kicks off ${formatDate(firstEvent.eventDate)} in ${firstCity} and wraps up ${formatDate(lastEvent.eventDate)} in ${lastCity}.\n\n`;
  } else {
    md += `${artist.name} has upcoming tour dates for ${year}. Here's everything you need to know.\n\n`;
  }

  // Tour dates section
  md += `## Tour Dates\n\n`;

  if (upcomingEvents.length === 0) {
    md += `No upcoming dates announced yet. Check the [${artist.name} page](/artists/${artist.slug}) for updates.\n\n`;
  } else {
    for (const [month, monthEvents] of eventsByMonth) {
      md += `### ${month}\n`;
      for (const event of monthEvents) {
        const location = event.city && event.state
          ? `${event.city}, ${event.state}`
          : event.city || 'TBA';
        const venue = event.venueName || 'TBA';
        md += `- **${formatDate(event.eventDate)}** — ${venue}, ${location}\n`;
      }
      md += `\n`;
    }
  }

  // Tickets section
  md += `## Tickets\n\n`;
  if (priceRange) {
    md += `Tickets range from ${priceRange} depending on venue and seating. `;
  }
  md += `Check the [${artist.name} page on TourWax](/artists/${artist.slug}) for ticket links and updated dates.\n\n`;

  // What to expect section
  md += `## What to Expect\n\n`;
  md += `<!-- EDIT: Add context about the artist's current era, recent album, or why this tour matters. Some notes from recent headlines: -->\n\n`;

  if (recentNews.length > 0) {
    md += `Recent headlines about ${artist.name}:\n\n`;
    for (const article of recentNews.slice(0, 5)) {
      md += `- ${article.title}\n`;
    }
    md += `\n`;
  }

  // Cities on tour (with internal links)
  if (cities.length > 3) {
    md += `## Cities on the Tour\n\n`;
    md += `The ${year} tour hits ${cities.length} cities including `;
    const linkedCities = cities.slice(0, 5).map(c => {
      const cityName = c.split(',')[0].trim();
      const citySlug = cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
      return `[${c}](/concerts/${citySlug})`;
    });
    md += linkedCities.join(', ');
    if (cities.length > 5) {
      md += `, and ${cities.length - 5} more`;
    }
    md += `.\n\n`;
  }

  // Footer with genre link
  md += `---\n\n`;
  md += `Browse more [${genre} tours](${genreLink}) or explore all [upcoming concerts](/concerts) on TourWax.\n`;

  // Write the file
  const outputPath = path.join(process.cwd(), 'content/blog', `${blogSlug}.md`);

  if (fs.existsSync(outputPath)) {
    console.log(`⚠️  File already exists: ${outputPath}`);
    console.log('   Rename or delete it first if you want to regenerate.\n');
    process.exit(1);
  }

  fs.writeFileSync(outputPath, md, 'utf-8');

  console.log(`✅ Draft saved to: content/blog/${blogSlug}.md\n`);
  console.log('── Summary ──');
  console.log(`  Artist:     ${artist.name}`);
  console.log(`  Genre:      ${genre}`);
  console.log(`  Events:     ${upcomingEvents.length}`);
  console.log(`  Cities:     ${cities.length}`);
  if (priceRange) console.log(`  Prices:     ${priceRange}`);
  if (mostCommonTourName) console.log(`  Tour Name:  ${mostCommonTourName}`);
  console.log(`  Headlines:  ${recentNews.length} recent articles`);
  console.log('');
  console.log('📌 Next steps:');
  console.log('  1. Edit the "What to Expect" section with context about the tour');
  console.log('  2. Review the tour dates for accuracy');
  console.log('  3. Add a featured image if available');
  console.log(`  4. Preview at http://localhost:3000/blog/${blogSlug}`);
}

generateDraft()
  .catch(console.error)
  .finally(() => process.exit(0));
