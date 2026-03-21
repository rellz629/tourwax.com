import { db } from '@/db';
import { artists, events, venues } from '@/db/schema';
import { eq, gte, lte, and, isNotNull } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateTonightMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAffiliateUrl } from '@/lib/affiliate';
import { slugify } from '@/lib/slugify';

export const dynamic = 'force-static';
export const revalidate = 900; // 15 minutes

async function getTonightEvents() {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const results = await db
    .select({
      event: events,
      venue: venues,
      artistName: artists.name,
      artistSlug: artists.slug,
      artistImageUrl: artists.imageUrl,
    })
    .from(events)
    .innerJoin(artists, eq(events.artistId, artists.id))
    .leftJoin(venues, eq(events.venueId, venues.id))
    .where(and(gte(events.eventDate, now), lte(events.eventDate, endOfDay)))
    .orderBy(events.eventDate);

  // Deduplicate
  const packageKeywords = ['vip', 'package', 'upgrade', 'comfort seat', 'suite',
    'box seat', 'vinyl room', 'premium', 'platinum', 'hospitality', 'club level',
    'logen-seat', 'payment plan', 'upsell', 'excluding concert ticket'];
  const isPackage = (name: string) =>
    packageKeywords.some(kw => name.toLowerCase().includes(kw));

  const groups = new Map<string, typeof results[0]>();
  for (const row of results) {
    const key = `${row.event.artistId}_${row.venue?.city || 'none'}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, row);
    } else if (isPackage(existing.event.name) && !isPackage(row.event.name)) {
      groups.set(key, row);
    }
  }
  return Array.from(groups.values());
}

export async function generateMetadata(): Promise<Metadata> {
  const tonightEvents = await getTonightEvents();
  return generateTonightMetadata(tonightEvents.length);
}

export default async function TonightPage() {
  const tonightEvents = await getTonightEvents();

  // Group by city
  const byCity = new Map<string, typeof tonightEvents>();
  for (const row of tonightEvents) {
    const city = row.venue?.city || 'Other';
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city)!.push(row);
  }

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Concerts', url: `${SITE_URL}/concerts` },
    { name: 'Tonight', url: `${SITE_URL}/concerts/tonight` },
  ]);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Concerts', url: '/concerts' },
    { name: 'Tonight', url: '/concerts/tonight' },
  ];

  return (
    <>
      <StructuredData data={[breadcrumbSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            Concerts <span className="gradient-text">Tonight</span>
          </h1>
          <p className="text-xl text-gray-600">
            {tonightEvents.length} show{tonightEvents.length === 1 ? '' : 's'} happening tonight
          </p>
          <div className="flex gap-3 mt-4">
            <Link href="/concerts/this-weekend" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg transition-colors">This Weekend</Link>
            <Link href="/concerts/this-week" className="text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg transition-colors">This Week</Link>
          </div>
        </div>

        {tonightEvents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
            <p className="text-gray-500 text-lg">No concerts tonight. Check out <Link href="/concerts/this-weekend" className="text-orange-500 hover:text-orange-600 font-medium">this weekend&apos;s shows</Link>.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {Array.from(byCity.entries()).map(([city, cityEvents]) => (
              <section key={city}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-1 w-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {city !== 'Other' ? (
                      <Link href={`/concerts/${slugify(city)}`} className="hover:text-orange-600 transition-colors">{city}</Link>
                    ) : city}
                  </h2>
                  <div className="h-px flex-1 bg-gray-200"></div>
                  <span className="text-sm text-gray-400">{cityEvents.length} show{cityEvents.length === 1 ? '' : 's'}</span>
                </div>
                <div className="space-y-4">
                  {cityEvents.map((row) => (
                    <div key={row.event.id} className="group bg-white rounded-xl shadow-md hover:shadow-2xl card-hover p-6 border border-gray-100">
                      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                        <div className="flex items-start gap-4 flex-1">
                          <Link href={`/artists/${row.artistSlug}`} className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-500 to-red-500">
                            {row.artistImageUrl ? (
                              <Image src={row.artistImageUrl} alt={row.artistName} width={56} height={56} className="w-full h-full object-cover" sizes="56px" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold">{row.artistName.charAt(0)}</div>
                            )}
                          </Link>
                          <div className="flex-1">
                            <Link href={`/artists/${row.artistSlug}`} className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors text-lg">{row.artistName}</Link>
                            <p className="text-sm text-gray-600 mt-1">{row.event.name}</p>
                            {row.venue && (
                              <p className="text-sm text-gray-500 mt-1">
                                <Link href={`/venues/${slugify(row.venue.name)}`} className="hover:text-orange-600 transition-colors">{row.venue.name}</Link>
                                {row.venue.state && `, ${row.venue.state}`}
                              </p>
                            )}
                          </div>
                        </div>
                        {row.event.ticketUrl && (
                          <a href={getAffiliateUrl(row.event.ticketUrl, row.event.source)} target="_blank" rel="noopener noreferrer" className="btn-primary whitespace-nowrap">
                            Get Tickets
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
