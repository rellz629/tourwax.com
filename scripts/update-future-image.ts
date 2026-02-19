import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function updateImage() {
  await db.update(artists)
    .set({
      imageUrl: 'https://i.scdn.co/image/ab6761610000e5eb7565b356bc9d9394eefa2ccb'
    })
    .where(eq(artists.name, 'Future'));

  console.log('✅ Updated Future with high-res artist photo (640x640)');
}

updateImage()
  .catch(console.error)
  .finally(() => process.exit(0));
