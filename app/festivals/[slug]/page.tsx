import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { generateFestivalMetadata, SITE_URL } from '@/lib/seo';
import { generateBreadcrumbSchema, generateFestivalEventSchema, generateFAQSchema } from '@/lib/schema';
import StructuredData from '@/components/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getAllFestivals, getArchivedFestivals, getFestivalBySlug, findBrandFestival } from '@/lib/festivals';
import type { FestivalEventCard } from '@/lib/festivals';
import { shouldNoindexFestival } from '@/lib/seo-pruning';
import { getFestivalImage } from '@/lib/festival-images';
import { getAffiliateUrl, getVividSeatsSearchUrl, getStubHubSearchUrl } from '@/lib/affiliate';
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
    // Pre-render canonical AND every legacy slug so old URLs resolve at the static layer.
    for (const slug of [f.slug, f.legacySlug, ...f.legacySlugs]) {
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

  const metadata = generateFestivalMetadata({
    festivalName: festival.name,
    slug: festival.slug,
    venueName: festival.venue.name,
    city: festival.venue.city,
    date: festival.formattedDateRange,
    artistCount: festival.artistCount,
    artistNames: festival.artists.map((a) => a.name),
    isPast: festival.isPast,
  });

  // Tour stops, single-show ad-hoc groupings, and other not-real-festival
  // pages get noindex. The page still renders so internal links don't 404,
  // but it's not surfaced to search.
  const noindex = shouldNoindexFestival({
    brandKey: findBrandFestival(festival.name),
    artistCount: festival.artistCount,
    daysCount: festival.days.length,
  });
  if (noindex) {
    return { ...metadata, robots: { index: false, follow: true } };
  }
  return metadata;
}

function pickPrimaryEvent(events: FestivalEventCard[]): FestivalEventCard | null {
  if (events.length === 0) return null;
  const withPrice = events.filter((e) => e.minPrice !== null && e.minPrice > 0);
  if (withPrice.length === 0) return events[0];
  return withPrice.reduce((cheapest, e) =>
    cheapest.minPrice !== null && e.minPrice !== null && e.minPrice < cheapest.minPrice ? e : cheapest
  , withPrice[0]);
}

function CtaButtons({
  event,
  festivalName,
  variant = 'primary',
}: {
  event: FestivalEventCard;
  festivalName: string;
  variant?: 'primary' | 'compact';
}) {
  const sources: { label: string; href: string; source: string }[] = [];
  for (const ts of event.ticketSources) {
    if (!ts.ticketUrl) continue;
    sources.push({
      label: ts.source.charAt(0).toUpperCase() + ts.source.slice(1),
      href: getAffiliateUrl(ts.ticketUrl, ts.source),
      source: ts.source.toLowerCase(),
    });
  }
  // Resale fallbacks: search-based URLs, useful even when face-value is sold out.
  sources.push({ label: 'Vivid Seats', href: getVividSeatsSearchUrl(festivalName), source: 'vividseats' });
  sources.push({ label: 'StubHub', href: getStubHubSearchUrl(festivalName), source: 'stubhub' });

  const baseClass = variant === 'primary'
    ? 'btn-primary text-base'
    : 'inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors';
  const altClass = variant === 'primary'
    ? 'inline-flex items-center justify-center px-5 py-3 rounded-lg font-bold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors'
    : 'inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors';

  return (
    <div className={variant === 'primary' ? 'flex flex-wrap gap-3' : 'flex flex-wrap gap-2 justify-end'}>
      {sources.map((s, i) => (
        <a
          key={s.source}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className={i === 0 ? baseClass : altClass}
        >
          Get Tickets <span className="opacity-75 ml-1.5">{s.label}</span>
        </a>
      ))}
    </div>
  );
}

function EventCard({
  event,
  festivalName,
  isPast,
}: {
  event: FestivalEventCard;
  festivalName: string;
  isPast: boolean;
}) {
  return (
    <div
      id={`event-${event.id}`}
      className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100"
    >
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-lg">{event.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {event.formattedDate}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {new Date(event.eventDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
            {!isPast && event.minPrice !== null && (
              <>
                <span className="text-gray-300">|</span>
                <span className="font-semibold text-orange-600">
                  From {event.currency || 'USD'} {event.minPrice}
                  {event.maxPrice !== null && event.maxPrice !== event.minPrice && ` - ${event.maxPrice}`}
                </span>
              </>
            )}
          </div>
        </div>
        {!isPast && <CtaButtons event={event} festivalName={festivalName} variant="compact" />}
        {isPast && (
          <span className="text-xs text-gray-500 italic">Tickets no longer available</span>
        )}
      </div>
    </div>
  );
}

