/**
 * Submit URLs to IndexNow (Bing + other participating engines).
 *
 * Usage:
 *   npm run indexnow -- /blog/my-new-post /artists/turnstile
 *   npm run indexnow -- https://www.tourwax.com/blog/my-new-post
 *   npm run indexnow -- --recent          # published blog posts from last 7 days + /blog + /
 *   npm run indexnow -- --recent 14       # same, last 14 days
 *   npm run indexnow -- --dry-run --recent # list what would be submitted
 *
 * The key file (public/<key>.txt) must be deployed to production before
 * submissions validate, so run this AFTER the deploy that ships the post.
 */
import { getAllPosts } from '../lib/blog';
import { submitToIndexNow, toAbsoluteUrl } from '../lib/indexnow';

function recentPostPaths(days: number): string[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = getAllPosts().filter(
    (p) => new Date(p.updatedAt || p.publishedAt).getTime() >= cutoff
  );

  if (recent.length === 0) return [];

  for (const p of recent) {
    console.log(`  ${p.publishedAt}  /blog/${p.slug}`);
  }
  // Blog index and homepage list the new posts, so refresh those too.
  return [...recent.map((p) => `/blog/${p.slug}`), '/blog', '/'];
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--dry-run');
  const dryRun = process.argv.includes('--dry-run');
  let urls: string[];

  if (args[0] === '--recent') {
    const days = args[1] ? Number(args[1]) : 7;
    if (!Number.isFinite(days) || days <= 0) {
      console.error(`Invalid day count: ${args[1]}`);
      process.exit(1);
    }
    console.log(`Blog posts published or updated in the last ${days} days:`);
    urls = recentPostPaths(days);
    if (urls.length === 0) {
      console.log('  none — nothing to submit.');
      return;
    }
  } else if (args.length > 0) {
    urls = args;
  } else {
    console.error('Usage: npm run indexnow -- <url-or-path...> | --recent [days]');
    process.exit(1);
  }

  if (dryRun) {
    console.log('\nDry run — would submit:');
    for (const u of urls) console.log(`  ${toAbsoluteUrl(u)}`);
    return;
  }

  const result = await submitToIndexNow(urls);

  if (result.ok) {
    console.log(`\n✓ Submitted ${result.submitted} URL(s) to IndexNow (HTTP ${result.status}).`);
    if (result.status === 202) {
      console.log('  202 = accepted, key validation pending (normal right after key file deploy).');
    }
  } else {
    console.error(`\n✗ IndexNow rejected the submission: HTTP ${result.status} ${result.statusText}`);
    if (result.status === 403) {
      console.error('  Key validation failed — is the key file deployed at the site root?');
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
