import Link from 'next/link';
import type { Metadata } from 'next';
import { generateInsightsIndexMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';

export const dynamic = 'force-static';
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  return generateInsightsIndexMetadata();
}

const INSIGHTS = [
  {
    title: 'Most Toured Cities of 2026',
    description: 'Which cities are hosting the most concerts this year? We ranked the top 50 cities by event count with artist breakdowns.',
    href: '/insights/most-toured-cities',
    icon: (
      <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Busiest Touring Artists of 2026',
    description: 'Who is playing the most shows this year? See the top 50 artists ranked by upcoming event count.',
    href: '/insights/busiest-touring-artists',
    icon: (
      <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
  {
    title: 'Top Concert Venues of 2026',
    description: 'Which venues are hosting the most shows? The top 50 busiest concert venues ranked by upcoming event count.',
    href: '/insights/top-concert-venues',
    icon: (
      <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    title: 'Busiest Touring Months of 2026',
    description: 'When is the best time to catch a concert? See which months have the most shows, top artists, and busiest cities.',
    href: '/insights/busiest-touring-months',
    icon: (
      <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export default function InsightsPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Insights', url: `${SITE_URL}/insights` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Insights', url: '/insights' },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Live Music Insights</span>
          </h1>
          <p className="text-xl text-gray-600">
            Data-driven analysis of the concert touring landscape
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {INSIGHTS.map((insight) => (
            <Link
              key={insight.href}
              href={insight.href}
              className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover overflow-hidden border border-gray-100"
            >
              <div className="h-3 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600"></div>
              <div className="p-8">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-red-100 rounded-xl flex items-center justify-center mb-4">
                  {insight.icon}
                </div>
                <h2 className="text-xl font-bold text-gray-900 group-hover:text-orange-500 transition-colors mb-3">
                  {insight.title}
                </h2>
                <p className="text-gray-600 mb-4">
                  {insight.description}
                </p>
                <span className="text-sm font-semibold text-orange-500 group-hover:text-orange-600 transition-colors">
                  View Rankings →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-2">More from TourWax</h2>
          <p className="text-gray-600 mb-4">
            Looking for concert tips and tour news? Check out the blog for guides, artist spotlights, and more.
          </p>
          <Link
            href="/blog"
            className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
          >
            Visit the Blog →
          </Link>
        </div>
      </div>
    </>
  );
}
