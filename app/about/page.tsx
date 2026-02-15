export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">About TourWax</h1>

      <div className="prose prose-lg max-w-none space-y-6">
        <p className="text-xl text-gray-700 leading-relaxed">
          TourWax is your go-to source for live music tour dates, venues, and artist news—all in one place.
        </p>

        <div className="bg-white rounded-lg shadow-sm p-8 my-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What We Do</h2>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">✓</span>
              <span>Automatically track tour dates from major ticketing platforms</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">✓</span>
              <span>Aggregate venue information including location and capacity</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">✓</span>
              <span>Curate the latest news and updates for each artist</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">✓</span>
              <span>Update everything automatically—no manual intervention needed</span>
            </li>
          </ul>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">Our Mission</h2>
        <p className="text-gray-700 leading-relaxed">
          We believe live music is best experienced, not missed. TourWax exists to make sure you never
          miss a show from your favorite artists by bringing all the essential information together in
          one streamlined, easy-to-use platform.
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">Data Sources</h2>
        <p className="text-gray-700 leading-relaxed">
          We aggregate tour dates from Ticketmaster and SeatGeek, ensuring comprehensive coverage of
          concerts and live events. Our platform updates multiple times per day to keep you informed
          about new tour announcements, date changes, and ticket availability.
        </p>
      </div>
    </div>
  );
}
