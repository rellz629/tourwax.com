import type { Metadata } from 'next';
import { ArtistsIndexView, artistsIndexMetadata } from './artists-index';

// Unfiltered page 1 of the artist index. Pages 2+ live at /artists/page/[page]
// and search/genre/letter filters at /artists/browse; see ./artists-index.tsx.
export const dynamic = 'force-static';
export const revalidate = 21600; // 6 hours: matches the fetch-tours cron cadence

export async function generateMetadata(): Promise<Metadata> {
  return artistsIndexMetadata(1, {});
}

export default async function ArtistsPage() {
  return <ArtistsIndexView currentPage={1} filters={{}} />;
}
