import { NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/blog';
import { submitToIndexNow } from '@/lib/indexnow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Posts with a future publishedAt go live when the date passes, not on a
// deploy, so there is no deploy moment to trigger a manual submission. This
// daily cron catches those, plus any deploys where the manual
// `npm run indexnow -- --recent` was forgotten. Resubmitting an already
// known URL is a no-op for Bing, so the 2-day overlap window is safe.
const WINDOW_DAYS = 2;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = getAllPosts().filter(
    (p) => new Date(p.updatedAt || p.publishedAt).getTime() >= cutoff
  );

  if (recent.length === 0) {
    return NextResponse.json({ submitted: 0, urls: [] });
  }

  const urls = [...recent.map((p) => `/blog/${p.slug}`), '/blog', '/'];

  try {
    const result = await submitToIndexNow(urls);
    if (!result.ok) {
      return NextResponse.json(
        { error: `IndexNow rejected submission: HTTP ${result.status}`, urls },
        { status: 502 }
      );
    }
    return NextResponse.json({ submitted: result.submitted, status: result.status, urls });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'IndexNow submission failed' },
      { status: 500 }
    );
  }
}
