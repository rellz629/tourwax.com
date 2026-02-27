import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/db';
import { artists } from '@/db/schema';
import { nanoid } from 'nanoid';
import { slugify } from '@/lib/slugify';

const name = process.argv[2];
if (!name) {
  console.error('Usage: tsx scripts/add-artist.ts "Artist Name"');
  process.exit(1);
}

async function main() {
  const slug = slugify(name);
  const id = nanoid();

  await db.insert(artists).values({
    id,
    slug,
    name,
    isActive: true,
  }).onConflictDoNothing();

  console.log(`Added "${name}" (slug: ${slug}, id: ${id})`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
