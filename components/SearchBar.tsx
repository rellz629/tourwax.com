'use client';

import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';

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

interface Props {
  /** `nav` is the compact header field; `hero` is the full-width homepage field. */
  variant?: 'nav' | 'hero';
}

export default function SearchBar({ variant = 'nav' }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ artists: [], cities: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  // Two instances can be on the page at once (header + hero), so ids must be unique.
  const uid = useId();
  const listboxId = `search-listbox${uid}`;
  const optionId = (slug: string) => `search-option${uid}-${slug}`;

  const isHero = variant === 'hero';

  // Build flat list of all options for keyboard navigation
  const allOptions: { type: 'artist' | 'city'; slug: string; url: string }[] = [];
  for (const a of results.artists) {
    allOptions.push({ type: 'artist', slug: a.slug, url: `/artists/${a.slug}` });
  }
  for (const c of results.cities) {
    allOptions.push({ type: 'city', slug: c.slug, url: `/concerts/${c.slug}` });
  }

  const activeOptionId = activeIndex >= 0 && activeIndex < allOptions.length
    ? optionId(allOptions[activeIndex].slug)
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

  const inputClass = isHero
    ? 'w-full pl-11 pr-10 py-3.5 text-base rounded bg-paper text-ink border border-transparent focus:border-wax focus:outline-none placeholder:text-muted'
    : 'w-48 sm:w-64 lg:w-72 pl-9 pr-8 py-2 text-sm rounded bg-page text-ink border border-line focus:bg-paper focus:border-wax focus:outline-none placeholder:text-muted';

  const listboxClass = isHero
    ? 'absolute top-full mt-2 left-0 w-full bg-paper rounded border border-line overflow-hidden z-50'
    : 'absolute top-full mt-2 right-0 w-80 sm:w-96 bg-paper rounded border border-line overflow-hidden z-50';

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className={`absolute ${isHero ? 'left-4 w-5 h-5' : 'left-3 w-4 h-4'} top-1/2 -translate-y-1/2 text-muted pointer-events-none`}
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
          placeholder={isHero ? 'Find an artist or a city' : 'Search artists and cities'}
          aria-label="Search artists and cities"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          className={inputClass}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2" role="status">
            <svg className="w-4 h-4 animate-spin text-wax" aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="sr-only">Loading search results</span>
          </div>
        )}
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className={listboxClass}
        >
          {isLoading && !hasResults ? (
            <div className="p-4 space-y-3">
              <div className="h-4 w-24 bg-line rounded animate-pulse" />
              <div className="h-10 bg-page rounded animate-pulse" />
              <div className="h-10 bg-page rounded animate-pulse" />
            </div>
          ) : !hasResults ? (
            <div className="p-4 text-sm text-muted text-center">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto">
              {results.artists.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold text-muted">
                    Artists
                  </div>
                  {results.artists.map((artist) => {
                    optionIndex++;
                    const idx = optionIndex;
                    return (
                      <button
                        key={artist.slug}
                        id={optionId(artist.slug)}
                        role="option"
                        aria-selected={activeIndex === idx}
                        onClick={() => navigate(`/artists/${artist.slug}`)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                          activeIndex === idx ? 'bg-wax-tint' : 'hover:bg-wax-tint'
                        }`}
                      >
                        {artist.imageUrl ? (
                          <img
                            src={artist.imageUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">
                              {artist.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-ink truncate">
                            {artist.name}
                          </div>
                          {artist.genre && (
                            <div className="text-xs text-muted truncate">
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
                    <div className="border-t border-line" />
                  )}
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold text-muted">
                    Cities
                  </div>
                  {results.cities.map((city) => {
                    optionIndex++;
                    const idx = optionIndex;
                    return (
                      <button
                        key={city.slug}
                        id={optionId(city.slug)}
                        role="option"
                        aria-selected={activeIndex === idx}
                        onClick={() => navigate(`/concerts/${city.slug}`)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                          activeIndex === idx ? 'bg-wax-tint' : 'hover:bg-wax-tint'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-page flex items-center justify-center flex-shrink-0">
                          <Icon name="pin" className="w-4 h-4 text-muted" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-ink truncate">
                            {city.city}{city.state ? `, ${city.state}` : ''}
                          </div>
                          <div className="text-xs text-muted numerals">
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
