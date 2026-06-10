import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { events } from '@/db/schema';
import { inArray } from 'drizzle-orm';

// Post Malone canceled the first six dates of the Big Ass Stadium Tour Part 2
// in May 2026 (announced May 1-3, 2026). Tour now starts June 9 in Charlotte.
// Each canceled show has both a Ticketmaster and SeatGeek row in our DB.
const CANCELED_EVENT_IDS = [
  'sg-18046626',          // 5/13 El Paso, TX - Sun Bowl Stadium (sg, UTC 5/14)
  'tm-vvG1YZ_dBX0D8b',    // 5/13 El Paso, TX - Sun Bowl Stadium (tm, UTC 5/14)
  'sg-18046625',          // 5/19 Waco, TX - McLane Stadium (sg, UTC 5/20)
  'tm-Z7r9jZ1A7Og_Z',     // 5/19 Waco, TX - McLane Stadium (tm, UTC 5/20)
  'sg-18042737',          // 5/23 Baton Rouge, LA - Tiger Stadium (sg, UTC 5/24)
  'tm-G5viZ_77NGTls',     // 5/23 Baton Rouge, LA - LSU Tiger Stadium (tm, UTC 5/24)
  'sg-18046624',          // 5/26 Birmingham, AL - Protective Stadium (sg, UTC 5/27)
  'tm-1AeZZ_dGkSoD0Gm',   // 5/26 Birmingham, AL - Protective Stadium (tm, UTC 5/27)
  'tm-vvG1VZ_dM7eG1R',    // 5/29 Tampa, FL - Raymond James Stadium (tm)
  'sg-18046629',          // 5/29 Tampa, FL - Raymond James Stadium (sg, UTC 5/30)
  'sg-18046628',          // 6/5 Oxford, MS - Vaught Hemingway Stadium (sg, UTC 6/6)
  'tm-G5viZ_77-6RJ7',     // 6/5 University, MS - Vaught Hemingway Stadium (tm, UTC 6/6)
];

async function cancelPostMaloneDates() {
  console.log(`Deleting ${CANCELED_EVENT_IDS.length} canceled Post Malone events...`);

  const deleted = await db
    .delete(events)
    .where(inArray(events.id, CANCELED_EVENT_IDS))
    .returning({ id: events.id, name: events.name, eventDate: events.eventDate });

  console.log(`\nDeleted ${deleted.length} events:`);
  for (const d of deleted) {
    console.log(`  ${d.eventDate.toISOString().slice(0, 10)} | ${d.id} | ${d.name}`);
  }

  const expected = CANCELED_EVENT_IDS.length;
  if (deleted.length !== expected) {
    console.warn(`\nWARNING: expected ${expected} deletions, got ${deleted.length}`);
    const missing = CANCELED_EVENT_IDS.filter(id => !deleted.find(d => d.id === id));
    console.warn(`Missing IDs: ${missing.join(', ')}`);
  }
}

cancelPostMaloneDates()
  .catch(console.error)
  .finally(() => process.exit(0));
