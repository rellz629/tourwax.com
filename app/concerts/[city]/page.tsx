import type { Metadata } from 'next';
import { CityPageView, cityMetadata, cityStaticParams } from './city-page';

// Page 1 of a city listing. Pages 2+ live at /concerts/[city]/page/[page]; the
// shared view is in ./city-page.tsx. No searchParams here, so the route is
// static/ISR instead of a cold function render per request.
export const dynamic = 'force-static';
export const revalidate = 21600; // 6 hours: matches the fetch-tours cron cadence

interface Props {
  params: Promise<{ city: string }>;
}

export async function generateStaticParams() {
  return cityStaticParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  return cityMetadata(city, 1);
}

export default async function CityPage({ params }: Props) {
  const { city } = await params;
  return <CityPageView citySlug={city} currentPage={1} />;
}
