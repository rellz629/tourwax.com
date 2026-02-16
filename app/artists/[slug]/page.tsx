import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Bypass layout to test if layout is causing the hang
export const metadata = {
  title: 'Test Artist Page',
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ArtistPageSimple({ params }: Props) {
  const { slug } = await params;

  // Use regular select instead of query builder
  const result = await db
    .select()
    .from(artists)
    .where(eq(artists.slug, slug))
    .limit(1);

  const artist = result[0];

  if (!artist) {
    notFound();
  }

  return (
    <html>
      <body>
        <h1>{artist.name}</h1>
        <p>Genre: {artist.genre}</p>
        <p>ID: {artist.id}</p>
        <a href="/artists">Back</a>
      </body>
    </html>
  );
}
