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

const FESTIVAL_KEYWORDS = [
  'fest', 'festival', 'palooza', 'bonnaroo', 'coachella', 'glastonbury',
  'lollapalooza', 'summerfest', 'firefly', 'governors ball', 'ultra',
  'tomorrowland', 'primavera', 'reading & leeds', 'download festival',
  'wireless', 'parklife', 'bestival', 'creamfields', 'sonar',
  'roskilde', 'fuji rock', 'rock am ring', 'rock im park',
  'wacken', 'hellfest', 'nova rock', 'hurricane festival',
  'southside festival', 'splash!', 'melt!', 'frequency',
];

export function isFestival(name: string): boolean {
  const lower = name.toLowerCase();
  return FESTIVAL_KEYWORDS.some(kw => lower.includes(kw));
}
