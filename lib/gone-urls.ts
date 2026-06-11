/**
 * URLs returning 410 Gone via middleware.ts.
 *
 * Sourced from the 2026-05-31 GSC "Not found (404)" drilldown
 * (Traffic Reports/5-31-2026/tourwax.com-Coverage-Drilldown-2026-05-31/), then
 * filtered by scripts/seo-audit.ts to the subset where no matching DB row
 * exists. These are URLs Google had indexed under previous site states
 * (deleted artists, accented slug variants, festival rollups, etc.) and now
 * 404s. Returning 410 instead of 404 tells Google to drop them from the index
 * permanently rather than retrying.
 *
 * Update path:
 *   1. drop a fresh GSC drilldown into Traffic Reports/<date>/
 *   2. point scripts/seo-audit.ts at it and run `npm run audit:seo`
 *   3. regenerate this file from audit-output/404-redirects.csv (action=410)
 *
 * NEVER add /festivals/ URLs here. Festival detection is dynamic — a slug that
 * matches nothing today can become a live festival (or its legacy alias) after
 * the next event import. 90 entries added on 2026-05-31 included 14 that were
 * CANONICAL slugs of live festivals by 2026-06-09, served as 410s while the
 * sitemap listed them. app/festivals/[slug]/page.tsx already resolves every
 * case itself: legacy slugs 308 to canonical, reclassified slugs 308 to the
 * headliner artist or venue, and only truly unknown slugs 404. Use
 * scripts/check-gone-festival-slugs.ts to audit festival slug resolution.
 */
export const GONE_URLS: ReadonlySet<string> = new Set([
  '/artists/agent-orange',
  '/artists/air-supply',
  '/artists/armored-saint',
  '/artists/austin-jenckes',
  '/artists/beyoncÃ©',
  '/artists/beyoncé',
  '/artists/burning-witches',
  '/artists/cheem',
  '/artists/chuck-ragan',
  '/artists/coachella-valley-music-and-arts-festival',
  '/artists/day-by-day',
  '/artists/di',
  '/artists/enuff-znuff',
  '/artists/evolfo',
  '/artists/excellency-music-festival',
  '/artists/foxy-shazam',
  '/artists/gene-loves-jezebel',
  '/artists/george-porter-jr',
  '/artists/hail-the-sun',
  '/artists/irma-thomas',
  '/artists/jackie-greene',
  '/artists/jay-electronica',
  '/artists/jon-cleary',
  '/artists/just-surrender',
  '/artists/keep-flying',
  '/artists/killer-dwarfs',
  '/artists/killroy',
  '/artists/k-pop-takedown-demon-hunters-x-katseye',
  '/artists/lady-a',
  '/artists/la-roux',
  '/artists/laufey',
  '/artists/laura-pausini',
  '/artists/led-zepagain',
  '/artists/lenka',
  '/artists/little-river-band',
  '/artists/lucius',
  '/artists/macklemore',
  '/artists/messer-chups',
  '/artists/missio',
  '/artists/mustache-harbor',
  '/artists/mustard-plug',
  '/artists/nessa-barrett',
  '/artists/new-medicine',
  '/artists/no-duh',
  '/artists/oh-wonder',
  '/artists/one-step-closer',
  '/artists/peacemakers',
  '/artists/peter-noone',
  '/artists/portrayal-of-guilt',
  '/artists/primer-55',
  '/artists/rahway',
  '/artists/rick-springfield',
  '/artists/saved-by-the-90s',
  '/artists/smut',
  '/artists/soft-cell',
  '/artists/sonny-moorman',
  '/artists/sponge',
  '/artists/steve-kimock',
  '/artists/sting',
  '/artists/sunday-morning',
  '/artists/the-dickies',
  '/artists/the-fall-of-troy',
  '/artists/the-haunt',
  '/artists/the-heavy-heavy',
  '/artists/the-maine',
  '/artists/the-mccrary-sisters',
  '/artists/the-queers',
  '/artists/the-rumrunners',
  '/artists/the-samples',
  '/artists/the-spinners',
  '/artists/thxsomch',
  '/artists/tiffany',
  '/artists/timothy-wayne',
  '/artists/tommy-james',
  '/artists/umphreys-mcgee',
  '/artists/victoria-banks',
  '/artists/warren-wolf',
  '/artists/white-reaper',
  '/venues/att-discovery-district',
  '/venues/auditorium-shores',
  '/venues/blue-note-jazz-club-ny',
  '/venues/bon-secours-wellness-arena-',
  '/venues/credit-one-stadium-',
  '/venues/gsu-beautiful-eagle-creek-fields',
  '/venues/harrahs-rio-vista-outdoor-amphitheater',
  '/venues/hollywood-high-school-main-auditorium',
  '/venues/lake-tahoe-amphitheatre-at-caesars-republic-formerly-harveys',
  '/venues/palladium-times-square-',
  '/venues/refshaleen',
  '/venues/rio-vista-outdoor-amphitheater-at-harrahs-laughlin',
  '/venues/roche-estate',
  '/venues/stage-88',
  '/venues/tempe-beach-park',
  '/venues/the-griffin-theater-the-shed',
  '/venues/the-theater-at-the-shed',
  '/venues/the-wind-creek-event-center-',
]);
