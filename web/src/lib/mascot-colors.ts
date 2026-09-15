/**
 * The 5 brand accent colors used to auto-cycle each child's mascot/avatar
 * color (spec Section 1). Single source of truth for the cycling order —
 * every screen that assigns or renders a mascot color (P2 Screen 1, the
 * P7a/P8b child-switcher) must read from this list, not redeclare it.
 *
 * Note: the spec names "lavender" as one of the 5 brand accents, but
 * kidq-design-tokens.css defines no solid brand-lavender token — only a
 * pastel card background (--kq-card-lavender, for category card fills) and
 * the deeper --kq-dusk-lavender (night/wind-down palette). We use
 * --kq-dusk-lavender here since it's a saturated tone suitable for a solid
 * avatar fill, matching how the other 4 accents are used; the pastel is
 * reserved for its documented card-background purpose. Flagged for design
 * confirmation — swap this mapping in one place if a dedicated
 * brand-lavender token is added later.
 */
export const MASCOT_COLORS = [
  { id: "teal", token: "--kq-teal" },
  { id: "saffron", token: "--kq-saffron" },
  { id: "terracotta", token: "--kq-terracotta" },
  { id: "mango", token: "--kq-mango" },
  { id: "lavender", token: "--kq-dusk-lavender" },
] as const;

export type MascotColorId = (typeof MASCOT_COLORS)[number]["id"];

/** Cycles through MASCOT_COLORS in child-add order (index 0, 1, 2, ...). */
export function mascotColorForIndex(index: number): MascotColorId {
  return MASCOT_COLORS[index % MASCOT_COLORS.length].id;
}
