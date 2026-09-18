import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { parsePageSegment } from '@/lib/pagination';
import { CityPageView, cityMetadata } from '../../city-page';

// Pages 2+ of a city listing, rendered on demand and ISR-cached. Page 1 is
// /concerts/[city]; a /page/1 request redirects there so it has one URL.
export const dynamic = 'force-static';
export const revalidate = 21600; // 6 hours: matches the fetch-tours cron cadence

interface Props {
  params: Promise<{ city: string; page: string }>;
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, page } = await params;
  const currentPage = parsePageSegment(page);
  if (currentPage === null) return { title: 'Page Not Found' };
  return cityMetadata(city, Math.max(currentPage, 2));
}

export default async function CityDeepPage({ params }: Props) {
  const { city, page } = await params;
  const currentPage = parsePageSegment(page);
  if (currentPage === null) notFound();
  if (currentPage === 1) permanentRedirect(`/concerts/${city}`);
  return <CityPageView citySlug={city} currentPage={currentPage} />;
}
