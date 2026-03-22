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
    <div className="hidden sm:flex sm:gap-1">
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              isActive
                ? 'text-orange-600 bg-orange-50'
                : 'text-gray-700 hover:text-orange-500 hover:bg-orange-50'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
