import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAllFestivals } from '@/lib/festivals';
import { normalizeGenre } from '@/lib/genres';

export const dynamic = 'force-static';
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const year = new Date().getFullYear();
  const title = `Compare Festival Lineups ${year} — Side-by-Side | TourWax`;
  const description = `Compare music festival lineups side by side. See which artists are playing multiple festivals, compare prices, and find the best festival for you.`;
  const url = `${SITE_URL}/festivals/compare`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function FestivalComparePage() {
  const allFestivals = await getAllFestivals();

  // Only show festivals with meaningful lineups (5+ artists)
  const festivals = allFestivals.filter(f => f.artistCount >= 3);

  // Find artists appearing at multiple festivals
  const artistFestivalMap = new Map<string, { name: string; slug: string; imageUrl: string | null; genre: string | null; festivals: string[] }>();
  for (const festival of festivals) {
    for (const artist of festival.artists) {
      const existing = artistFestivalMap.get(artist.slug);
      if (existing) {
        existing.festivals.push(festival.name);
      } else {
        artistFestivalMap.set(artist.slug, {
          ...artist,
          festivals: [festival.name],
        });
      }
    }
  }

  const multiFestivalArtists = Array.from(artistFestivalMap.values())
    .filter(a => a.festivals.length >= 2)
    .sort((a, b) => b.festivals.length - a.festivals.length);

  // Compute genre breakdown per festival
  const festivalGenres = festivals.map(f => {
    const genreCounts = new Map<string, number>();
    for (const artist of f.artists) {
      const genre = normalizeGenre(artist.genre);
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    }
    const sorted = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    return { festival: f, genres: sorted };
  });

  // Price comparison
  const festivalPrices = festivals.map(f => {
    const prices = f.events
      .map(e => e.minPrice)
      .filter((p): p is number => p !== null && p > 0);
    return {
      festival: f,
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
      maxPrice: prices.length > 0 ? Math.max(...prices) : null,
    };
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Festivals', url: `${SITE_URL}/festivals` },
    { name: 'Compare', url: `${SITE_URL}/festivals/compare` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Festivals', url: '/festivals' },
    { name: 'Compare Lineups', url: '/festivals/compare' },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            Compare <span className="gradient-text">Festival Lineups</span>
          </h1>
          <p className="text-xl text-gray-600">
            {festivals.length} upcoming festival{festivals.length === 1 ? '' : 's'} — compare lineups, prices, and genres side by side
          </p>
          <div className="flex gap-3 mt-4">
            <Link href="/festivals" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">All Festivals</Link>
          </div>
        </div>

        {festivals.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No festivals detected yet. Check back soon or browse <Link href="/concerts/this-week" className="text-orange-500 hover:text-orange-600 font-medium">this week&apos;s concerts</Link>.</p>
          </div>
        ) : (
          <>
            {/* Comparison Table */}
            <section className="mb-16">
              <h2 className="text-3xl font-bold mb-6">
                At a <span className="gradient-text">Glance</span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th scope="col" className="text-left px-6 py-4 text-sm font-bold text-gray-900">Festival</th>
                      <th scope="col" className="text-left px-6 py-4 text-sm font-bold text-gray-900">Date</th>
                      <th scope="col" className="text-left px-6 py-4 text-sm font-bold text-gray-900">Location</th>
                      <th scope="col" className="text-center px-6 py-4 text-sm font-bold text-gray-900">Artists</th>
                      <th scope="col" className="text-left px-6 py-4 text-sm font-bold text-gray-900">Top Genre</th>
                      <th scope="col" className="text-right px-6 py-4 text-sm font-bold text-gray-900">From</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {festivalPrices.map(({ festival, minPrice }, i) => {
                      const genreInfo = festivalGenres.find(fg => fg.festival.slug === festival.slug);
                      const topGenre = genreInfo?.genres[0];
                      return (
                        <tr key={festival.slug} className="hover:bg-orange-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <Link href={`/festivals/${festival.slug}`} className="font-semibold text-gray-900 hover:text-orange-600 transition-colors">
                              {festival.name}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                            {new Date(festival.date + 'T12:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {[festival.venue.city, festival.venue.state].filter(Boolean).join(', ')}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-1 bg-orange-50 text-orange-600 text-xs font-bold rounded-full">
                              {festival.artistCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {topGenre ? topGenre[0] : '—'}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-semibold text-orange-600">
                            {minPrice ? `$${minPrice}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Artists Playing Multiple Festivals */}
            {multiFestivalArtists.length > 0 && (
              <section className="mb-16">
                <h2 className="text-3xl font-bold mb-2">
                  Playing <span className="gradient-text">Multiple Festivals</span>
                </h2>
                <p className="text-gray-500 mb-6">These artists are appearing at more than one festival</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {multiFestivalArtists.slice(0, 16).map((artist) => (
                    <Link
                      key={artist.slug}
                      href={`/artists/${artist.slug}`}
                      className="group bg-white rounded-xl shadow-md hover:shadow-lg p-4 border border-gray-100 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-400 to-red-500">
                          {artist.imageUrl ? (
                            <Image src={artist.imageUrl} alt={artist.name} width={48} height={48} className="w-full h-full object-cover" sizes="48px" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-bold">{artist.name.charAt(0)}</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors text-sm truncate">{artist.name}</p>
                          <p className="text-xs text-orange-600 font-medium mt-0.5">{artist.festivals.length} festivals</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {artist.festivals.map((festName, i) => (
                          <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded truncate max-w-full">
                            {festName.length > 30 ? festName.slice(0, 30) + '...' : festName}
                          </span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Genre Breakdown Per Festival */}
            <section>
              <h2 className="text-3xl font-bold mb-6">
                Genre <span className="gradient-text">Breakdown</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {festivalGenres.slice(0, 8).map(({ festival, genres }) => (
                  <div key={festival.slug} className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                    <Link href={`/festivals/${festival.slug}`} className="font-bold text-gray-900 hover:text-orange-600 transition-colors">
                      {festival.name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-1 mb-4">
                      {festival.venue.city}{festival.venue.state ? `, ${festival.venue.state}` : ''} — {festival.artistCount} artists
                    </p>
                    <div className="space-y-2">
                      {genres.slice(0, 5).map(([genre, count]) => {
                        const pct = Math.round((count / festival.artistCount) * 100);
                        return (
                          <div key={genre}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-700">{genre}</span>
                              <span className="text-gray-500 text-xs">{count} artist{count === 1 ? '' : 's'} ({pct}%)</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-orange-500 to-red-500 rounded-full h-2"
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
