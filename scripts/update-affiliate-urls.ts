import { config } from 'dotenv';
// Load .env.local BEFORE any other imports
config({ path: '.env.local' });

import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getTicketmasterAffiliateUrl, getSeatGeekAffiliateUrl } from '@/lib/affiliate';

/**
 * Updates existing Ticketmaster and SeatGeek events with affiliate tracking URLs
 */
async function updateAffiliateUrls() {
  console.log('🔗 Updating events with affiliate tracking...\n');

  try {
    let totalUpdated = 0;
    let totalSkipped = 0;

    // Update Ticketmaster events
    const ticketmasterEvents = await db
      .select()
      .from(events)
      .where(eq(events.source, 'ticketmaster'));

    console.log(`Found ${ticketmasterEvents.length} Ticketmaster events`);

    for (const event of ticketmasterEvents) {
      if (!event.ticketUrl) {
        totalSkipped++;
        continue;
      }

      if (event.ticketUrl.includes('evyy.net')) {
        totalSkipped++;
        continue;
      }

      const affiliateUrl = getTicketmasterAffiliateUrl(event.ticketUrl);

      await db
        .update(events)
        .set({ ticketUrl: affiliateUrl, updatedAt: new Date() })
        .where(eq(events.id, event.id));

      console.log(`  ✓ TM: ${event.name}`);
      totalUpdated++;
    }

    // Update SeatGeek events
    const seatgeekEvents = await db
      .select()
      .from(events)
      .where(eq(events.source, 'seatgeek'));

    console.log(`Found ${seatgeekEvents.length} SeatGeek events`);

    for (const event of seatgeekEvents) {
      if (!event.ticketUrl) {
        totalSkipped++;
        continue;
      }

      if (event.ticketUrl.includes('pxf.io')) {
        totalSkipped++;
        continue;
      }

      const affiliateUrl = getSeatGeekAffiliateUrl(event.ticketUrl);

      await db
        .update(events)
        .set({ ticketUrl: affiliateUrl, updatedAt: new Date() })
        .where(eq(events.id, event.id));

      console.log(`  ✓ SG: ${event.name}`);
      totalUpdated++;
    }

    console.log('\n📊 Summary:');
    console.log(`  ✓ Updated: ${totalUpdated} events`);
    console.log(`  ⏭️  Skipped: ${totalSkipped} events`);
    console.log('\n✅ Affiliate URL update complete!');

  } catch (error) {
    console.error('❌ Error updating affiliate URLs:', error);
    process.exit(1);
  }
}

updateAffiliateUrls()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
