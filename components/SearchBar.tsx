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
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Build flat list of all options for keyboard navigation
  const allOptions: { type: 'artist' | 'city'; slug: string; url: string }[] = [];
  for (const a of results.artists) {
    allOptions.push({ type: 'artist', slug: a.slug, url: `/artists/${a.slug}` });
  }
  for (const c of results.cities) {
    allOptions.push({ type: 'city', slug: c.slug, url: `/concerts/${c.slug}` });
  }

  const activeOptionId = activeIndex >= 0 && activeIndex < allOptions.length
    ? `search-option-${allOptions[activeIndex].slug}`
    : undefined;

  // Debounced fetch
  useEffect(() => {
    if (query.length < 2) {
      setResults({ artists: [], cities: [] });
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data: SearchResults = await res.json();
        setResults(data);
        setIsOpen(true);
        setActiveIndex(-1);
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
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen || allOptions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < allOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : allOptions.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      navigate(allOptions[activeIndex].url);
    }
  }, [isOpen, allOptions, activeIndex]);

  function navigate(url: string) {
    router.push(url);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  const hasResults = results.artists.length > 0 || results.cities.length > 0;
  let optionIndex = -1;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          aria-hidden="true"
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
          role="combobox"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.length >= 2 && hasResults) setIsOpen(true);
          }}
          placeholder="Search artists & cities..."
          aria-label="Search artists and cities"
          aria-expanded={isOpen}
          aria-controls="search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          className="w-48 sm:w-64 lg:w-72 pl-9 pr-8 py-2 text-sm rounded-lg bg-gray-100 border border-transparent focus:bg-white focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400 transition-colors"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2" role="status">
            <svg className="w-4 h-4 animate-spin text-orange-500" aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="sr-only">Loading search results</span>
          </div>
        )}
      </div>

      {isOpen && (
        <div
          id="search-listbox"
          role="listbox"
          aria-label="Search results"
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
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Artists
                  </div>
                  {results.artists.map((artist) => {
                    optionIndex++;
                    const idx = optionIndex;
                    return (
                      <button
                        key={artist.slug}
                        id={`search-option-${artist.slug}`}
                        role="option"
                        aria-selected={activeIndex === idx}
                        onClick={() => navigate(`/artists/${artist.slug}`)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                          activeIndex === idx ? 'bg-orange-50' : 'hover:bg-orange-50'
                        }`}
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
                    );
                  })}
                </div>
              )}

              {results.cities.length > 0 && (
                <div>
                  {results.artists.length > 0 && (
                    <div className="border-t border-gray-100" />
                  )}
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Cities
                  </div>
                  {results.cities.map((city) => {
                    optionIndex++;
                    const idx = optionIndex;
                    return (
                      <button
                        key={city.slug}
                        id={`search-option-${city.slug}`}
                        role="option"
                        aria-selected={activeIndex === idx}
                        onClick={() => navigate(`/concerts/${city.slug}`)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                          activeIndex === idx ? 'bg-orange-50' : 'hover:bg-orange-50'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-4 h-4 text-gray-500"
                            aria-hidden="true"
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
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
