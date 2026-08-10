/**
 * Ahrefs AI-visibility report: how often tourwax.com is cited in AI answers
 * (ChatGPT, Google AI Overviews / AI Mode, Gemini, Perplexity, Copilot, Grok).
 *
 * Usage:
 *   npm run ahrefs
 *
 * Auth: AHREFS_API_KEY in .env.local (Ahrefs -> Account settings -> API keys).
 * Free/AWT accounts can query their own verified projects.
 */

const TARGET = 'tourwax.com/';
const FIELDS = [
  'chatgpt',
  'google_ai_overviews',
  'google_ai_overviews_keywords',
  'google_ai_mode',
  'gemini',
  'perplexity',
  'copilot',
  'grok',
] as const;

async function main() {
  const key = process.env.AHREFS_API_KEY;
  if (!key) {
    console.error('AHREFS_API_KEY is not set in .env.local');
    process.exit(1);
  }

  const qs = new URLSearchParams({
    select: FIELDS.join(','),
    target: TARGET,
  });
  const res = await fetch(`https://api.ahrefs.com/v3/site-explorer/ai-responses-count?${qs}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    console.error(`Ahrefs API error: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const body = await res.json();
  console.log(`AI RESPONSES CITING ${TARGET} (Ahrefs):\n`);
  console.log(JSON.stringify(body, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
