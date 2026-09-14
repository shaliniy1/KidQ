# 13: Settings (P7)

**What to build:** The rarely-changed-defaults screen — autoplay, break type default,
sensory mode, and the daily schedule soft-warning behavior — plus an entry point into the
Hub for curation changes.

**Blocked by:** 05 (Customize Hub), 07 (Start a Session)

**Status:** ready-for-agent

- [ ] Autoplay toggle (on/off, default on).
- [ ] Break type default toggle (Movement / Quiet-calm / Let KidQ alternate, default
      Alternate) — same field the Hub's Screen-time block edits; changing it in either
      place updates the one shared value (single source of truth, no divergence).
- [ ] Sensory-friendly mode toggle (on/off, default off).
- [ ] Daily schedule: on/off + time-range picker. Phase-1 behavior is **reminder-only,
      soft warning**: when a session starts (ticket 07) outside the saved range, show a
      non-blocking note rendered in **terracotta** (`--kq-terracotta` — never mango) — no
      gating, no extra tap required to proceed.
- [ ] "Content & curation preferences" row navigates to the Hub (ticket 05); the Hub's
      finish button shows "Save & back" when entered from here (per ticket 05's
      context-adaptive label).
