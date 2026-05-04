import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateFestivalMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateFestivalEventSchema, generateFAQSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAllFestivals, getArchivedFestivals, getFestivalBySlug } from '@/lib/festivals';
import { getFestivalImage } from '@/lib/festival-images';
import { getAffiliateUrl } from '@/lib/affiliate';
import { slugify } from '@/lib/slugify';
import { normalizeGenre } from '@/lib/genres';
import { notFound, permanentRedirect } from 'next/navigation';

export const dynamic = 'force-static';
export const revalidate = 1800;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const [upcoming, archived] = await Promise.all([
    getAllFestivals(),
    getArchivedFestivals(),
  ]);
  const seen = new Set<string>();
  const params: { slug: string }[] = [];
  for (const f of [...upcoming, ...archived]) {
    // Pre-render canonical AND legacy slugs so both old GSC URLs and new ones resolve at the static layer.
    for (const slug of [f.slug, f.legacySlug]) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      params.push({ slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const festival = await getFestivalBySlug(slug);

  if (!festival) {
    return {
      title: 'Festival Not Found',
      description: 'The festival you are looking for could not be found.',
    };
  }

  return generateFestivalMetadata({
    festivalName: festival.name,
    slug: festival.slug,
    venueName: festival.venue.name,
    city: festival.venue.city,
    date: festival.formattedDate,
    artistCount: festival.artistCount,
    artistNames: festival.artists.map((a) => a.name),
    isPast: festival.isPast,
  });
}

export default async function FestivalPage({ params }: Props) {
  const { slug } = await params;
  const festival = await getFestivalBySlug(slug);

  if (!festival) {
    notFound();
  }

  // Legacy slug hit → redirect to canonical URL with 308 so Google consolidates.
  if (slug !== festival.slug) {
    permanentRedirect(`/festivals/${festival.slug}`);
  }

  const isPast = festival.isPast;
  const performVerb = isPast ? 'performed' : 'performing';
  const performedAt = isPast ? 'took place' : 'takes place';

  const locationParts: string[] = [];
  if (festival.venue.city) locationParts.push(festival.venue.city);
  if (festival.venue.state) locationParts.push(festival.venue.state);
  const locationLabel = locationParts.join(', ');

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Festivals', url: `${SITE_URL}/festivals` },
    { name: festival.name, url: `${SITE_URL}/festivals/${festival.slug}` },
  ]);

  const festivalSchema = generateFestivalEventSchema({
    name: festival.name,
    date: festival.date,
    venue: festival.venue,
    artists: festival.artists,
    events: festival.events.map((e) => ({
      ticketUrl: e.ticketUrl,
      minPrice: e.minPrice,
      maxPrice: e.maxPrice,
      currency: e.currency,
      source: e.source,
    })),
  });

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Festivals', url: '/festivals' },
    { name: festival.name, url: `/festivals/${festival.slug}` },
  ];

  const festivalImage = getFestivalImage(festival.slug);

  const lowestPrice = festival.events
    .map((e) => e.minPrice)
    .filter((p): p is number => p !== null && p > 0)
    .reduce<number | null>((min, p) => (min === null || p < min ? p : min), null);

  const topArtistNames = festival.artists.slice(0, 5).map((a) => a.name);
  const venueLocationText = locationLabel ? `${festival.venue.name} in ${locationLabel}` : festival.venue.name;

  const faqs = isPast
    ? [
        {
          question: `When was ${festival.name}?`,
          answer: `${festival.name} took place ${festival.formattedDate} at ${venueLocationText}.`,
        },
        {
          question: `Who performed at ${festival.name}?`,
          answer: festival.artists.length > 0
            ? `The ${festival.name} lineup included ${topArtistNames.join(', ')}${festival.artistCount > 5 ? `, and ${festival.artistCount - 5} more artists` : ''}.`
            : `The ${festival.name} lineup is not on file.`,
        },
        {
          question: `Where was ${festival.name} held?`,
          answer: `${festival.name} was held at ${venueLocationText}${festival.venue.address ? ` (${festival.venue.address})` : ''}.`,
        },
        {
          question: `Are tickets still available for ${festival.name}?`,
          answer: `${festival.name} took place on ${festival.formattedDate}, so tickets are no longer available. Browse current tour dates from the lineup above to find their next shows.`,
        },
        {
          question: `How many artists performed at ${festival.name}?`,
          answer: `${festival.artistCount} artist${festival.artistCount === 1 ? '' : 's'} performed at ${festival.name}.`,
        },
      ]
    : [
        {
          question: `When is ${festival.name}?`,
          answer: `${festival.name} takes place ${festival.formattedDate} at ${venueLocationText}.`,
        },
        {
          question: `Who is performing at ${festival.name}?`,
          answer: festival.artists.length > 0
            ? `The ${festival.name} lineup includes ${topArtistNames.join(', ')}${festival.artistCount > 5 ? `, and ${festival.artistCount - 5} more artists` : ''}.`
            : `The ${festival.name} lineup will be announced soon. Check back for updates.`,
        },
        {
          question: `Where is ${festival.name} held?`,
          answer: `${festival.name} is held at ${venueLocationText}${festival.venue.address ? ` (${festival.venue.address})` : ''}.`,
        },
        {
          question: `How do I get tickets to ${festival.name}?`,
          answer: `Tickets to ${festival.name} are available through Ticketmaster and SeatGeek. ${lowestPrice ? `Prices start from $${lowestPrice}.` : ''} Click "Get Tickets" on any artist below to be taken to the official ticket page.`,
        },
        {
          question: `How many artists are performing at ${festival.name}?`,
          answer: `${festival.artistCount} artist${festival.artistCount === 1 ? '' : 's'} ${festival.artistCount === 1 ? 'is' : 'are'} confirmed for ${festival.name}.`,
        },
      ];

  const faqSchema = generateFAQSchema(faqs);

  return (
    <>
      <StructuredData data={[breadcrumbSchema, festivalSchema, faqSchema]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        {isPast && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-gray-900">Archived festival</p>
              <p className="text-sm text-gray-600 mt-0.5">
                {festival.name} {performedAt} on {festival.formattedDate}. Tickets are no longer available, but you can browse the lineup&apos;s current tour dates below.
              </p>
            </div>
          </div>
        )}

        {festivalImage && (
          <div className="mb-10">
            <div className="rounded-2xl overflow-hidden shadow-xl bg-gray-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={festivalImage.flyerUrl}
                alt={`${festival.name} official lineup`}
                className="w-full max-h-[700px] object-contain mx-auto block"
              />
            </div>
            {festivalImage.officialUrl && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Official flyer via{' '}
                <a
                  href={festivalImage.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-orange-500 transition-colors underline"
                >
                  {festivalImage.credit || 'official website'}
                </a>
              </p>
            )}
          </div>
        )}

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className={isPast ? 'text-gray-700' : 'gradient-text'}>{festival.name}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-gray-600">
            <span className="flex items-center gap-2 text-lg">
              <svg className="w-5 h-5 text-gray-400" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {festival.formattedDate}
            </span>
            <span className="flex items-center gap-2 text-lg">
              <svg className="w-5 h-5 text-gray-400" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <Link href={`/venues/${festival.venueSlug}`} className="hover:text-orange-600 transition-colors">
                {festival.venue.name}
              </Link>
            </span>
            {locationLabel && (
              <>
                <span className="text-gray-300">|</span>
                {festival.venue.city ? (
                  <Link href={`/concerts/${slugify(festival.venue.city)}`} className="hover:text-orange-600 transition-colors">
                    {locationLabel}
                  </Link>
                ) : (
                  <span>{locationLabel}</span>
                )}
              </>
            )}
          </div>
          <p className="text-xl text-gray-600 mt-3">
            {festival.artistCount} artist{festival.artistCount === 1 ? '' : 's'} {performVerb}
          </p>
        </div>

        {/* Lineup Grid */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-1 w-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-900">Lineup</h2>
            <div className="h-px flex-1 bg-gray-200"></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {festival.artists.map((artist) => (
              <Link
                key={artist.slug}
                href={`/artists/${artist.slug}`}
                className="group bg-white rounded-xl shadow-md hover:shadow-lg card-hover overflow-hidden border border-gray-100 text-center"
              >
                <div className="w-full aspect-square bg-gradient-to-br from-orange-500 to-red-500 overflow-hidden">
                  {artist.imageUrl ? (
                    <Image
                      src={artist.imageUrl}
                      alt={artist.name}
                      width={200}
                      height={200}
                      className="w-full h-full object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                      {artist.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-bold text-sm text-gray-900 group-hover:text-orange-500 transition-colors truncate">
                    {artist.name}
                  </p>
                  {artist.genre && (
                    <p className="text-xs text-gray-500 mt-0.5">{normalizeGenre(artist.genre)}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Event Details */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-1 w-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-900">Event Details</h2>
            <div className="h-px flex-1 bg-gray-200"></div>
          </div>

          <div className="space-y-4">
            {festival.events.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100"
              >
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <Link
                      href={`/artists/${event.artist.slug}`}
                      className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-500 to-red-500"
                    >
                      {event.artist.imageUrl ? (
                        <Image
                          src={event.artist.imageUrl}
                          alt={event.artist.name}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                          sizes="56px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold">
                          {event.artist.name.charAt(0)}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1">
                      <Link
                        href={`/artists/${event.artist.slug}`}
                        className="font-bold text-gray-900 hover:text-orange-600 transition-colors text-lg"
                      >
                        {event.artist.name}
                      </Link>
                      <p className="text-sm text-gray-600 mt-1">{event.name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {new Date(event.eventDate).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        {!isPast && (event.minPrice || event.maxPrice) && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span className="font-semibold text-orange-600">
                              From {event.currency || 'USD'} {event.minPrice || event.maxPrice}
                              {event.maxPrice && event.minPrice !== event.maxPrice &&
                                ` - ${event.currency || 'USD'} ${event.maxPrice}`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {!isPast && event.ticketUrl && (
                      <a
                        href={getAffiliateUrl(event.ticketUrl, event.source)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary whitespace-nowrap"
                      >
                        Get Tickets
                      </a>
                    )}
                    {isPast && (
                      <Link
                        href={`/artists/${event.artist.slug}`}
                        className="text-sm font-semibold text-orange-500 hover:text-orange-600 whitespace-nowrap"
                      >
                        See current tour →
                      </Link>
                    )}
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                      via {event.source}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Venue Info */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-1 w-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-900">Venue</h2>
            <div className="h-px flex-1 bg-gray-200"></div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              <Link href={`/venues/${festival.venueSlug}`} className="hover:text-orange-600 transition-colors">
                {festival.venue.name}
              </Link>
            </h3>
            {festival.venue.address && (
              <p className="text-gray-600 text-sm mb-1">{festival.venue.address}</p>
            )}
            {locationLabel && (
              <p className="text-gray-500 text-sm">
                {festival.venue.city ? (
                  <Link href={`/concerts/${slugify(festival.venue.city)}`} className="hover:text-orange-600 transition-colors">
                    {locationLabel}
                  </Link>
                ) : (
                  locationLabel
                )}
              </p>
            )}
            {festival.venue.capacity && (
              <p className="text-gray-500 text-sm mt-2">
                Capacity: {festival.venue.capacity.toLocaleString()}
              </p>
            )}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group bg-white rounded-xl shadow-md border border-gray-100">
                <summary className="cursor-pointer p-5 font-semibold text-gray-900 hover:text-orange-600 transition-colors list-none flex justify-between items-center">
                  {faq.question}
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-2" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-5 pb-5 text-gray-600">{faq.answer}</div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
