/**
 * Bing Webmaster Tools report via its JSON API (key-based).
 *
 * Usage:
 *   npm run bing              # rank & traffic stats + top queries + top pages
 *   npm run bing -- --crawl   # crawl stats (pages crawled, errors, in index)
 *
 * Auth: BING_WEBMASTER_API_KEY in .env.local (Bing Webmaster Tools ->
 * Settings -> API access -> API Key). Bing is the primary traffic channel,
 * so this is the report that matters week to week.
 */

const SITE = 'https://www.tourwax.com/';
const API = 'https://ssl.bing.com/webmaster/api.svc/json';

async function call<T>(method: string, params: Record<string, string> = {}): Promise<T> {
  const key = process.env.BING_WEBMASTER_API_KEY;
  if (!key) {
    console.error('BING_WEBMASTER_API_KEY is not set in .env.local');
    process.exit(1);
  }
  const qs = new URLSearchParams({ apikey: key, siteUrl: SITE, ...params });
  const res = await fetch(`${API}/${method}?${qs}`);
  if (!res.ok) {
    throw new Error(`${method} failed: HTTP ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { d: T };
  return body.d;
}

// Bing returns dates as "/Date(1721606400000-0700)/"
function fmtBingDate(s: string): string {
  const ms = Number(/\/Date\((\d+)/.exec(s)?.[1]);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : s;
}

interface RankAndTraffic {
  Date: string;
  Clicks: number;
  Impressions: number;
}
interface QueryStat {
  Query: string;
  Clicks: number;
  Impressions: number;
  AvgClickPosition: number;
  AvgImpressionPosition: number;
}
interface PageStat {
  Query: string; // API reuses the field name for the page URL
  Clicks: number;
  Impressions: number;
}
interface CrawlStat {
  Date: string;
  CrawledPages: number;
  InIndex: number;
  InLinks: number;
  AllOtherCodes: number;
  Code2xx: number;
  Code301: number;
  Code302: number;
  Code4xx: number;
  Code5xx: number;
}

async function main() {
  if (process.argv.includes('--crawl')) {
    const stats = await call<CrawlStat[]>('GetCrawlStats');
    console.log('CRAWL STATS (date / crawled / in index / 2xx / 4xx / 5xx):');
    for (const s of stats.slice(-28)) {
      console.log(
        `  ${fmtBingDate(s.Date)}  ${s.CrawledPages}  ${s.InIndex}  ${s.Code2xx}  ${s.Code4xx}  ${s.Code5xx}`
      );
    }
    return;
  }

  const [traffic, queries, pages] = await Promise.all([
    call<RankAndTraffic[]>('GetRankAndTrafficStats'),
    call<QueryStat[]>('GetQueryStats'),
    call<PageStat[]>('GetPageStats'),
  ]);

  const recent = traffic.slice(-28);
  const totals = recent.reduce(
    (a, r) => ({ clicks: a.clicks + r.Clicks, impressions: a.impressions + r.Impressions }),
    { clicks: 0, impressions: 0 }
  );
  console.log(`LAST ${recent.length} DAYS: ${totals.clicks} clicks, ${totals.impressions} impressions\n`);

  console.log('BY DAY (date / clicks / impressions):');
  for (const r of recent) {
    console.log(`  ${fmtBingDate(r.Date)}  ${r.Clicks}  ${r.Impressions}`);
  }

  const topQueries = [...queries].sort((a, b) => b.Clicks - a.Clicks).slice(0, 20);
  console.log('\nTOP QUERIES (clicks / impressions / avg click pos):');
  for (const q of topQueries) {
    console.log(`  ${q.Clicks}  ${q.Impressions}  ${q.AvgClickPosition}  ${q.Query}`);
  }

  const topPages = [...pages].sort((a, b) => b.Clicks - a.Clicks).slice(0, 20);
  console.log('\nTOP PAGES (clicks / impressions):');
  for (const p of topPages) {
    console.log(`  ${p.Clicks}  ${p.Impressions}  ${p.Query}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
