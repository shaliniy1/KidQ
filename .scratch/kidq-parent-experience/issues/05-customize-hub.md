# 05: Customize Hub + sub-screens, batch save (P2-hub)

**What to build:** The Hub a parent reaches from "Customize," Settings, or Start a
Session — Interests, Content mix, Regulation goal, and Screen time & breaks — with all
edits held locally and written to the backend in a single batch on exit, plus an escape
hatch back to defaults.

**Blocked by:** 04 (Child profile + default confirm)

**Status:** ready-for-agent

- [ ] Hub renders four rows (Interests / Content mix / Regulation goal / Screen time) with
      live-updating summary text as the parent taps; nothing persists until the parent
      taps Done/Save & back.
- [ ] Interests: multi-select chips sourced from the config category list (ticket 01),
      default = none selected.
- [ ] Content mix: "Surprise us" (default) vs "Let me choose categories" with the
      config-sourced category list.
- [ ] Regulation goal: the 6 parent-facing labels mapped to their engine tags (Calm /
      Emotional Regulation / Focus / Movement / Relaxation / Social Regulation).
- [ ] Screen time & breaks: duration picker `10/15/30/45/60/90` min, break-interval picker
      `10/15/20` min (default 15), break type (Movement / Quiet-calm / Let KidQ alternate,
      default Alternate). Live break-count preview computed client-side from
      `total breaks = duration ÷ interval, rounded` — no round-trip needed to preview it.
- [ ] On Done/Save & back: one batch write to the Curation Settings API (interests,
      content mix, regulation goals, duration default, break type, break interval).
      Backing out mid-edit discards local changes — nothing partial is ever saved.
- [ ] "Never mind — use KidQ's recommendation instead" link resets in-progress
      customization to defaults and goes straight to P7a.
- [ ] Standard back arrow present on the Hub and every sub-screen.
- [ ] Hub's finish button label adapts to entry context: "Done — start using KidQ" when
      reached during first-time onboarding, "Save & back" when reached from Settings or
      Start a Session (ticket 13/07 add those entry points; this ticket implements the
      label-switching behavior itself).
- [ ] Development Goal (Block C) is computed from age band via config and never shown to
      the parent on any Hub screen.
