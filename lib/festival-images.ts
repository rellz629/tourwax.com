export interface FestivalImage {
  flyerUrl: string;
  officialUrl?: string;
  credit?: string;
}

// Map lowercase festival name keywords to flyer image config.
// The key is matched against the festival slug (substring match).
// flyerUrl can be an absolute external URL or a local path like /festivals/name.jpg
// (local paths should go in the public/festivals/ directory).
//
// Example entry:
// 'lollapalooza': {
//   flyerUrl: 'https://...',
//   officialUrl: 'https://www.lollapalooza.com',
//   credit: 'Lollapalooza',
// },
const FESTIVAL_IMAGES: Record<string, FestivalImage> = {
  'lollapalooza': {
    flyerUrl: 'https://cdn.prod.website-files.com/67c1632e86f99390b0516b6d/69bc11fc784fd0a38180775e_LOLLA26-Admat-By-Day-WEB.png',
    officialUrl: 'https://www.lollapalooza.com',
    credit: 'Lollapalooza',
  },
};

export function getFestivalImage(slug: string): FestivalImage | null {
  const lower = slug.toLowerCase();
  for (const [key, image] of Object.entries(FESTIVAL_IMAGES)) {
    if (lower.includes(key.toLowerCase())) {
      return image;
    }
  }
  return null;
}
