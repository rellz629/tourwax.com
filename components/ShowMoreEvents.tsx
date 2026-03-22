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
          className="w-full py-3 text-center text-sm font-semibold text-orange-500 hover:text-orange-600 bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-all"
        >
          Show {remaining} more day{remaining === 1 ? '' : 's'}
        </button>
      )}
    </>
  );
}
