import Link from 'next/link';
import type { Metadata } from 'next';
import { generateFestivalsIndexMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAllFestivals } from '@/lib/festivals';
import { slugify } from '@/lib/slugify';
import Pagination from '@/components/Pagination';

export const revalidate = 1800;

const FESTIVALS_PER_PAGE = 60;

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return generateFestivalsIndexMetadata();
}

export default async function FestivalsPage({ searchParams }: Props) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page || '1', 10) || 1);
  const allFestivals = await getAllFestivals();
  const totalPages = Math.ceil(allFestivals.length / FESTIVALS_PER_PAGE);
  const festivals = allFestivals.slice(
    (currentPage - 1) * FESTIVALS_PER_PAGE,
    currentPage * FESTIVALS_PER_PAGE
  );

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Festivals', url: `${SITE_URL}/festivals` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Festivals', url: '/festivals' },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Festivals & Multi-Artist Events</span>
          </h1>
          <p className="text-xl text-gray-600">
            {allFestivals.length} upcoming festival{allFestivals.length === 1 ? '' : 's'} and multi-artist event{allFestivals.length === 1 ? '' : 's'}
            {totalPages > 1 && ` — Page ${currentPage} of ${totalPages}`}
          </p>
          {allFestivals.length >= 2 && (
            <div className="flex gap-3 mt-4">
              <Link href="/festivals/compare" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-2.5 rounded-lg transition-colors">Compare Lineups</Link>
            </div>
          )}
        </div>

        {festivals.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">No upcoming festivals detected yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {festivals.map((festival) => {
              const locationParts: string[] = [];
              if (festival.venue.city) locationParts.push(festival.venue.city);
              if (festival.venue.state) locationParts.push(festival.venue.state);
              const locationLabel = locationParts.join(', ');

              return (
                <Link
                  key={festival.slug}
                  href={`/festivals/${festival.slug}`}
                  className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover overflow-hidden border border-gray-100"
                >
                  <div className="h-3 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600"></div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="inline-block px-3 py-1 text-xs font-semibold text-orange-600 bg-orange-50 rounded-full">
                        {festival.artistCount} Artists
                      </span>
                      {festival.isMultiDay && (
                        <span className="inline-block px-3 py-1 text-xs font-semibold text-purple-600 bg-purple-50 rounded-full">
                          {festival.days.length} Days
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {festival.formattedDateRange}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 group-hover:text-orange-500 transition-colors mb-2">
                      {festival.name}
                    </h2>
                    <p className="text-sm text-gray-600 mb-1">
                      {festival.venue.name}
                    </p>
                    {locationLabel && (
                      <p className="text-sm text-gray-500 mb-3">
                        {locationLabel}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {festival.artists.slice(0, 5).map((a) => a.name).join(', ')}
                      {festival.artists.length > 5 && `, +${festival.artists.length - 5} more`}
                    </p>
                    <div className="mt-4 text-sm font-semibold text-orange-500 group-hover:text-orange-600 transition-colors">
                      View Lineup →
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/festivals" />
      </div>
    </>
  );
}
