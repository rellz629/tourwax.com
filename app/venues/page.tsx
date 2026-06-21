import { db } from '@/db';
import { events, venues } from '@/db/schema';
import { eq, gte, sql } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { generateVenuesIndexMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { slugify } from '@/lib/slugify';
import { clusterVenues } from '@/lib/venue-cluster';
import Pagination from '@/components/Pagination';

export const revalidate = 1800;

const VENUES_PER_PAGE = 120;

interface Props {
  searchParams: Promise<{ page?: string; q?: string; state?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const q = (sp.q || '').trim();
  const state = (sp.state || '').trim();
  const base: Metadata = await generateVenuesIndexMetadata();
  if (currentPage > 1) {
    base.title = `Concert Venues ${new Date().getFullYear()} - Page ${currentPage}`;
  }
  // Search/state views are navigational: keep them out of the index and
  // consolidate on the canonical /venues URL (set in generateVenuesIndexMetadata).
  if (q || state) {
    base.robots = { index: false, follow: true };
  }
  return base;
}

export default async function VenuesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const q = (sp.q || '').trim();
  const state = (sp.state || '').trim();
  const now = new Date();

  // Per-venue-record counts, then collapse duplicate venue records (same place
  // from Ticketmaster + SeatGeek under different names) into one canonical card.
  const venueRows = await db
    .select({
      id: venues.id,
      name: venues.name,
      city: venues.city,
      state: venues.state,
      latitude: venues.latitude,
      longitude: venues.longitude,
      eventCount: sql<number>`count(*)::int`,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(gte(events.eventDate, now))
    .groupBy(venues.id, venues.name, venues.city, venues.state, venues.latitude, venues.longitude);

  const counts = new Map(venueRows.map((v) => [v.id, v.eventCount]));
  const clusters = clusterVenues(venueRows, (id) => counts.get(id) ?? 0);
  const byCanonical = new Map<string, { venueName: string; city: string | null; state: string | null; eventCount: number }>();
  for (const v of venueRows) {
    const cluster = clusters.get(v.id)!;
    let agg = byCanonical.get(cluster.canonicalId);
    if (!agg) {
      const canon = venueRows.find((r) => r.id === cluster.canonicalId)!;
      agg = { venueName: cluster.canonicalName, city: canon.city, state: canon.state, eventCount: 0 };
      byCanonical.set(cluster.canonicalId, agg);
    }
    agg.eventCount += v.eventCount;
  }
  const venuesWithCounts = Array.from(byCanonical.values()).sort((a, b) => b.eventCount - a.eventCount);

  // Distinct states present (full set) for the filter dropdown.
  const stateOptions = Array.from(
    new Set(venuesWithCounts.map((v) => v.state).filter((s): s is string => Boolean(s)))
  ).sort();

  // Apply filters.
  let filtered = venuesWithCounts;
  if (state) filtered = filtered.filter((v) => v.state === state);
  if (q) {
    const lq = q.toLowerCase();
    filtered = filtered.filter((v) => v.venueName.toLowerCase().includes(lq));
  }

  const totalVenues = filtered.length;

  // Group every filtered venue by city, order cities A->Z and each city's
  // venues by event count, then pack whole city groups into pages. Paginating
  // by city (rather than slicing a flat list) keeps each page a continuous
  // alphabetical range and never splits one city across two pages.
  const cityGroups = new Map<string, typeof filtered>();
  for (const row of filtered) {
    const cityKey = row.state ? `${row.city}, ${row.state}` : (row.city || 'Other');
    if (!cityGroups.has(cityKey)) cityGroups.set(cityKey, []);
    cityGroups.get(cityKey)!.push(row);
  }
  const allCities = Array.from(cityGroups.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [, vs] of allCities) vs.sort((a, b) => b.eventCount - a.eventCount);

  const pages: (typeof allCities)[] = [];
  let currentGroup: typeof allCities = [];
  let currentGroupCount = 0;
  for (const entry of allCities) {
    if (currentGroup.length && currentGroupCount + entry[1].length > VENUES_PER_PAGE) {
      pages.push(currentGroup);
      currentGroup = [];
      currentGroupCount = 0;
    }
    currentGroup.push(entry);
    currentGroupCount += entry[1].length;
  }
  if (currentGroup.length) pages.push(currentGroup);

  const totalPages = Math.max(1, pages.length);
  const sortedCities = pages[currentPage - 1] ?? [];

  const hasFilter = Boolean(q || state);

  // Preserve the active filter across pagination links.
  const filterParams = new URLSearchParams();
  if (q) filterParams.set('q', q);
  if (state) filterParams.set('state', state);
  const filterQs = filterParams.toString();
  const basePath = filterQs ? `/venues?${filterQs}` : '/venues';

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Venues', url: `${SITE_URL}/venues` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Venues', url: '/venues' },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-8">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">Concert Venues</span>
          </h1>
          <p className="text-xl text-gray-600">
            {hasFilter
              ? `${totalVenues} venue${totalVenues === 1 ? '' : 's'} match your filters`
              : `Browse ${totalVenues} venues with upcoming shows`}
            {totalPages > 1 && ` — Page ${currentPage} of ${totalPages}`}
          </p>
        </div>

        {/* Filters */}
        <form action="/venues" method="GET" role="search" className="mb-10 flex flex-col sm:flex-row gap-2 max-w-2xl">
          <label htmlFor="venue-search" className="sr-only">Search venues by name</label>
          <input
            id="venue-search"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search venues by name…"
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <label htmlFor="venue-state" className="sr-only">Filter by state</label>
          <select
            id="venue-state"
            name="state"
            defaultValue={state}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All states</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button type="submit" className="px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors">
            Search
          </button>
          {hasFilter && (
            <Link href="/venues" className="px-4 py-2 rounded-lg text-orange-600 font-medium hover:text-orange-700 self-center whitespace-nowrap">
              Clear
            </Link>
          )}
        </form>

        {sortedCities.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">
              {hasFilter ? 'No venues match your filters. Try a different search or state.' : 'No venues with upcoming shows found. Check back soon!'}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {sortedCities.map(([cityLabel, cityVenues]) => (
              <section key={cityLabel}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-1 w-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
                  <h2 className="text-xl font-bold text-gray-900">
                    <Link href={`/concerts/${slugify(cityLabel.split(',')[0].trim())}`} className="hover:text-orange-600 transition-colors">{cityLabel}</Link>
                  </h2>
                  <div className="h-px flex-1 bg-gray-200"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cityVenues.map((row) => {
                    const venueSlug = slugify(row.venueName);
                    return (
                      <Link
                        key={venueSlug}
                        href={`/venues/${venueSlug}`}
                        className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover overflow-hidden border border-gray-100"
                      >
                        <div className="h-2 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600"></div>
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-bold text-gray-900 group-hover:text-orange-500 transition-colors truncate">
                                {row.venueName}
                              </h3>
                            </div>
                            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white">
                              <span className="font-bold text-sm">{row.eventCount}</span>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-gray-600">
                            {row.eventCount} upcoming show{row.eventCount === 1 ? '' : 's'}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <Pagination currentPage={currentPage} totalPages={totalPages} basePath={basePath} />
      </div>
    </>
  );
}
