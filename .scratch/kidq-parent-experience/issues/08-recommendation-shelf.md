# 08: Recommendation shelf + Browse-myself (P5)

**What to build:** The "Made for [child]" recommendation shelf a parent reaches either
from the recommendation engine after curation, or directly via "Browse and pick myself"
(bypassing preference-tagging entirely).

**Blocked by:** 04 (Child profile + default confirm)

**Status:** ready-for-agent

- [ ] Shelf renders cards from the external scoring/recommendation engine (integrate
      against it — do not rebuild ranking logic here).
- [ ] Every card defaults to selected; parent can deselect individual cards.
- [ ] One primary action ("Looks good — Add to Library") commits whatever is currently
      selected as a single batch write — not a mandatory per-video tap, not all-or-nothing.
- [ ] Each card shows a trust badge (never a raw numeric score); tapping it optionally
      expands into a plain-language readout of scoring dimensions (pacing, language,
      content, visual, audio) — opt-in.
- [ ] Reachable both from the recommendation engine's normal output and directly from
      "Browse and pick myself" on P2-confirm (ticket 04), skipping preference-tagging.
- [ ] Back navigation returns to P2-confirm.
