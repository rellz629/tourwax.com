import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    <div className="max-w-7xl mx-auto px-4 py-20">
      <h1 className="text-4xl font-bold mb-4">
        {artist.name} ✅
      </h1>
      <p className="text-xl">Genre: {artist.genre}</p>
      <p className="mt-4">If you see this, the database query works!</p>

      <a
        href="/artists"
        className="mt-8 inline-block px-6 py-3 bg-blue-500 text-white rounded-lg"
      >
        Back to Artists
      </a>
    </div>
  );
}
