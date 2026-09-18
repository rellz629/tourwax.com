import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { parsePageSegment } from '@/lib/pagination';
import { GenrePageView, genreMetadata } from '../../genre-page';

// Pages 2+ of a genre listing, rendered on demand and ISR-cached. Page 1 is
// /tours/[genre]; a /page/1 request redirects there so it has one URL.
export const dynamic = 'force-static';
export const revalidate = 21600; // 6 hours: matches the fetch-tours cron cadence

interface Props {
  params: Promise<{ genre: string; page: string }>;
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { genre, page } = await params;
  const currentPage = parsePageSegment(page);
  if (currentPage === null) return { title: 'Page Not Found' };
  return genreMetadata(genre, Math.max(currentPage, 2));
}

export default async function GenreDeepPage({ params }: Props) {
  const { genre, page } = await params;
  const currentPage = parsePageSegment(page);
  if (currentPage === null) notFound();
  if (currentPage === 1) permanentRedirect(`/tours/${genre}`);
  return <GenrePageView slug={genre} currentPage={currentPage} />;
}
