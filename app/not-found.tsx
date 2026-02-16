import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for could not be found.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center">
        <div className="inline-block mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto shadow-2xl">
            <span className="text-white text-6xl font-black">404</span>
          </div>
        </div>

        <h1 className="text-5xl md:text-6xl font-black mb-4">
          <span className="gradient-text">Page Not Found</span>
        </h1>

        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Sorry, we couldn't find the page you're looking for. The artist or page may have been removed or the URL might be incorrect.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <Link
            href="/"
            className="btn-primary"
          >
            Go to Homepage
          </Link>
          <Link
            href="/artists"
            className="px-6 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-50 transition-colors font-bold shadow-md border border-gray-200"
          >
            Browse Artists
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto border border-gray-100">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Popular Artists</h2>
          <p className="text-gray-600 mb-4">Looking for tour dates? Check out these popular artists:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {['Drake', 'Taylor Swift', 'Bad Bunny', 'The Weeknd', 'Ed Sheeran', 'Beyoncé'].map((artist) => (
              <Link
                key={artist}
                href={`/artists/${artist.toLowerCase().replace(/\s+/g, '-')}`}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full hover:from-orange-600 hover:to-red-600 transition-all font-semibold shadow-md"
              >
                {artist}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
