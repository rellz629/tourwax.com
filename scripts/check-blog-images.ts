import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const BLOG_DIR = path.join(process.cwd(), 'content/blog');

const UA =
  'Mozilla/5.0 (compatible; TourWaxBlogImageCheck/1.0; +https://tourwax.com)';

interface CheckResult {
  file: string;
  slug: string;
  publishedAt: string;
  featuredImage: string | null;
  status: 'ok' | 'missing' | 'broken' | 'skipped-future';
  httpStatus?: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function checkOnce(url: string, method: 'HEAD' | 'GET'): Promise<number> {
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' },
    });
    return res.status;
  } catch {
    return 0;
  }
}

async function checkUrl(url: string): Promise<number> {
  // Try HEAD first; if rate-limited or method-not-allowed, fall back to GET.
  // Retry transient codes (429, 5xx, network errors) with backoff.
  const delays = [0, 1500, 4000, 8000];
  let lastCode = 0;
  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    let code = await checkOnce(url, 'HEAD');
    if (code === 405 || code === 403 || code === 0) {
      code = await checkOnce(url, 'GET');
    }
    lastCode = code;
    if (code >= 200 && code < 400) return code;
    if (code !== 429 && code < 500 && code !== 0) return code; // permanent failure
  }
  return lastCode;
}

async function main() {
  const now = new Date();
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md')).sort();
  const results: CheckResult[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8');
    const { data } = matter(raw);
    const slug = (data.slug as string) || file.replace(/\.md$/, '');
    const publishedAt = data.publishedAt as string;
    const featuredImage = (data.featuredImage as string) || null;

    if (publishedAt && new Date(publishedAt) > now) {
      results.push({ file, slug, publishedAt, featuredImage, status: 'skipped-future' });
      continue;
    }

    if (!featuredImage) {
      results.push({ file, slug, publishedAt, featuredImage, status: 'missing' });
      continue;
    }

    const code = await checkUrl(featuredImage);
    if (code >= 200 && code < 400) {
      results.push({ file, slug, publishedAt, featuredImage, status: 'ok', httpStatus: code });
    } else {
      results.push({ file, slug, publishedAt, featuredImage, status: 'broken', httpStatus: code });
    }
    // gentle pacing between requests to keep CDNs from rate-limiting
    await sleep(200);
  }

  const broken = results.filter((r) => r.status === 'broken');
  const missing = results.filter((r) => r.status === 'missing');
  const future = results.filter((r) => r.status === 'skipped-future');
  const ok = results.filter((r) => r.status === 'ok');

  for (const r of ok) console.log(`ok       ${r.file}`);
  for (const r of future) console.log(`future   ${r.file} (publishedAt ${r.publishedAt})`);
  for (const r of missing) console.log(`MISSING  ${r.file}`);
  for (const r of broken) console.log(`BROKEN(${r.httpStatus})  ${r.file}  ${r.featuredImage}`);

  console.log('');
  console.log(
    `Checked ${results.length} posts — ${ok.length} ok, ${future.length} unpublished, ${missing.length} missing, ${broken.length} broken.`
  );

  if (broken.length > 0 || missing.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
