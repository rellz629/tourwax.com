import Link from 'next/link';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
}

export default function Pagination({ currentPage, totalPages, basePath }: PaginationProps) {
  if (totalPages <= 1) return null;

  const separator = basePath.includes('?') ? '&' : '?';

  function pageUrl(page: number) {
    if (page === 1) return basePath.split('?')[0] || basePath;
    return `${basePath}${separator}page=${page}`;
  }

  // Build page number list with ellipsis
  const pages: (number | 'ellipsis')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 mt-12">
      {currentPage > 1 && (
        <Link
          href={pageUrl(currentPage - 1)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Previous
        </Link>
      )}

      <div className="hidden sm:flex items-center gap-1">
        {pages.map((page, i) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-3 py-2 text-sm text-gray-400">
              ...
            </span>
          ) : (
            <Link
              key={page}
              href={pageUrl(page)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                page === currentPage
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              }`}
              {...(page === currentPage ? { 'aria-current': 'page' as const } : {})}
            >
              {page}
            </Link>
          )
        )}
      </div>

      <span className="sm:hidden text-sm text-gray-500">
        Page {currentPage} of {totalPages}
      </span>

      {currentPage < totalPages && (
        <Link
          href={pageUrl(currentPage + 1)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Next
        </Link>
      )}
    </nav>
  );
}
