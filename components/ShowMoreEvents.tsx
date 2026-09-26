'use client';

import { useState } from 'react';

interface Props {
  children: React.ReactNode[];
  initialCount?: number;
}

export default function ShowMoreEvents({ children, initialCount = 3 }: Props) {
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? children : children.slice(0, initialCount);
  const remaining = children.length - initialCount;

  return (
    <>
      {visible}
      {!showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-3 text-left text-sm font-semibold text-ink hover:text-wax border-t border-line transition-colors"
        >
          Show {remaining} more day{remaining === 1 ? '' : 's'}
        </button>
      )}
    </>
  );
}
