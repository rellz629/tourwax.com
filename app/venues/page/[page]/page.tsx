import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { parsePageSegment } from '@/lib/pagination';
import { VenuesIndexView, venuesIndexMetadata } from '../../venues-index';

// Pages 2+ of the unfiltered venue index, rendered on demand and ISR-cached.
export const dynamic = 'force-static';
export const revalidate = 21600; // 6 hours: matches the fetch-tours cron cadence

interface Props {
  params: Promise<{ page: string }>;
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params;
  const currentPage = parsePageSegment(page);
  if (currentPage === null) return { title: 'Page Not Found' };
  return venuesIndexMetadata(Math.max(currentPage, 2), {});
}

export default async function VenuesDeepPage({ params }: Props) {
  const { page } = await params;
  const currentPage = parsePageSegment(page);
  if (currentPage === null) notFound();
  if (currentPage === 1) permanentRedirect('/venues');
  return <VenuesIndexView currentPage={currentPage} filters={{}} />;
}
