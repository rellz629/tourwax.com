'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ArtistResult {
  name: string;
  slug: string;
  imageUrl: string | null;
  genre: string | null;
}

interface CityResult {
  city: string;
  state: string | null;
  count: number;
  slug: string;
}

interface SearchResults {
  artists: ArtistResult[];
  cities: CityResult[];
}

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ artists: [], cities: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debounced fetch
  useEffect(() => {
    if (query.length < 2) {
      setResults({ artists: [], cities: [] });
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data: SearchResults = await res.json();
        setResults(data);
        setIsOpen(true);
      } catch {
        setResults({ artists: [], cities: [] });
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }, []);

  function navigate(url: string) {
    router.push(url);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  }

  const hasResults = results.artists.length > 0 || results.cities.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.length >= 2 && hasResults) setIsOpen(true);
          }}
          placeholder="Search artists & cities..."
          aria-label="Search artists and cities"
          className="w-48 sm:w-64 lg:w-72 pl-9 pr-3 py-2 text-sm rounded-lg bg-gray-100 border border-transparent focus:bg-white focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400 transition-colors"
        />
      </div>

      {isOpen && (
        <div
          role="listbox"
          className="absolute top-full mt-2 right-0 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
        >
          {isLoading && !hasResults ? (
            <div className="p-4 space-y-3">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
            </div>
          ) : !hasResults ? (
            <div className="p-4 text-sm text-gray-500 text-center">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto">
              {results.artists.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Artists
                  </div>
                  {results.artists.map((artist) => (
                    <button
                      key={artist.slug}
                      role="option"
                      onClick={() => navigate(`/artists/${artist.slug}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 transition-colors text-left"
                    >
                      {artist.imageUrl ? (
                        <img
                          src={artist.imageUrl}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-400 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">
                            {artist.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {artist.name}
                        </div>
                        {artist.genre && (
                          <div className="text-xs text-gray-500 truncate">
                            {artist.genre}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.cities.length > 0 && (
                <div>
                  {results.artists.length > 0 && (
                    <div className="border-t border-gray-100" />
                  )}
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Cities
                  </div>
                  {results.cities.map((city) => (
                    <button
                      key={city.slug}
                      role="option"
                      onClick={() => navigate(`/concerts/${city.slug}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-4 h-4 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {city.city}{city.state ? `, ${city.state}` : ''}
                        </div>
                        <div className="text-xs text-gray-500">
                          {city.count} upcoming event{city.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
