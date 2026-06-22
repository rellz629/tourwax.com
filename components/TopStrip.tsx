import Link from 'next/link';

export interface TopStripItem {
  href: string;
  /** Primary bold line (the entity name). */
  title: string;
  /** Optional second line. */
  subtitle?: string;
  /** Optional smaller third line. */
  meta?: string;
  /** Number shown in the colored badge (e.g. show/date/artist count). */
  badgeValue?: string | number;
  /** Tiny label under the badge value (e.g. "shows", "dates", "artists"). */
  badgeLabel?: string;
}

interface Props {
  title: string;
  /** Small caption under the heading (e.g. "Most dates in the next 60 days"). */
  subtitle?: string;
  items: TopStripItem[];
}

/**
 * Ranked "Top 5" strip rendered above an index page's main grid. Wrapped in the
 * same tinted panel as the homepage "Concerts Near You" block so it reads as a
 * distinct, self-contained section rather than blending into the grid below.
 * Uses an ordered list so the 1-5 ranking is conveyed semantically; the visible
 * numerals are decorative (aria-hidden).
 */
export default function TopStrip({ title, subtitle, items }: Props) {
  if (items.length === 0) return null;

  return (
    <section className="mb-12" aria-label={title}>
      <div className="bg-gradient-to-br from-orange-50 via-white to-red-50 rounded-2xl border border-orange-100 p-6 md:p-8">
        <div className="mb-5">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900">
            <span className="gradient-text">{title}</span>
          </h2>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {items.map((item, i) => (
            <li key={item.href} className="h-full">
              <Link
                href={item.href}
                className="group flex flex-col h-full bg-white rounded-xl shadow-sm hover:shadow-xl card-hover overflow-hidden border border-orange-100"
              >
                <div className="h-2 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600"></div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      aria-hidden="true"
                      className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white font-black flex items-center justify-center text-sm"
                    >
                      {i + 1}
                    </span>
                    {item.badgeValue !== undefined && (
                      <div className="flex flex-col items-end leading-none text-right">
                        <span className="text-2xl font-black text-gray-900">{item.badgeValue}</span>
                        {item.badgeLabel && (
                          <span className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">{item.badgeLabel}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <h3 className="mt-3 text-base font-bold text-gray-900 group-hover:text-orange-500 transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                  {item.subtitle && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-1">{item.subtitle}</p>
                  )}
                  {item.meta && (
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{item.meta}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
