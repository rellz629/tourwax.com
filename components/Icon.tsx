import type { IconName } from './IconSprite';

interface IconProps {
  name: IconName;
  className?: string;
}

/**
 * Decorative line icon drawn from the sprite that `IconSprite` renders once
 * per page (app/layout.tsx). A `<use>` reference is ~80 bytes where the same
 * inline `<svg><path/></svg>` was ~330 bytes, and listing pages carry 50-110
 * of them. Every byte is also duplicated into the RSC payload and billed per
 * 8 KB of ISR cache, so prefer this over inline SVG for repeated icons.
 */
export default function Icon({ name, className }: IconProps) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  );
}
