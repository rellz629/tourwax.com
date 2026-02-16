export default function TestPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-20">
      <h1 className="text-4xl font-bold mb-4">Test Page Works! ✅</h1>
      <p className="text-xl mb-8">If you can see this, routing is working.</p>

      <div className="space-y-4">
        <a
          href="/artists/tyler-the-creator"
          className="block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Test Link (regular anchor)
        </a>

        <a
          href="/artists"
          className="block px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          Go to Artists List
        </a>
      </div>
    </div>
  );
}
