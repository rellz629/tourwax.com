/**
 * Generate iCalendar (.ics) file content for concert events.
 * Spec: RFC 5545
 */

interface CalendarEvent {
  id: string;
  name: string;
  eventDate: Date;
  venueName?: string;
  venueCity?: string;
  venueState?: string;
  venueCountry?: string;
  venueAddress?: string;
  venueTimezone?: string;
  ticketUrl?: string;
  artistName: string;
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatDateUTC(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function buildLocation(event: CalendarEvent): string {
  const parts: string[] = [];
  if (event.venueName) parts.push(event.venueName);
  const cityState = [event.venueCity, event.venueState].filter(Boolean).join(', ');
  if (cityState) parts.push(cityState);
  if (event.venueCountry) parts.push(event.venueCountry);
  return parts.join(', ');
}

export function generateICalEvent(event: CalendarEvent): string {
  const now = new Date();
  const endDate = new Date(event.eventDate.getTime() + 3 * 60 * 60 * 1000); // 3 hour default duration

  const location = buildLocation(event);
  const description = [
    `${event.artistName} live at ${event.venueName || 'TBA'}`,
    event.ticketUrl ? `Tickets: ${event.ticketUrl}` : '',
    `More info: https://tourwax.com`,
  ].filter(Boolean).join('\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TourWax//Concert Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@tourwax.com`,
    `DTSTAMP:${formatDateUTC(now)}`,
    `DTSTART:${formatDateUTC(event.eventDate)}`,
    `DTEND:${formatDateUTC(endDate)}`,
    `SUMMARY:${escapeICalText(event.name)}`,
    `DESCRIPTION:${escapeICalText(description)}`,
  ];

  if (location) {
    lines.push(`LOCATION:${escapeICalText(location)}`);
  }

  if (event.ticketUrl) {
    lines.push(`URL:${event.ticketUrl}`);
  }

  lines.push(
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  );

  return lines.join('\r\n');
}

export function generateICalFile(calEvents: CalendarEvent[], title: string): string {
  const now = new Date();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TourWax//Concert Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalText(title)}`,
  ];

  for (const event of calEvents) {
    const endDate = new Date(event.eventDate.getTime() + 3 * 60 * 60 * 1000);
    const location = buildLocation(event);
    const description = [
      `${event.artistName} live at ${event.venueName || 'TBA'}`,
      event.ticketUrl ? `Tickets: ${event.ticketUrl}` : '',
      `More info: https://tourwax.com`,
    ].filter(Boolean).join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@tourwax.com`,
      `DTSTAMP:${formatDateUTC(now)}`,
      `DTSTART:${formatDateUTC(event.eventDate)}`,
      `DTEND:${formatDateUTC(endDate)}`,
      `SUMMARY:${escapeICalText(event.name)}`,
      `DESCRIPTION:${escapeICalText(description)}`,
    );

    if (location) {
      lines.push(`LOCATION:${escapeICalText(location)}`);
    }

    if (event.ticketUrl) {
      lines.push(`URL:${event.ticketUrl}`);
    }

    lines.push(
      'STATUS:CONFIRMED',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
