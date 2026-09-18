import type { Metadata } from 'next';
import { VenuesIndexView, venuesIndexMetadata } from './venues-index';

// Unfiltered page 1 of the venue index. Pages 2+ live at /venues/page/[page]
// and search/state filters at /venues/browse; see ./venues-index.tsx.
export const dynamic = 'force-static';
export const revalidate = 21600; // 6 hours: matches the fetch-tours cron cadence

export async function generateMetadata(): Promise<Metadata> {
  return venuesIndexMetadata(1, {});
}

export default async function VenuesPage() {
  return <VenuesIndexView currentPage={1} filters={{}} />;
}
