import { NextResponse } from 'next/server';
import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;

    const result = await db
      .select()
      .from(artists)
      .where(eq(artists.slug, slug))
      .limit(1);

    const artist = result[0];

    if (!artist) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      artist: {
        id: artist.id,
        name: artist.name,
        slug: artist.slug,
        genre: artist.genre,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
