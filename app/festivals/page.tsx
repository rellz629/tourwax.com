import type { Metadata } from 'next';
import { FestivalsIndexView, festivalsIndexMetadata } from './festivals-index';

// Page 1 of the festival index. Pages 2+ live at /festivals/page/[page]; the
// shared view is in ./festivals-index.tsx.
export const dynamic = 'force-static';
export const revalidate = 21600; // 6 hours: matches the fetch-tours cron cadence

export async function generateMetadata(): Promise<Metadata> {
  return festivalsIndexMetadata(1);
}

export default async function FestivalsPage() {
  return <FestivalsIndexView currentPage={1} />;
}
