import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/out'],
      },
      // Meta's AI-training crawler was ~20% of all edge requests (Sep 2026)
      // and brings no search or answer-engine visibility. Its search-index
      // sibling (meta-webindexer) is left allowed. Also denied at the WAF.
      {
        userAgent: 'meta-externalagent',
        disallow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
