import type { Metadata } from 'next';
import { GenrePageView, genreMetadata, genreStaticParams } from './genre-page';

// Page 1 of a genre listing. Pages 2+ live at /tours/[genre]/page/[page]; the
// shared view is in ./genre-page.tsx. No searchParams here, so the route is
// static/ISR instead of a cold function render per request.
export const dynamic = 'force-static';
export const revalidate = 21600; // 6 hours: matches the fetch-tours cron cadence

interface Props {
  params: Promise<{ genre: string }>;
}

export async function generateStaticParams() {
  return genreStaticParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { genre } = await params;
  return genreMetadata(genre, 1);
}

export default async function GenrePage({ params }: Props) {
  const { genre } = await params;
  return <GenrePageView slug={genre} currentPage={1} />;
}
