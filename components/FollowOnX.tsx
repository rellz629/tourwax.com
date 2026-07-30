export default function FollowOnX() {
  return (
    <section className="mt-8 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-md p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <svg className="w-6 h-6 text-white shrink-0 mt-1" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
        </svg>
        <div>
          <p className="text-white font-bold">Never miss a tour announcement</p>
          <p className="text-gray-300 text-sm mt-1">
            Follow @TourWaxUpdates for new tour dates, opening act reveals, and weekend concert picks.
          </p>
        </div>
      </div>
      <a
        href="https://x.com/TourWaxUpdates"
        target="_blank"
        rel="noopener"
        className="inline-flex items-center justify-center min-h-[44px] shrink-0 bg-white text-gray-900 text-sm font-semibold px-6 py-3 rounded-full hover:bg-orange-50 hover:text-orange-600 transition-colors"
      >
        Follow on X
      </a>
    </section>
  );
}
