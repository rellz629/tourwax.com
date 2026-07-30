/**
 * Post a tweet to @TourWaxUpdates.
 *
 * Usage:
 *   npm run post:x -- "Your tweet text here"
 *
 * Cost note: text-only posts are $0.015; any post containing a link
 * (including bare domains like tourwax.com, which X auto-links) is $0.20.
 */
import { postTweet } from '../lib/x-client';

async function main() {
  const text = process.argv.slice(2).join(' ').trim();

  if (!text) {
    console.error('Usage: npm run post:x -- "Your tweet text here"');
    process.exit(1);
  }

  console.log(`Posting (${text.length} chars):\n${text}\n`);

  const { id, url } = await postTweet(text);
  console.log(`Posted: ${url} (id: ${id})`);
}

main().catch((err) => {
  console.error('Failed to post tweet:', err?.data ?? err);
  process.exit(1);
});
