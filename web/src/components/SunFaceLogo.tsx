/**
 * The "kidQ" sun-face mark: the smiling sun icon already used throughout child
 * mode (see design/prototype/index.html's #watch-sun / #choice-sun / #cast-sun,
 * and design/brand.md §8.7 — disc, 8 rays, dot eyes, smile), plus one addition:
 * a short diagonal tail crossing the disc's lower-right, turning the sun into
 * the smiling-sun "Q" from kidQ's real LinkedIn wordmark. Coordinates and
 * colors (sun/sun-deep/ink) are copied from that shared sun so this mark stays
 * pixel-consistent with it — this component is parent-app only and does not
 * replace or alter the child-mode sun.
 */
export function SunFaceLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
      <g stroke="#F0A72E" strokeWidth="3.4" strokeLinecap="round">
        <line x1="30" y1="1.5" x2="30" y2="9.5" />
        <line x1="50" y1="30" x2="58.5" y2="30" />
        <line x1="44" y1="16" x2="50" y2="10" />
        <line x1="44" y1="44" x2="50" y2="50" />
        <line x1="30" y1="50.5" x2="30" y2="58.5" />
        <line x1="10" y1="50" x2="16" y2="44" />
        <line x1="1.5" y1="30" x2="10" y2="30" />
        <line x1="10" y1="10" x2="16" y2="16" />
      </g>
      <circle cx="30" cy="30" r="16.5" fill="#FFC64D" />
      {/* the one new element: a round-capped diagonal tail crossing the disc's
          lower-right, reading as the Q's descender. Ink, not sun-deep — sun-deep
          sits too close in value to the disc's own yellow to read clearly at
          the small sizes this mark renders at. */}
      <line x1="34.2" y1="40.2" x2="39.2" y2="52.2" stroke="#2E2A24" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="24.5" cy="28" r="1.9" fill="#2E2A24" />
      <circle cx="35.5" cy="28" r="1.9" fill="#2E2A24" />
      <path d="M24.5 34.5 Q30 39 35.5 34.5" fill="none" stroke="#2E2A24" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
