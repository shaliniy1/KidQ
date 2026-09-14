# 09: Watched-log ingestion + session-complete notification + inbox store (P8a)

**What to build:** Ingestion of the factual watched-content log and session outcome from
the child device, a new in-app notification inbox store, and the session-complete
notification screen that reads from it.

**Blocked by:** 07 (Start a Session)

**Status:** ready-for-agent

- [ ] Session/watched-log ingestion endpoint receives, per session: duration, titles +
      durations watched, and outcome (completed / skipped / exited) from the child device
      after each session.
- [ ] In-app inbox store: per-account, holds notification payloads with read/unread state.
      No web push, no email — in-app inbox only.
- [ ] On session end (wind-down or early exit), a notification is written to the inbox:
      duration, what was watched, how it ended, and — when the session's Session Assembly
      output (ticket 07) had `usedFallback: true` — a factual disclosure line (e.g. "A
      couple of videos today came from a neighboring age range — content was a little thin
      in [age band] this week").
- [ ] P8a renders read-only from the inbox payload; copy stays neutral and factual, no
      behavioral inference.
- [ ] Inbox is surfaced on next app open (not real-time push).
