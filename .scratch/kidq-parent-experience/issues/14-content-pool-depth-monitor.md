# 14: Content pool-depth monitor (backend-only)

**What to build:** A backend monitor that tracks how many admin-approved, safety-tagged
videos exist per age-band × category combination, and flags to the content/admin team
before a combination gets thin enough to trigger the Session Assembly fallback rule.

**Blocked by:** 01 (App shell, design tokens & config source-of-truth)

**Status:** ready-for-agent

- [ ] Monitor computes catalog depth per age-band × category combination from the
      approved-content catalog.
- [ ] A configurable low-depth threshold triggers a flag (log/alert/report — no parent- or
      child-facing screen) to the content/admin team.
- [ ] No UI changes; this exists purely so the Session 2 Rule 6 adjacent-age-band fallback
      (consumed by ticket 07) stays rare in practice, not to gate anything at request time.
