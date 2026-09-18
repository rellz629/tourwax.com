import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { parsePageSegment } from '@/lib/pagination';
import { VenuePageView, venueMetadata } from '../../venue-page';

// Pages 2+ of a venue's schedule, rendered on demand and ISR-cached. Page 1 is
// /venues/[slug]; a /page/1 request redirects there so it has one URL.
export const dynamic = 'force-static';
export const revalidate = 21600; // 6 hours: matches the fetch-tours cron cadence

interface Props {
  params: Promise<{ slug: string; page: string }>;
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page } = await params;
  const currentPage = parsePageSegment(page);
  if (currentPage === null) return { title: 'Page Not Found' };
  return venueMetadata(slug, Math.max(currentPage, 2));
}

export default async function VenueDeepPage({ params }: Props) {
  const { slug, page } = await params;
  const currentPage = parsePageSegment(page);
  if (currentPage === null) notFound();
  if (currentPage === 1) permanentRedirect(`/venues/${slug}`);
  return <VenuePageView venueSlug={slug} currentPage={currentPage} />;
}
