import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateCanonicalUrl } from '@/lib/seo';
import { normalizeGenre, genreSlug, GENRE_DISPLAY_NAMES } from '@/lib/genres';
import TopStrip from '@/components/TopStrip';
import { getTopTours } from '@/lib/top-lists';
import Pagination from '@/components/Pagination';

export const revalidate = 3600;

const ARTISTS_PER_PAGE = 60;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'];

interface Props {
  searchParams: Promise<{ page?: string; genre?: string; letter?: string; q?: string }>;
}

/** First-letter bucket for the A-Z index: A-Z, everything else under '#'. */
function letterOf(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

/** Normalize/validate the incoming filter params against known values. */
function parseFilters(sp: { genre?: string; letter?: string; q?: string }) {
  const genre = sp.genre && GENRE_DISPLAY_NAMES[sp.genre] ? sp.genre : undefined;
  const letterRaw = sp.letter ? sp.letter.toUpperCase() : undefined;
  const letter = letterRaw && LETTERS.includes(letterRaw) ? letterRaw : undefined;
  const q = (sp.q || '').trim();
  return { genre, letter, q };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const { genre, letter, q } = parseFilters(sp);
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const suffix = currentPage > 1 ? ` - Page ${currentPage}` : '';

  const genreName = genre ? GENRE_DISPLAY_NAMES[genre] : null;
  const title = genreName
    ? `Browse ${genreName} Artists on Tour ${new Date().getFullYear()}${suffix}`
    : `Browse Artists on Tour ${new Date().getFullYear()}${suffix}`;

  // Filtered views are navigational, not landing pages: keep them out of the
  // index and consolidate signals on the canonical /artists URL.
  const hasFilter = Boolean(genre || letter || q);

  return {
    title,
    description: 'Discover artists currently on tour. Find concert dates, tickets, and venues for Hip-Hop, Pop, Rock, Country, and more.',
    alternates: {
      canonical: generateCanonicalUrl('/artists'),
    },
    ...(hasFilter ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ArtistsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { genre, letter, q } = parseFilters(sp);
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  // Fetch the full active roster (lightweight columns) and filter in memory.
  // Genre display names are derived in JS via normalizeGenre(), so a SQL genre
  // filter can't reproduce the buckets (e.g. raw "Jazz" maps to "R&B").
  const allArtists = await db
    .select({ id: artists.id, name: artists.name, slug: artists.slug, imageUrl: artists.imageUrl, genre: artists.genre })
    .from(artists)
    .where(eq(artists.isActive, true))
    .orderBy(artists.name);

  // Per-genre counts (full roster) for the filter chips.
  const genreCounts: Record<string, number> = {};
  for (const a of allArtists) {
    const slug = genreSlug(normalizeGenre(a.genre));
    genreCounts[slug] = (genreCounts[slug] || 0) + 1;
  }

  // Apply active filters.
  let filtered = allArtists;
  if (genre) filtered = filtered.filter((a) => genreSlug(normalizeGenre(a.genre)) === genre);
  if (letter) filtered = filtered.filter((a) => letterOf(a.name) === letter);
  if (q) {
    const lq = q.toLowerCase();
    filtered = filtered.filter((a) => a.name.toLowerCase().includes(lq));
  }

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / ARTISTS_PER_PAGE);
  const pageSlice = filtered.slice((currentPage - 1) * ARTISTS_PER_PAGE, currentPage * ARTISTS_PER_PAGE);

  // Group the current page by normalized genre.
  const artistsByGenre = pageSlice.reduce((acc, artist) => {
    const g = normalizeGenre(artist.genre);
    if (!acc[g]) acc[g] = [];
    acc[g].push(artist);
    return acc;
  }, {} as Record<string, typeof pageSlice>);
  const genres = Object.keys(artistsByGenre).sort();

  const hasFilter = Boolean(genre || letter || q);

  // "Top Artists on Tour" only headlines the unfiltered first page; once the user
  // filters or paginates, the A-Z genre grid takes over.
  const topArtists = !hasFilter && currentPage === 1 ? await getTopTours() : [];

  // Preserve the active filter across pagination links.
  const filterParams = new URLSearchParams();
  if (genre) filterParams.set('genre', genre);
  if (letter) filterParams.set('letter', letter);
  if (q) filterParams.set('q', q);
  const filterQs = filterParams.toString();
  const basePath = filterQs ? `/artists?${filterQs}` : '/artists';

  const chipBase = 'px-3 py-1.5 rounded-full text-sm font-medium transition-colors';
  const chipOn = 'bg-orange-500 text-white';
  const chipOff = 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-5xl md:text-6xl font-black mb-4">
          <span className="gradient-text">All Artists</span>
        </h1>
        <p className="text-xl text-gray-600">
          {hasFilter
            ? `${totalCount} artist${totalCount === 1 ? '' : 's'} match your filters`
            : `Browse ${totalCount} artists across all genres`}
          {totalPages > 1 && ` — Page ${currentPage} of ${totalPages}`}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-10 space-y-5">
        <form action="/artists" method="GET" role="search" className="flex gap-2 max-w-md">
          <label htmlFor="artist-search" className="sr-only">Search artists by name</label>
          <input
            id="artist-search"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search artists by name…"
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button type="submit" className="px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors">
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by genre">
          <Link href="/artists" className={`${chipBase} ${!genre && !letter && !q ? chipOn : chipOff}`}>All</Link>
          {Object.entries(GENRE_DISPLAY_NAMES).map(([slug, name]) =>
            genreCounts[slug] ? (
              <Link
                key={slug}
                href={`/artists?genre=${slug}`}
                className={`${chipBase} ${genre === slug ? chipOn : chipOff}`}
                aria-current={genre === slug ? 'true' : undefined}
              >
                {name} <span className="opacity-70">({genreCounts[slug]})</span>
              </Link>
            ) : null
          )}
        </div>

        <div className="flex flex-wrap gap-1" role="group" aria-label="Jump to letter">
          {LETTERS.map((l) => (
            <Link
              key={l}
              href={`/artists?letter=${encodeURIComponent(l)}`}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-semibold transition-colors ${
                letter === l ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
              aria-current={letter === l ? 'true' : undefined}
            >
              {l}
            </Link>
          ))}
        </div>

        {hasFilter && (
          <Link href="/artists" className="inline-block text-sm font-medium text-orange-600 hover:text-orange-700">
            Clear filters
          </Link>
        )}
      </div>

      {topArtists.length > 0 && (
        <TopStrip
          title="Top Artists on Tour"
          subtitle="Most dates in the next 60 days"
          items={topArtists.map((t) => ({
            href: `/artists/${t.slug}`,
            title: t.name,
            subtitle: t.genre ? normalizeGenre(t.genre) : undefined,
            badgeValue: t.dateCount,
            badgeLabel: t.dateCount === 1 ? 'date' : 'dates',
          }))}
        />
      )}

      {totalCount === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
          <p className="text-gray-500 text-lg">No artists match your filters. Try a different search or genre.</p>
        </div>
      ) : (
        genres.map((g) => (
          <section key={g} className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
              <h2 className="text-3xl font-bold text-gray-900">
                <Link href={`/tours/${genreSlug(g)}`} className="hover:text-orange-600 transition-colors">{g}</Link>
              </h2>
              <div className="h-1 flex-1 bg-gradient-to-r from-red-500 to-transparent rounded-full"></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {artistsByGenre[g].map((artist) => (
                <Link
                  key={artist.id}
                  href={`/artists/${artist.slug}`}
                  className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover overflow-hidden border border-gray-100"
                >
                  <div className="aspect-square bg-gradient-to-br from-orange-400 via-red-400 to-pink-500 relative overflow-hidden">
                    {artist.imageUrl ? (
                      <Image
                        src={artist.imageUrl}
                        alt={artist.name}
                        width={300}
                        height={300}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
                        {artist.name.charAt(0)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  <div className="p-4 bg-white">
                    <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors line-clamp-1">
                      {artist.name}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} basePath={basePath} />
    </div>
  );
}
