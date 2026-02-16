import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

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
                </div>
              </div>
            </div>
          </div>
        </nav>
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
        <footer className="bg-gradient-to-br from-gray-900 to-gray-800 border-t border-gray-700">
          <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-bold">TourWax</p>
                  <p className="text-gray-400 text-sm">Live music tour dates & news</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm">
                © 2026 TourWax. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
