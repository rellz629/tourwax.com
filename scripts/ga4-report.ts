/**
 * GA4 traffic report via the Analytics Data API (service account).
 *
 * Usage:
 *   npm run ga4                 # last 28 days: users/sessions by day + top pages + channels
 *   npm run ga4 -- --days 7
 *
 * Auth: GOOGLE_APPLICATION_CREDENTIALS in .env.local. The service account
 * email must be a Viewer on the GA4 property (Admin -> Property access
 * management). GA4_PROPERTY_ID in .env.local holds the numeric property id;
 * if unset, the script lists properties the service account can see.
 */
import { google } from 'googleapis';

async function main() {
  const args = process.argv.slice(2);
  const daysIdx = args.indexOf('--days');
  const days = daysIdx !== -1 ? Number(args[daysIdx + 1]) : 28;
  if (!Number.isFinite(days) || days <= 0) {
    console.error(`Invalid --days value: ${args[daysIdx + 1]}`);
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });

  let propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    // Discover accessible properties so the user can pin GA4_PROPERTY_ID.
    const admin = google.analyticsadmin({ version: 'v1beta', auth });
    const { data } = await admin.accountSummaries.list();
    const summaries = data.accountSummaries || [];
    const props = summaries.flatMap((a) => a.propertySummaries || []);
    if (props.length === 0) {
      throw new Error(
        'No GA4 properties visible. Add tourwax-reports@tourwax.iam.gserviceaccount.com as Viewer under Admin -> Property access management.'
      );
    }
    if (props.length > 1) {
      console.log('Multiple properties found — set GA4_PROPERTY_ID in .env.local to one of:');
      for (const p of props) console.log(`  ${p.property}  ${p.displayName}`);
    }
    propertyId = props[0].property!.replace('properties/', '');
    console.log(`Using property ${propertyId} (${props[0].displayName}). Pin it with GA4_PROPERTY_ID in .env.local.\n`);
  }

  const analytics = google.analyticsdata({ version: 'v1beta', auth });
  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }];

  const [byDay, byPage, byChannel] = await Promise.all([
    analytics.properties.runReport({
      property,
      requestBody: {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      },
    }),
    analytics.properties.runReport({
      property,
      requestBody: {
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: '15',
      },
    }),
    analytics.properties.runReport({
      property,
      requestBody: {
        dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      },
    }),
  ]);

  console.log(`Last ${days} days\n`);
  console.log('BY DAY (date / users / sessions / pageviews):');
  for (const r of byDay.data.rows || []) {
    console.log(`  ${r.dimensionValues?.[0].value}  ${r.metricValues?.map((m) => m.value).join('  ')}`);
  }

  console.log('\nTOP PAGES (users / pageviews):');
  for (const r of byPage.data.rows || []) {
    console.log(`  ${r.metricValues?.map((m) => m.value).join('  ')}  ${r.dimensionValues?.[0].value}`);
  }

  console.log('\nCHANNELS (sessions):');
  for (const r of byChannel.data.rows || []) {
    console.log(`  ${r.metricValues?.[0].value}  ${r.dimensionValues?.[0].value}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
