/**
 * Impact.com (Ticketmaster affiliate) performance report.
 *
 * Usage:
 *   npm run impact                # last 30 days: clicks/actions/earnings by day + by brand
 *   npm run impact -- --days 90   # widen the window
 *   npm run impact -- --actions   # list individual actions (conversions) in the window
 *
 * Auth: IMPACT_ACCOUNT_SID + IMPACT_AUTH_TOKEN in .env.local (Basic auth).
 * Note: the raw /Clicks endpoint is not enabled for this account (403); click
 * counts come from the partner_performance_by_* reports instead.
 */

const SID = process.env.IMPACT_ACCOUNT_SID;
const TOKEN = process.env.IMPACT_AUTH_TOKEN;
const API = 'https://api.impact.com/Mediapartners';

interface ReportPage {
  Records: Record<string, string>[];
  '@total': string;
}

async function report(id: string, params: Record<string, string>): Promise<Record<string, string>[]> {
  if (!SID || !TOKEN) {
    console.error('IMPACT_ACCOUNT_SID / IMPACT_AUTH_TOKEN are not set in .env.local');
    process.exit(1);
  }
  const qs = new URLSearchParams({ PageSize: '10000', ...params });
  const res = await fetch(`${API}/${SID}/Reports/${id}?${qs}`, {
    headers: {
      Accept: 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64'),
    },
  });
  if (!res.ok) {
    throw new Error(`${id} failed: HTTP ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as ReportPage;
  return body.Records ?? [];
}

const num = (s: string | undefined) => Number(s ?? 0) || 0;
const money = (s: string | undefined) => `$${num(s).toFixed(2)}`;

function dateArg(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  return i > -1 ? Number(process.argv[i + 1]) || fallback : fallback;
}

async function main() {
  const days = dateArg('--days', 30);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const range = { START_DATE: fmt(start), END_DATE: fmt(end) };

  if (process.argv.includes('--actions')) {
    const actions = await report('mp_action_listing_fast', range);
    console.log(`ACTIONS ${fmt(start)} -> ${fmt(end)}: ${actions.length}`);
    for (const a of actions) {
      console.log(
        `  ${a.Action_Date ?? a.action_date}  ${a.Campaign ?? a.campaign}  ${a.Action_Tracker ?? ''}  sale ${money(a.Sale_Amount ?? a.SaleAmount)}  earned ${money(a.Payout ?? a.Earnings)}  ${a.Status ?? ''}`
      );
    }
    return;
  }

  const [byDay, byBrand] = await Promise.all([
    report('partner_performance_by_day', range),
    report('partner_performance_by_program', range),
  ]);

  console.log(`PERFORMANCE BY DAY ${fmt(start)} -> ${fmt(end)} (date / clicks / actions / sales / earnings):`);
  let clicks = 0, actions = 0, sales = 0, earnings = 0;
  for (const r of [...byDay].reverse()) {
    clicks += num(r.Clicks);
    actions += num(r.Actions);
    sales += num(r.Sale_zzzAmount);
    earnings += num(r.Total_Cost);
    if (num(r.Clicks) || num(r.Actions)) {
      console.log(
        `  ${r.date_display}  ${r.Clicks}  ${r.Actions}  ${money(r.Sale_zzzAmount)}  ${money(r.Total_Cost)}`
      );
    }
  }
  console.log(`  TOTAL: ${clicks} clicks, ${actions} actions, ${money(String(sales))} sales, ${money(String(earnings))} earned`);

  console.log(`\nPERFORMANCE BY BRAND (brand / clicks / actions / sales / earnings):`);
  for (const r of byBrand) {
    if (num(r.Clicks) || num(r.Actions)) {
      console.log(
        `  ${(r.Program ?? r.Campaign ?? '?').padEnd(30)}  ${r.Clicks}  ${r.Actions}  ${money(r.Sale_zzzAmount)}  ${money(r.Total_Cost)}`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
