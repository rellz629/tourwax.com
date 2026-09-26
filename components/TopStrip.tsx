import Link from 'next/link';

export interface TopStripItem {
  href: string;
  /** Primary bold line (the entity name). */
  title: string;
  /** Optional second line. */
  subtitle?: string;
  /** Optional smaller third line. */
  meta?: string;
  /** Number shown large (e.g. show/date/artist count). */
  badgeValue?: string | number;
  /** Tiny label under the number (e.g. "shows", "dates", "artists"). */
  badgeLabel?: string;
}

interface Props {
  title: string;
  /** Small caption under the heading (e.g. "Most dates in the next 60 days"). */
  subtitle?: string;
  items: TopStripItem[];
}

/**
 * Ranked "Top 5" strip rendered above an index page's main grid. Poster
 * treatment: a section head with a 2px ink rule, then flat paper tiles with
 * the rank as a big condensed numeral. Uses an ordered list so the 1-5 ranking
 * is conveyed semantically; the visible numerals are decorative (aria-hidden).
 */
export default function TopStrip({ title, subtitle, items }: Props) {
  if (items.length === 0) return null;

  return (
    <section className="mb-12" aria-label={title}>
      <div className="section-head">
        <div>
          <h2 className="display text-3xl md:text-4xl text-ink">{title}</h2>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
      </div>
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {items.map((item, i) => (
          <li key={item.href} className="h-full">
            <Link
              href={item.href}
              className="group flex flex-col h-full tile p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <span aria-hidden="true" className="display text-4xl text-wax numerals leading-none">
                  {i + 1}
                </span>
                {item.badgeValue !== undefined && (
                  <div className="flex flex-col items-end leading-none text-right">
                    <span className="text-2xl font-bold text-ink numerals">{item.badgeValue}</span>
                    {item.badgeLabel && (
                      <span className="text-xs text-muted mt-1">{item.badgeLabel}</span>
                    )}
                  </div>
                )}
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink group-hover:text-wax transition-colors line-clamp-2">
                {item.title}
              </h3>
              {item.subtitle && (
                <p className="mt-1 text-sm text-muted line-clamp-1">{item.subtitle}</p>
              )}
              {item.meta && (
                <p className="mt-0.5 text-xs text-muted line-clamp-1">{item.meta}</p>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
