import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure',
  description: 'How TourWax earns from ticket links. We participate in the Ticketmaster and SeatGeek affiliate programs and may earn a commission when you buy tickets through our links, at no extra cost to you.',
  alternates: { canonical: '/affiliate-disclosure' },
};

export default function AffiliateDisclosurePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">Affiliate Disclosure</h1>

      <div className="prose prose-lg max-w-none space-y-6">
        <p className="text-xl text-gray-700 leading-relaxed">
          TourWax is reader-supported. When you buy tickets through links on our site, we may earn a
          commission at no additional cost to you.
        </p>

        <div className="bg-white rounded-lg shadow-sm p-8 my-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How It Works</h2>
          <p className="text-gray-700 leading-relaxed">
            Some of the ticket links on TourWax are affiliate links. If you click one of these links and
            complete a purchase, the ticketing partner pays us a small commission. The price you pay is
            exactly the same as it would be without our link, so using these links is one way to support
            the site at no cost to you.
          </p>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">Our Affiliate Partners</h2>
        <p className="text-gray-700 leading-relaxed">
          TourWax participates in the affiliate programs of the following ticketing platforms:
        </p>
        <ul className="space-y-3 text-gray-700">
          <li className="flex items-start">
            <span className="text-blue-600 mr-2" aria-hidden="true">✓</span>
            <span><strong>Ticketmaster</strong>, through the Impact affiliate network</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2" aria-hidden="true">✓</span>
            <span><strong>SeatGeek</strong>, through the Impact affiliate network</span>
          </li>
        </ul>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">Our Commitment</h2>
        <p className="text-gray-700 leading-relaxed">
          Affiliate commissions never change which events or artists we list, how we rank them, or the
          information we show you. Tour dates, venues, and prices come straight from our ticketing data
          sources. We earn only when you choose to buy, and our goal is simply to help you find and get
          to the shows you want to see.
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">Questions</h2>
        <p className="text-gray-700 leading-relaxed">
          If you have any questions about how TourWax earns from ticket links, please reach out through
          our <a href="/about" className="text-blue-600 hover:text-blue-800 underline">About page</a>.
        </p>
      </div>
    </div>
  );
}
