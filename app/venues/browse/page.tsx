import type { Metadata } from 'next';
import { VenuesIndexView, venuesIndexMetadata, type VenueFilters } from '../venues-index';

// Filtered venue index (name search, state). This is the one dynamic route of
// the three; it is noindex and paginates with ?page=N.
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ page?: string; q?: string; state?: string }>;
}

function parse(sp: { page?: string; q?: string; state?: string }) {
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const filters: VenueFilters = { q: sp.q, state: sp.state };
  return { currentPage, filters };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { currentPage, filters } = parse(await searchParams);
  return venuesIndexMetadata(currentPage, filters);
}

export default async function VenuesBrowsePage({ searchParams }: Props) {
  const { currentPage, filters } = parse(await searchParams);
  return <VenuesIndexView currentPage={currentPage} filters={filters} />;
}
