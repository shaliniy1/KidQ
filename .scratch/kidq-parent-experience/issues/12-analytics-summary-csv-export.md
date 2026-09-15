# 12: Analytics summary + Admin CSV export (P8b)

**What to build:** A friendly, easy-to-read parent summary of watch activity (not a raw
dashboard), plus a CSV/Excel export of the same aggregated data for Admin.

**Blocked by:** 09 (Watched-log ingestion + session-complete notification + inbox store)

**Status:** ready-for-agent

- [ ] For a multi-child household, P8b opens with the same child-switcher used on P7a.
- [ ] Analytics aggregation API rolls up the watched-content log into: time spent per
      content category (day/week/month), total screen time (session/day/week/month), and
      completion vs. early-exit rate over time. Day/Week/Month pill selector re-queries
      the backend per range.
- [ ] Adds exactly one new metric for phase 1: **Content-source breakdown**
      (KidQ-recommended vs. Parent-added vs. Admin-approved-from-submission), joined with
      the external scoring engine's badge data to produce a "% KidQ-reviewed" line. Other
      proposed metrics (wind-down completion rate, regulation-goal coverage, most-repeated
      titles) are **not built** in this ticket.
- [ ] P8b's UI reads as a friendly summary — plain language, simple visuals — not a raw
      data-table dashboard.
- [ ] All figures stay factual (counts, durations, percentages) — none infer attention,
      mood, or preference.
- [ ] A separate Admin-facing CSV/Excel export endpoint on the Analytics aggregation API
      returns the same aggregated data for offline analysis — no Admin dashboard or
      third-party BI tool integration in this ticket.
