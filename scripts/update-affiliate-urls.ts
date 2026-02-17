import { config } from 'dotenv';
// Load .env.local BEFORE any other imports
config({ path: '.env.local' });

import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getTicketmasterAffiliateUrl } from '@/lib/affiliate';

/**
 * Updates existing Ticketmaster events with affiliate tracking URLs
 */
async function updateAffiliateUrls() {
  console.log('🔗 Updating Ticketmaster events with affiliate tracking...\n');

  try {
    // Get all Ticketmaster events
    const ticketmasterEvents = await db
      .select()
      .from(events)
      .where(eq(events.source, 'ticketmaster'));

    console.log(`Found ${ticketmasterEvents.length} Ticketmaster events\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const event of ticketmasterEvents) {
      if (!event.ticketUrl) {
        skippedCount++;
        continue;
      }

      // Check if already has affiliate tracking
      if (event.ticketUrl.includes('evyy.net')) {
        console.log(`⏭️  Skipping ${event.name} - already has affiliate tracking`);
        skippedCount++;
        continue;
      }

      // Apply affiliate tracking
      const affiliateUrl = getTicketmasterAffiliateUrl(event.ticketUrl);

      await db
        .update(events)
        .set({
          ticketUrl: affiliateUrl,
          updatedAt: new Date()
        })
        .where(eq(events.id, event.id));

      console.log(`✓ Updated: ${event.name}`);
      updatedCount++;
    }

    console.log('\n📊 Summary:');
    console.log(`  ✓ Updated: ${updatedCount} events`);
    console.log(`  ⏭️  Skipped: ${skippedCount} events`);
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