export default async function FestivalPage({ params }: Props) {
  const { slug } = await params;
  const festival = await getFestivalBySlug(slug);

  if (!festival) {
    notFound();
  }

  // Non-canonical slug → 308 redirect to canonical so Google consolidates.
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
    events: festival.events.flatMap((e) =>
      e.ticketSources.map((ts) => ({
        ticketUrl: ts.ticketUrl,
        minPrice: ts.minPrice,
        maxPrice: ts.maxPrice,
        currency: ts.currency,
        source: ts.source,
      }))
    ),
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

  const primaryEvent = pickPrimaryEvent(festival.events);

  const faqs = isPast
    ? [
        {
          question: `When was ${festival.name}?`,
          answer: `${festival.name} took place ${festival.formattedDateRange} at ${venueLocationText}.`,
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
          answer: `${festival.name} took place on ${festival.formattedDateRange}, so face-value tickets are no longer available. Browse current tour dates from the lineup above to find their next shows.`,
        },
        {
          question: `How many artists performed at ${festival.name}?`,
          answer: `${festival.artistCount} artist${festival.artistCount === 1 ? '' : 's'} performed at ${festival.name}.`,
        },
      ]
    : [
        {
          question: `When is ${festival.name}?`,
          answer: `${festival.name} takes place ${festival.formattedDateRange} at ${venueLocationText}.`,
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
          answer: `Tickets to ${festival.name} are available through Ticketmaster, SeatGeek, Vivid Seats, and StubHub. ${lowestPrice ? `Prices start from $${lowestPrice}.` : ''} Compare prices in the Event Details section below.`,
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
                {festival.name} {performedAt} on {festival.formattedDateRange}. Tickets are no longer available, but you can browse the lineup&apos;s current tour dates below.
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

        <div className="mb-8">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className={isPast ? 'text-gray-700' : 'gradient-text'}>{festival.name}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-gray-600">
            <span className="flex items-center gap-2 text-lg">
              <svg className="w-5 h-5 text-gray-400" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {festival.formattedDateRange}
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
            {festival.isMultiDay && ` across ${festival.days.length} days`}
          </p>
        </div>

        {/* Primary CTA: cheapest pass + multi-source buttons (only when upcoming) */}
        {!isPast && primaryEvent && (
          <section className="mb-12 rounded-2xl bg-gradient-to-br from-orange-50 to-red-50 border border-orange-100 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide font-bold text-orange-600 mb-1">Get Tickets</p>
                <p className="text-lg font-bold text-gray-900">
                  {primaryEvent.name}
                </p>
                {primaryEvent.minPrice !== null && primaryEvent.minPrice > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    From {primaryEvent.currency || 'USD'} ${primaryEvent.minPrice}
                  </p>
                )}
              </div>
              <CtaButtons event={primaryEvent} festivalName={festival.name} variant="primary" />
            </div>
            {festival.events.length > 1 && (
              <p className="text-sm text-gray-500 mt-4">
                <a href="#event-details" className="font-medium text-orange-600 hover:text-orange-700">
                  More ticket options below ↓
                </a>
              </p>
            )}
          </section>
        )}

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

        {/* Secondary CTA: smaller, between lineup and Event Details */}
        {!isPast && primaryEvent && (
          <section className="mb-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Ready to grab tickets?</span>
              {primaryEvent.minPrice !== null && primaryEvent.minPrice > 0 && (
                <> Passes start at ${primaryEvent.minPrice}.</>
              )}
            </p>
            <CtaButtons event={primaryEvent} festivalName={festival.name} variant="compact" />
          </section>
        )}

        {/* Day-by-day breakdown for multi-day festivals */}
        {festival.isMultiDay && (
          <section id="lineup-by-day" className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-1 w-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-900">Lineup by Day</h2>
              <div className="h-px flex-1 bg-gray-200"></div>
            </div>
            <div className="space-y-8">
              {festival.days.map((day, i) => (
                <div key={day.date} id={`day-${i + 1}`}>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    Day {i + 1}: {day.formattedDate}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({day.artists.length} artist{day.artists.length === 1 ? '' : 's'})
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
                    {day.artists.map((artist) => (
                      <Link
                        key={artist.slug}
                        href={`/artists/${artist.slug}`}
                        className="group bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-100 p-2 text-center"
                      >
                        <div className="w-full aspect-square rounded-md bg-gradient-to-br from-orange-500 to-red-500 overflow-hidden mb-2">
                          {artist.imageUrl ? (
                            <Image
                              src={artist.imageUrl}
                              alt={artist.name}
                              width={120}
                              height={120}
                              className="w-full h-full object-cover"
                              sizes="(max-width: 640px) 33vw, 14vw"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                              {artist.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-gray-900 group-hover:text-orange-500 transition-colors truncate">
                          {artist.name}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Event Details: deduplicated tickets across the festival */}
        <section id="event-details" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-1 w-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-900">
              {festival.events.length === 1 ? 'Event Details' : `Ticket Options (${festival.events.length})`}
            </h2>
            <div className="h-px flex-1 bg-gray-200"></div>
          </div>

          <div className="space-y-4">
            {festival.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                festivalName={festival.name}
                isPast={isPast}
              />
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
