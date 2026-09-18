import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { parsePageSegment } from '@/lib/pagination';
import { FestivalsIndexView, festivalsIndexMetadata } from '../../festivals-index';

// Pages 2+ of the festival index, rendered on demand and ISR-cached.
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
  return festivalsIndexMetadata(Math.max(currentPage, 2));
}

export default async function FestivalsDeepPage({ params }: Props) {
  const { page } = await params;
  const currentPage = parsePageSegment(page);
  if (currentPage === null) notFound();
  if (currentPage === 1) permanentRedirect('/festivals');
  return <FestivalsIndexView currentPage={currentPage} />;
}
