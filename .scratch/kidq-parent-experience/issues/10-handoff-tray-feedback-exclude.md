# 10: Handoff tray + 👍/👎 + per-child exclude (P8)

**What to build:** The factual watched-content log screen with thumbs feedback, and a
per-child "stop recommending this" action that actually affects future sessions.

**Blocked by:** 09 (Watched-log ingestion + session-complete notification + inbox store)

**Status:** ready-for-agent

- [ ] P8 renders the same watched-content log ticket 09 ingests, with a 👍/👎 tap per
      video (optimistic UI, backend write follows).
- [ ] 👍/👎 feedback store persists the signal for future ranking use (consumed by the
      external scoring engine, not rebuilt here).
- [ ] "Remove from [Child]'s videos" action, available from both P8 and My Videos
      (ticket 11), writes to a per-child video-exclude store — per-child, not per-family;
      excluding for one sibling does not affect another.
- [ ] Session Assembly (ticket 07) checks the per-child exclude list before filling any
      slot — verify by excluding a video and confirming it no longer appears in that
      child's next assembled session.
