import Link from 'next/link';
import type { ReactNode } from 'react';
import type { EventLabel } from '@/lib/event-utils';

/**
 * Wraps a listing row's primary content (avatar or name) in the correct anchor
 * for its event. Festivals link out to tickets (affiliate-wrapped, new tab);
 * regular events link to the artist page. When there is no destination (a
 * festival with no ticket URL) it renders the children unwrapped.
 *
 * The label is computed once per row via `eventPrimaryLabel` and shared between
 * the avatar and name links so a whole row points to the same place.
 */
export default function EventLink({
  label,
  className,
  children,
  showNewTabHint = false,
}: {
  label: EventLabel;
  className?: string;
  children: ReactNode;
  showNewTabHint?: boolean;
}) {
  if (!label.href) {
    return <span className={className}>{children}</span>;
  }

  if (label.external) {
    return (
      <a href={label.href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
        {showNewTabHint && <span className="sr-only">(opens in new tab)</span>}
      </a>
    );
  }

  return (
    <Link href={label.href} className={className}>
      {children}
    </Link>
  );
}
