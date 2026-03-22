/**
 * Shared event filtering utilities for deduplication across pages and scripts.
 */

export const PACKAGE_KEYWORDS = [
  'vip', 'package', 'upgrade', 'comfort seat', 'lounge', 'meet & greet',
  'meet and greet', 'premium', 'platinum', 'gold circle', 'early entry',
  'soundcheck', 'vinyl room', 'hospitality', 'suite', 'box seat',
  'excluding concert ticket', 'hot ticket', 'upsell',
  'club level', 'logen-seat', 'accessible ticket', 'payment plan',
  'tribute', 'tribute to', 'tribute band', 'live band tribute',
];

export function isPackage(name: string): boolean {
  const lower = name.toLowerCase();
  return PACKAGE_KEYWORDS.some(kw => lower.includes(kw));
}
