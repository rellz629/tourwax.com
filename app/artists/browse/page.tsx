import type { Metadata } from 'next';
import { ArtistsIndexView, artistsIndexMetadata, type ArtistFilters } from '../artists-index';

// Filtered artist index (search, genre chip, letter jump). This is the one
// dynamic route of the three; it is noindex and paginates with ?page=N.
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ page?: string; genre?: string; letter?: string; q?: string }>;
}

function parse(sp: { page?: string; genre?: string; letter?: string; q?: string }) {
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const filters: ArtistFilters = { genre: sp.genre, letter: sp.letter, q: sp.q };
  return { currentPage, filters };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { currentPage, filters } = parse(await searchParams);
  return artistsIndexMetadata(currentPage, filters);
}

export default async function ArtistsBrowsePage({ searchParams }: Props) {
  const { currentPage, filters } = parse(await searchParams);
  return <ArtistsIndexView currentPage={currentPage} filters={filters} />;
}
