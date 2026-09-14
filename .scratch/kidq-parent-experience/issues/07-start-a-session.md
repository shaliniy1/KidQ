# 07: Start a Session → live handoff (P7a) [core tracer bullet]

**What to build:** The everyday quick-action screen. Parent (optionally) switches child,
picks a duration, optionally sets time-of-day mode, and the session starts live the
moment they confirm — no separate "kid taps start" step. This is the ticket that stands
up the Session Assembly / Timing API.

**Blocked by:** 05 (Customize Hub)

**Status:** ready-for-agent

- [ ] If more than one child profile exists, P7a opens on a child-switcher first (nickname
      + mascot color per child); selecting a child reveals that child's own duration
      picker. Each child's last-used duration is remembered independently, never shared.
- [ ] Duration picker offers presets only: `10/15/30/45/60/90` min — no custom duration,
      no snapping logic. A tight, invisible backend tolerance lets the last video in a
      slot finish naturally (never cut short).
- [ ] Mic option reuses on-device STT from ticket 06, but only needs a small **client-side**
      number/unit parser ("thirty minutes" → 30) — not routed through the full curation
      NLU API.
- [ ] Time-of-day mode chips `[Auto][Morning][Daytime][Bedtime]`, default Auto, remembered
      until changed. Client sends only the selected mode, never a device timestamp. In
      Auto mode, the Time-band determination service resolves the band **server-side**
      from the server's clock. Layer 1 only: band drives opener/wind-down copy selection,
      not video selection.
- [ ] Session Assembly / Timing API: given a child's duration + break interval/type +
      curation filters, returns the slot-by-slot video queue — greedy-fills each slot from
      the ranked list (consuming the external scoring/recommendation engine's output),
      never cuts a video short, rotates categories in Surprise-us mode (no same category
      twice in a row), leans calm on the final slot when a calming regulation goal is
      active, and restricts to chosen categories in "Let me choose categories" mode.
- [ ] Thin-pool bounded fallback: if a slot's age-band pool is too thin, the engine may
      pull from the immediately adjacent age band only, from the same admin-approved
      catalog — never wider. The API output includes a **used-fallback flag + which
      category** for later disclosure (consumed by ticket 09).
- [ ] Confirming a duration starts the session live immediately (existing Child Player
      screen) — the child never sees a duration control.
- [ ] Changing duration is available any time, not restricted to once/day; P7a is reusable
      any number of times per day.
- [ ] "Change content preferences" link navigates to the Hub (ticket 05).
