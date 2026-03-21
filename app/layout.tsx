import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import "./globals.css";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://www.tourwax.com'),
  title: {
    default: 'TourWax - Live Music Tour Dates & News',
    template: '%s | TourWax',
  },
  description: 'Discover upcoming concert tour dates, venues, and latest news for your favorite music artists.',
  keywords: [
    'concert tour dates',
    'live music',
    'tour tickets',
    'concert venues',
    'music news',
    'tour announcements',
    'upcoming concerts',
    'artist tour dates',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.tourwax.com',
    siteName: 'TourWax',
    title: 'TourWax - Live Music Tour Dates & News',
    description: 'Discover upcoming concert tour dates, venues, and latest news for your favorite music artists.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TourWax - Live Music Tour Dates & News',
    description: 'Discover upcoming concert tour dates, venues, and latest news for your favorite music artists.',
  },
  icons: {
    icon: '/icon.svg',
  },
  manifest: '/site.webmanifest',
  alternates: {
    types: {
      'application/rss+xml': '/blog/feed.xml',
    },
  },
  other: {
    'impact-site-verification': '14fbf304-5f00-473c-af9b-cd49c53ce839',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f97316',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50 backdrop-blur-lg bg-white/95">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-20">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center group">
                  <img
                    src="/logo.svg"
                    alt="TourWax"
                    className="h-14 w-auto transition-transform group-hover:scale-105"
                  />
                </Link>
                <div className="hidden sm:flex sm:gap-1">
                  <Link
                    href="/artists"
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                  >
                    Artists
                  </Link>
                  <Link
                    href="/concerts"
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                  >
                    Concerts
                  </Link>
                  <Link
                    href="/tours"
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                  >
                    Tours
                  </Link>
                  <Link
                    href="/venues"
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                  >
                    Venues
                  </Link>
                  <Link
                    href="/festivals"
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                  >
                    Festivals
                  </Link>
                  <Link
                    href="/blog"
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                  >
                    Blog
                  </Link>
                  <Link
                    href="/about"
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                  >
                    About
                  </Link>
                </div>
              </div>
              <div className="flex items-center">
                <SearchBar />
              </div>
            </div>
          </div>
        </nav>
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
        <footer className="bg-gradient-to-br from-gray-900 to-gray-800 border-t border-gray-700">
          <div className="max-w-7xl mx-auto pt-12 pb-8 px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
              <div>
                <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Browse</h3>
                <ul className="space-y-2">
                  <li><Link href="/artists" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">Artists</Link></li>
                  <li><Link href="/concerts" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">Concerts by City</Link></li>
                  <li><Link href="/tours" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">Tours by Genre</Link></li>
                  <li><Link href="/venues" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">Venues</Link></li>
                  <li><Link href="/festivals" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">Festivals</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Top Genres</h3>
                <ul className="space-y-2">
                  <li><Link href="/tours/hip-hop" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">Hip-Hop</Link></li>
                  <li><Link href="/tours/pop" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">Pop</Link></li>
                  <li><Link href="/tours/rock" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">Rock</Link></li>
                  <li><Link href="/tours/country" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">Country</Link></li>
                  <li><Link href="/tours/rb" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">R&B</Link></li>
                  <li><Link href="/tours/electronic" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">Electronic</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Quick Links</h3>
                <ul className="space-y-2">
                  <li><Link href="/concerts/tonight" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">Concerts Tonight</Link></li>
                  <li><Link href="/concerts/this-weekend" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">This Weekend</Link></li>
                  <li><Link href="/concerts/this-week" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">This Week</Link></li>
                  <li><Link href="/insights" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">Insights</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Resources</h3>
                <ul className="space-y-2">
                  <li><Link href="/blog" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">Blog</Link></li>
                  <li><Link href="/about" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">About TourWax</Link></li>
                  <li><Link href="/blog/feed.xml" className="text-gray-400 hover:text-orange-400 text-sm transition-colors">RSS Feed</Link></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-700 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                </div>
                <span className="text-white font-bold text-sm">TourWax</span>
              </div>
              <p className="text-gray-500 text-xs">
                © {new Date().getFullYear()} TourWax. All rights reserved. Concert data from Ticketmaster and SeatGeek.
              </p>
            </div>
          </div>
        </footer>
        <Analytics />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-SBN01WP17J"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-SBN01WP17J');
          `}
        </Script>
      </body>
    </html>
  );
}
