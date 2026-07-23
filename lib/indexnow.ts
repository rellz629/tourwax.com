import { SITE_URL } from './seo';

// IndexNow instantly notifies Bing (and other participating engines) about
// new or updated URLs instead of waiting for a recrawl. The key is public by
// design: engines verify ownership by fetching the matching key file, which
// is served from public/<key>.txt at the site root.
export const INDEXNOW_KEY = 'c906bddb929d485d995e1437f46c1399';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const HOST = new URL(SITE_URL).host;
const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
const MAX_URLS_PER_REQUEST = 10000;

export interface IndexNowResult {
  ok: boolean;
  status: number;
  statusText: string;
  submitted: number;
}

/** Accepts absolute URLs or site-relative paths ("/blog/foo"). */
export function toAbsoluteUrl(urlOrPath: string): string {
  const url = urlOrPath.startsWith('http')
    ? new URL(urlOrPath)
    : new URL(urlOrPath, SITE_URL);
  if (url.host !== HOST) {
    throw new Error(`IndexNow only accepts URLs on ${HOST}, got: ${urlOrPath}`);
  }
  return url.toString();
}

export async function submitToIndexNow(urlsOrPaths: string[]): Promise<IndexNowResult> {
  const urlList = [...new Set(urlsOrPaths.map(toAbsoluteUrl))].slice(0, MAX_URLS_PER_REQUEST);

  if (urlList.length === 0) {
    return { ok: true, status: 200, statusText: 'nothing to submit', submitted: 0 };
  }

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList,
    }),
  });

  // 200 = submitted, 202 = accepted pending key validation (normal for the
  // first submission after the key file deploys).
  return {
    ok: res.status === 200 || res.status === 202,
    status: res.status,
    statusText: res.statusText,
    submitted: urlList.length,
  };
}
