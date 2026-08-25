import { config } from 'dotenv';
// Load .env.local BEFORE any other imports
config({ path: '.env.local' });

import { db } from '@/db';
import { events } from '@/db/schema';
import { eq, or, like } from 'drizzle-orm';
import { unwrapTrackingUrl } from '@/lib/affiliate';

/**
 * Unwraps affiliate tracking URLs stored in the events table back to plain
 * merchant URLs (ticketmaster.com / seatgeek.com).
 *
 * The site used to store evyy.net / pxf.io wrapped URLs, which leaked into
 * JSON-LD offers.url and API responses where scrapers harvested them,
 * flooding Impact with bot clicks. Wrapping now happens only at render time
 * via the /out redirect, so the stored form must be the plain merchant URL.
 */
async function unwrapAffiliateUrls() {
  console.log('🔗 Unwrapping stored affiliate tracking URLs...\n');

  const wrapped = await db
    .select({ id: events.id, name: events.name, ticketUrl: events.ticketUrl })
    .from(events)
    .where(or(
      like(events.ticketUrl, '%ticketmaster.evyy.net%'),
      like(events.ticketUrl, '%seatgeek.pxf.io%'),
    ));

  console.log(`Found ${wrapped.length} events with wrapped URLs`);

  let updated = 0;
  let skipped = 0;

  for (const event of wrapped) {
    const plain = unwrapTrackingUrl(event.ticketUrl!);
    if (plain === event.ticketUrl) {
      // Wrapped URL with no recoverable inner URL — leave it; /out unwraps at click time
      console.log(`  ⏭️  No inner URL: ${event.name}`);
      skipped++;
      continue;
    }

    await db
      .update(events)
      .set({ ticketUrl: plain, updatedAt: new Date() })
      .where(eq(events.id, event.id));
    updated++;
    if (updated % 250 === 0) console.log(`  ...${updated} unwrapped`);
  }

  console.log('\n📊 Summary:');
  console.log(`  ✓ Unwrapped: ${updated} events`);
  console.log(`  ⏭️  Skipped (no inner URL): ${skipped} events`);
  console.log('\n✅ Affiliate URL unwrap complete!');
}

unwrapAffiliateUrls()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
