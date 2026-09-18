import type { Metadata } from 'next';
import { VenuePageView, venueMetadata, venueStaticParams } from './venue-page';

// Page 1 of a venue's schedule. Pages 2+ live at /venues/[slug]/page/[page];
// the shared view is in ./venue-page.tsx. No searchParams here, so the route
// is static/ISR instead of a cold function render per request.
export const dynamic = 'force-static';
export const revalidate = 21600; // 6 hours: matches the fetch-tours cron cadence

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return venueStaticParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return venueMetadata(slug, 1);
}

export default async function VenuePage({ params }: Props) {
  const { slug } = await params;
  return <VenuePageView venueSlug={slug} currentPage={1} />;
}
