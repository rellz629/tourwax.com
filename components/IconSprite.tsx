export type IconName =
  | 'calendar'
  | 'clock'
  | 'pin'
  | 'chevron-down'
  | 'building'
  | 'ticket'
  | 'arrow-right';

const PATHS: Record<IconName, string[]> = {
  calendar: ['M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'],
  clock: ['M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'],
  pin: [
    'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
    'M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  ],
  'chevron-down': ['M19 9l-7 7-7-7'],
  building: ['M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z'],
  ticket: ['M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z'],
  'arrow-right': ['M14 5l7 7m0 0l-7 7m7-7H3'],
};

/**
 * Hidden SVG symbol sheet rendered once in the root layout. `Icon` references
 * these by id. Symbols inherit `currentColor` from the referencing element, so
 * text color utilities on `<Icon className=...>` still work.
 */
export default function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      {(Object.keys(PATHS) as IconName[]).map((name) => (
        <symbol key={name} id={`i-${name}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          {PATHS[name].map((d) => (
            <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
          ))}
        </symbol>
      ))}
    </svg>
  );
}
