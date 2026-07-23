/**
 * Search Console report via the GSC API (service account).
 *
 * Usage:
 *   npm run gsc                    # last 28 days: totals by day + top queries + top pages
 *   npm run gsc -- --days 7
 *   npm run gsc -- --inspect /blog/who-is-opening-for-morgan-wallen-2026-tour
 *
 * Auth: GOOGLE_APPLICATION_CREDENTIALS in .env.local points at the
 * tourwax-reports service account JSON key. The service account email must
 * be added under Settings -> Users and permissions in Search Console.
 */
import { google } from 'googleapis';

const SITE = 'sc-domain:tourwax.com';
const SITE_FALLBACK = 'https://www.tourwax.com/';

async function getClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  return google.searchconsole({ version: 'v1', auth });
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function resolveSite(sc: Awaited<ReturnType<typeof getClient>>): Promise<string> {
  const { data } = await sc.sites.list();
  const urls = (data.siteEntry || []).map((s) => s.siteUrl!);
  if (urls.includes(SITE)) return SITE;
  if (urls.includes(SITE_FALLBACK)) return SITE_FALLBACK;
  if (urls.length > 0) return urls[0];
  throw new Error(
    'Service account has no Search Console properties. Add tourwax-reports@tourwax.iam.gserviceaccount.com in GSC Settings -> Users and permissions.'
  );
}

async function queryReport(sc: Awaited<ReturnType<typeof getClient>>, site: string, days: number) {
  // GSC data lags ~2-3 days; shift the window back so rows aren't empty.
  const end = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const base = { startDate: fmtDate(start), endDate: fmtDate(end) };
  console.log(`Site: ${site}\nWindow: ${base.startDate} to ${base.endDate} (GSC data lags ~3 days)\n`);

  const [byDay, byQuery, byPage] = await Promise.all([
    sc.searchanalytics.query({ siteUrl: site, requestBody: { ...base, dimensions: ['date'], rowLimit: 100 } }),
    sc.searchanalytics.query({ siteUrl: site, requestBody: { ...base, dimensions: ['query'], rowLimit: 20 } }),
    sc.searchanalytics.query({ siteUrl: site, requestBody: { ...base, dimensions: ['page'], rowLimit: 20 } }),
  ]);

  const days_ = byDay.data.rows || [];
  const totals = days_.reduce(
    (a, r) => ({ clicks: a.clicks + (r.clicks || 0), impressions: a.impressions + (r.impressions || 0) }),
    { clicks: 0, impressions: 0 }
  );
  console.log(`TOTALS: ${totals.clicks} clicks, ${totals.impressions} impressions\n`);

  console.log('BY DAY (date / clicks / impressions / avg position):');
  for (const r of days_) {
    console.log(`  ${r.keys?.[0]}  ${r.clicks}  ${r.impressions}  ${r.position?.toFixed(1)}`);
  }

  console.log('\nTOP QUERIES (clicks / impressions / position):');
  for (const r of byQuery.data.rows || []) {
    console.log(`  ${r.clicks}  ${r.impressions}  ${r.position?.toFixed(1)}  ${r.keys?.[0]}`);
  }

  console.log('\nTOP PAGES (clicks / impressions / position):');
  for (const r of byPage.data.rows || []) {
    console.log(`  ${r.clicks}  ${r.impressions}  ${r.position?.toFixed(1)}  ${r.keys?.[0]}`);
  }
}

async function inspectUrl(sc: Awaited<ReturnType<typeof getClient>>, site: string, pathOrUrl: string) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `https://www.tourwax.com${pathOrUrl}`;
  const { data } = await sc.urlInspection.index.inspect({
    requestBody: { inspectionUrl: url, siteUrl: site },
  });
  const r = data.inspectionResult?.indexStatusResult;
  console.log(`URL: ${url}`);
  console.log(`  Verdict:        ${r?.verdict}`);
  console.log(`  Coverage:       ${r?.coverageState}`);
  console.log(`  Last crawled:   ${r?.lastCrawlTime || 'never'}`);
  console.log(`  Google canonical: ${r?.googleCanonical || 'n/a'}`);
  console.log(`  Robots/index:   ${r?.robotsTxtState} / ${r?.indexingState}`);
}

async function main() {
  const args = process.argv.slice(2);
  const sc = await getClient();
  const site = await resolveSite(sc);

  const inspectIdx = args.indexOf('--inspect');
  if (inspectIdx !== -1) {
    const target = args[inspectIdx + 1];
    if (!target) {
      console.error('Usage: npm run gsc -- --inspect <path-or-url>');
      process.exit(1);
    }
    await inspectUrl(sc, site, target);
    return;
  }

  const daysIdx = args.indexOf('--days');
  const days = daysIdx !== -1 ? Number(args[daysIdx + 1]) : 28;
  if (!Number.isFinite(days) || days <= 0) {
    console.error(`Invalid --days value: ${args[daysIdx + 1]}`);
    process.exit(1);
  }
  await queryReport(sc, site, days);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
