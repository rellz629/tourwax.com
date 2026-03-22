'use client';

import { useEffect, useRef, useState } from 'react';

interface TwitterTimelineProps {
  handle: string;
}

export default function TwitterTimeline({ handle }: TwitterTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    // Load Twitter widget script if not already loaded
    const loadTwitterScript = () => {
      if (!(window as any).twttr) {
        const script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.onload = () => {
          if ((window as any).twttr?.widgets) {
            (window as any).twttr.widgets.load();
          }
        };
        document.body.appendChild(script);
      } else {
        // Twitter script already loaded, just refresh widgets
        (window as any).twttr.widgets.load();
      }
    };

    loadTwitterScript();

    // Set timeout to show error if widget doesn't load in 10 seconds
    timeoutId = setTimeout(() => {
      setIsLoading(false);
      setHasError(true);
    }, 10000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [handle]);

  return (
    <div ref={timelineRef} className="bg-white rounded-lg shadow-sm overflow-hidden">
      <a
        className="twitter-timeline"
        data-height="500"
        data-theme="light"
        data-chrome="noheader nofooter noborders"
        data-tweet-limit="5"
        href={`https://twitter.com/${handle}?ref_src=twsrc%5Etfw`}
      >
        {/* Fallback content - shown if Twitter is rate limited or blocked */}
        <div className="p-8 text-center">
          <div className="mb-4">
            <svg className="w-12 h-12 mx-auto text-blue-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <p className="text-gray-700 font-medium mb-2">
            @{handle}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            {isLoading ? 'Loading tweets...' : 'View latest tweets on X'}
          </p>
          <button
            onClick={() => window.open(`https://twitter.com/${handle}`, '_blank', 'noopener,noreferrer')}
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium cursor-pointer"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Follow on X
          </button>
          {hasError && (
            <p className="mt-4 text-xs text-gray-500">
              Twitter embed temporarily unavailable
            </p>
          )}
        </div>
      </a>
    </div>
  );
}
