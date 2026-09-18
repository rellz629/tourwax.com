import { notFound } from 'next/navigation';
import {
  SITEMAP_SECTIONS,
  getSitemapSection,
  isSitemapSection,
  renderUrlset,
} from '@/lib/sitemap-sections';

// One sitemap file per section, listed by /sitemap.xml. Static params carry
// the ".xml" suffix so the public URL is /sitemaps/artists.xml.
export const dynamic = 'force-static';
export const revalidate = 21600; // 6 hours: matches the fetch-tours cron cadence

interface Props {
  params: Promise<{ section: string }>;
}

export function generateStaticParams() {
  return SITEMAP_SECTIONS.map((section) => ({ section: `${section}.xml` }));
}

export async function GET(_request: Request, { params }: Props) {
  const { section: raw } = await params;
  const section = raw.endsWith('.xml') ? raw.slice(0, -4) : raw;
  if (!isSitemapSection(section)) notFound();

  const entries = await getSitemapSection(section);
  return new Response(renderUrlset(entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
