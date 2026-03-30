'use client';

interface AddToCalendarButtonProps {
  eventId: string;
  className?: string;
}

export default function AddToCalendarButton({ eventId, className = '' }: AddToCalendarButtonProps) {
  return (
    <a
      href={`/api/calendar?eventId=${encodeURIComponent(eventId)}`}
      download
      className={`inline-flex items-center gap-1.5 px-3 min-h-[44px] py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors ${className}`}
      title="Add to calendar"
    >
      <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      Add to Calendar
    </a>
  );
}
