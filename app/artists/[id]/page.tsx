import { db } from '@/db';
import { artists, events, venues, newsArticles } from '@/db/schema';
import { eq, gte, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const revalidate = 1800; // Revalidate every 30 minutes

interface Props {
  params: Promise<{ id: string }>;
}

async function getArtist(id: string) {
  const artist = await db.query.artists.findFirst({
    where: eq(artists.id, id),
  });

  if (!artist) return null;
  return artist;
}

async function getArtistEvents(artistId: string) {
  const now = new Date();

  const artistEvents = await db
    .select({
      event: events,
      venue: venues,
    })
    .from(events)
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(
      eq(events.artistId, artistId),
      gte(events.eventDate, now)
    ))
    .orderBy(events.eventDate);

  return artistEvents;
}

async function getArtistNews(artistId: string) {
  const news = await db
    .select()
    .from(newsArticles)
    .where(eq(newsArticles.artistId, artistId))
    .orderBy(newsArticles.publishedAt)
    .limit(10);

  return news;
}

export default async function ArtistPage({ params }: Props) {
  const { id } = await params;

  const [artist, artistEvents, news] = await Promise.all([
    getArtist(id),
    getArtistEvents(id),
    getArtistNews(id),
  ]);

  if (!artist) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Artist Header */}
      <div className="mb-12">
        <div className="flex items-start gap-8">
          <div className="w-48 h-48 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-500 to-pink-500">
            {artist.imageUrl ? (
              <img
                src={artist.imageUrl}
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-6xl font-bold">
                {artist.name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-5xl font-bold text-gray-900 mb-2">
              {artist.name}
            </h1>
            {artist.genre && (
              <p className="text-xl text-gray-600 mb-4">{artist.genre}</p>
            )}
            <div className="flex gap-4 text-sm text-gray-500">
              <span>{artistEvents.length} upcoming shows</span>
              {news.length > 0 && <span>•</span>}
              {news.length > 0 && <span>{news.length} recent articles</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tour Dates */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Tour Dates</h2>
          {artistEvents.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
              No upcoming tour dates announced yet.
            </div>
          ) : (
            <div className="space-y-4">
              {artistEvents.map(({ event, venue }) => (
                <div
                  key={event.id}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2">
                        {event.name}
                      </h3>
                      {venue && (
                        <div className="text-sm text-gray-600 space-y-1">
                          <p className="font-medium">{venue.name}</p>
                          <p>
                            {[venue.city, venue.state, venue.country]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <span className="text-gray-500">
                          {new Date(event.eventDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500">
                          {new Date(event.eventDate).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {(event.minPrice || event.maxPrice) && (
                        <p className="mt-2 text-sm text-gray-600">
                          From {event.currency} {event.minPrice || event.maxPrice}
                          {event.maxPrice && event.minPrice !== event.maxPrice &&
                            ` - ${event.currency} ${event.maxPrice}`}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {event.ticketUrl && (
                        <a
                          href={event.ticketUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium text-center whitespace-nowrap"
                        >
                          Get Tickets
                        </a>
                      )}
                      <span className="text-xs text-gray-400 capitalize">
                        via {event.source}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* News Sidebar */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Latest News</h2>
          {news.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500 text-sm">
              No recent news articles.
            </div>
          ) : (
            <div className="space-y-4">
              {news.map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
                >
                  {article.imageUrl && (
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-full h-32 object-cover rounded mb-3"
                    />
                  )}
                  <h3 className="font-medium text-gray-900 mb-2 text-sm line-clamp-2">
                    {article.title}
                  </h3>
                  {article.summary && (
                    <p className="text-xs text-gray-600 mb-2 line-clamp-3">
                      {article.summary}
                    </p>
                  )}
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    {article.source && <span>{article.source}</span>}
                    <span>
                      {new Date(article.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
