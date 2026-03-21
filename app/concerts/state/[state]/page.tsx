import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, gte, sql, and, isNotNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { generateStateMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { slugify } from '@/lib/slugify';

export const dynamic = 'force-static';
export const revalidate = 1800;

interface Props {
  params: Promise<{ state: string }>;
}

// US state names for display
const STATE_NAMES: Record<string, string> = {
  'al': 'Alabama', 'ak': 'Alaska', 'az': 'Arizona', 'ar': 'Arkansas',
  'ca': 'California', 'co': 'Colorado', 'ct': 'Connecticut', 'de': 'Delaware',
  'fl': 'Florida', 'ga': 'Georgia', 'hi': 'Hawaii', 'id': 'Idaho',
  'il': 'Illinois', 'in': 'Indiana', 'ia': 'Iowa', 'ks': 'Kansas',
  'ky': 'Kentucky', 'la': 'Louisiana', 'me': 'Maine', 'md': 'Maryland',
  'ma': 'Massachusetts', 'mi': 'Michigan', 'mn': 'Minnesota', 'ms': 'Mississippi',
  'mo': 'Missouri', 'mt': 'Montana', 'ne': 'Nebraska', 'nv': 'Nevada',
  'nh': 'New Hampshire', 'nj': 'New Jersey', 'nm': 'New Mexico', 'ny': 'New York',
  'nc': 'North Carolina', 'nd': 'North Dakota', 'oh': 'Ohio', 'ok': 'Oklahoma',
  'or': 'Oregon', 'pa': 'Pennsylvania', 'ri': 'Rhode Island', 'sc': 'South Carolina',
  'sd': 'South Dakota', 'tn': 'Tennessee', 'tx': 'Texas', 'ut': 'Utah',
  'vt': 'Vermont', 'va': 'Virginia', 'wa': 'Washington', 'wv': 'West Virginia',
  'wi': 'Wisconsin', 'wy': 'Wyoming', 'dc': 'District of Columbia',
  // Canadian provinces
  'on': 'Ontario', 'qc': 'Quebec', 'bc': 'British Columbia', 'ab': 'Alberta',
};

function resolveStateName(stateSlug: string): string | null {
  // Check direct slug match
  if (STATE_NAMES[stateSlug]) return STATE_NAMES[stateSlug];
  // Check by slugifying state names
  for (const [, name] of Object.entries(STATE_NAMES)) {
    if (slugify(name) === stateSlug) return name;
  }
  return null;
}

async function getStateData(stateSlug: string) {
  const now = new Date();

  // Get all distinct states with future events
  const allStates = await db
    .selectDistinct({ state: venues.state })
    .from(venues)
    .innerJoin(events, eq(events.venueId, venues.id))
    .where(and(isNotNull(venues.state), gte(events.eventDate, now)));

  // Find matching state by slug
  const match = allStates.find(
    (row) => row.state && slugify(row.state) === stateSlug
  );

  if (!match?.state) return null;

  // Get cities with event counts for this state
  const citiesWithCounts = await db
    .select({
      city: venues.city,
      eventCount: sql<number>`count(*)::int`,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(
      sql`${venues.state} = ${match.state} AND ${events.eventDate} >= ${now} AND ${venues.city} IS NOT NULL`
    )
    .groupBy(venues.city)
    .orderBy(sql`count(*) desc`);

  // Get distinct artists performing in this state
  const stateArtists = await db
    .selectDistinct({ name: artists.name })
    .from(artists)
    .innerJoin(events, eq(events.artistId, artists.id))
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(
      sql`${venues.state} = ${match.state} AND ${events.eventDate} >= ${now}`
    )
    .limit(10);

  const totalEvents = citiesWithCounts.reduce((sum, c) => sum + c.eventCount, 0);

  return {
    stateName: resolveStateName(stateSlug) || match.state,
    stateRaw: match.state,
    cities: citiesWithCounts.filter((c) => c.city),
    totalEvents,
    artistNames: stateArtists.map((a) => a.name),
  };
}

export async function generateStaticParams() {
  const now = new Date();

  const states = await db
    .select({
      state: venues.state,
      count: sql<number>`count(*)::int`,
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(and(isNotNull(venues.state), gte(events.eventDate, now)))
    .groupBy(venues.state)
    .orderBy(sql`count(*) desc`)
    .limit(30);

  return states
    .filter((row) => row.state)
    .map((row) => ({ state: slugify(row.state!) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state: stateSlug } = await params;
  const data = await getStateData(stateSlug);

  if (!data) {
    return { title: 'State Not Found' };
  }

  return generateStateMetadata({
    stateName: data.stateName,
    stateSlug,
    eventCount: data.totalEvents,
    cityCount: data.cities.length,
    artistNames: data.artistNames,
  });
}

export default async function StatePage({ params }: Props) {
  const { state: stateSlug } = await params;
  const data = await getStateData(stateSlug);

  if (!data) {
    notFound();
  }

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Concerts', url: `${SITE_URL}/concerts` },
    { name: data.stateName, url: `${SITE_URL}/concerts/state/${stateSlug}` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Concerts', url: '/concerts' },
    { name: data.stateName, url: `/concerts/state/${stateSlug}` },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            Concerts in <span className="gradient-text">{data.stateName}</span>
          </h1>
          <p className="text-xl text-gray-600">
            {data.totalEvents} upcoming show{data.totalEvents === 1 ? '' : 's'} across {data.cities.length} {data.cities.length === 1 ? 'city' : 'cities'}
          </p>
        </div>

        {data.cities.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No upcoming concerts in {data.stateName}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {data.cities.map((row) => {
              const citySlug = slugify(row.city!);
              return (
                <Link
                  key={row.city}
                  href={`/concerts/${citySlug}`}
                  className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover overflow-hidden border border-gray-100"
                >
                  <div className="h-3 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600"></div>
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h2 className="text-lg font-bold text-gray-900 group-hover:text-orange-500 transition-colors">
                          {row.city}
                        </h2>
                      </div>
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-white">
                        <span className="font-bold text-lg">{row.eventCount}</span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-600">
                      {row.eventCount} upcoming show{row.eventCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {data.artistNames.length > 0 && (
          <section className="mt-12 bg-white rounded-xl shadow-md border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Artists Touring in {data.stateName}</h2>
            <p className="text-gray-600">
              {data.artistNames.join(', ')}{data.artistNames.length >= 10 ? ', and more' : ''} have upcoming shows in {data.stateName}.
            </p>
          </section>
        )}
      </div>
    </>
  );
}
