'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/artists', label: 'Artists' },
  { href: '/concerts', label: 'Concerts' },
  { href: '/tours', label: 'Tours' },
  { href: '/venues', label: 'Venues' },
  { href: '/festivals', label: 'Festivals' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="hidden sm:flex sm:gap-5">
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex items-center py-1 text-sm font-semibold border-b-2 transition-colors ${
              isActive
                ? 'text-ink border-wax'
                : 'text-ink border-transparent hover:text-wax'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
