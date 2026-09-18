'use client';
import Icon from '@/components/Icon';

interface AddToCalendarButtonProps {
  eventId: string;
  className?: string;
}

export default function AddToCalendarButton({ eventId, className = '' }: AddToCalendarButtonProps) {
  return (
    <a
      href={`/api/calendar?eventId=${encodeURIComponent(eventId)}`}
      download
      rel="nofollow"
      className={`inline-flex items-center gap-1.5 px-3 min-h-[44px] py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors ${className}`}
      title="Add to calendar"
    >
      <Icon name="calendar" className="w-3.5 h-3.5" />
      Add to Calendar
    </a>
  );
}
