'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/artists', label: 'Artists' },
  { href: '/concerts', label: 'Concerts' },
  { href: '/tours', label: 'Tours' },
  { href: '/venues', label: 'Venues' },
  { href: '/festivals', label: 'Festivals' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
];

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <div className="sm:hidden flex items-center">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
      >
        {isOpen ? (
          <svg className="w-6 h-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <nav
            id="mobile-menu"
            aria-label="Mobile navigation"
            className="fixed top-20 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50 animate-in slide-in-from-top-2"
          >
            <ul className="py-2 px-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`block px-4 py-3 rounded-lg text-base font-semibold transition-colors ${
                      pathname.startsWith(link.href)
                        ? 'text-orange-500 bg-orange-50'
                        : 'text-gray-700 hover:text-orange-500 hover:bg-orange-50'
                    }`}
                    aria-current={pathname.startsWith(link.href) ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
