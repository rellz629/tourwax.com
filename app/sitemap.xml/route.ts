import { renderSitemapIndex } from '@/lib/sitemap-sections';

// Sitemap index. Each section is its own ISR entry at /sitemaps/<section>.xml
// (see lib/sitemap-sections.ts for why the single 700 KB sitemap was split).
export const dynamic = 'force-static';
export const revalidate = 21600; // 6 hours: matches the fetch-tours cron cadence

export function GET() {
  return new Response(renderSitemapIndex(), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
