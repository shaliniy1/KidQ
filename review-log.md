# Review Log — Parent Experience Tickets T01-T15

Reviewed against: `KidQ_Parent_Experience_Spec_6.md`, `KidQ_Design_Reference.pdf` /
`kidq-design-tokens.css`, `INTEGRATION_NOTES.md`, and each ticket's own acceptance
criteria in `.scratch/kidq-parent-experience/issues/`.

Format per entry: Ticket | Commit | Reviewer | Verdict | Issues found

---

## T01 — App shell, design tokens & config source-of-truth
- **Commit:** f576fd5
- **Reviewer:** codex
- **Verdict:** PASS
- **Issues:**
  - JUDGMENT CALL — `api/src/controllers/parent-config.controller.ts:9-10` returns the raw
    `error.message` (e.g. an `ENOENT` path) to the client on failure. Minor info-leak, not an
    acceptance-criteria violation; low severity since it's a local dev config read. Left as-is.

## T02 — Login & first-time/returning routing (P0)
- **Commit:** 587fa6f
- **Reviewer:** codex
- **Verdict:** PASS
- **Issues:** None. Firebase-unconfigured state fails safe (501, disabled button, no fake-auth
  bypass), server never trusts client-supplied uid/email, account store isolated by Firebase UID.

## T03 — DPDP consent gate (P1)
- **Commit:** 6fa7b4d
- **Reviewer:** codex
- **Verdict:** PASS
- **Issues:**
  - JUDGMENT CALL — `consent/page.tsx:82` back button uses `router.push("/login")` instead of
    `router.back()`, adding a history entry rather than popping one. Meets the acceptance
    criterion (lands on login) but browser-back semantics differ slightly. Not fixed — cosmetic.
  - (Codex also flagged a missing `isDemoMode()` guard, citing a global personal coding-style
    rule — checked the codebase and there is no demo-mode concept anywhere in this project;
    false positive, disregarded.)

## T04 — Child profile + default confirm (P2-mandatory / P2-confirm)
- **Commit:** 55a8651
- **Reviewer:** codex
- **Verdict:** FAIL (2 issues found) → fixed 1, flagged 1 for manual approval
- **Issues:**
  - CLEAR BUG (fixed) — `web/src/app/onboarding/confirm/page.tsx` had no back navigation at
    all, violating AC7 ("P2 screens back to the previous P2 step") and spec Section 11 #17
    (a back arrow on every screen with a logical prior step). Added a "← Back" button to
    `/onboarding/profile`, matching the pattern already used on the profile page.
  - JUDGMENT CALL (not fixed — see needs-manual-approval.md) — AC4 says the confirm screen
    should render "with age-derived defaults pulled from the Age-band default config... not
    hardcoded," but the screen only shows the static spec-exact copy string, no actual
    Development-Goal/content-mix values, and never calls `getAgeBandDefaults()`. Spec Section
    1 Block C and Section 11 #14 explicitly say Development Goal must stay hidden from the
    parent, so literally displaying those defaults would violate the spec. Flagged instead of
    auto-fixed since "fixing" this risks contradicting the spec's own hidden-goal decision.
  - Confirmed known gap (T04 age-band re-derivation, INTEGRATION_NOTES.md #2) is honestly
    disclosed: `ageBandAssignedAt` is stored per child, no fake/half-built re-derivation logic
    exists.
  - Minor style nit (not fixed) — `profile/page.tsx:164` uses `key={index}` for the children
    list; safe in practice since children are only ever appended/removed from the tail via the
    stepper, not reordered, but not idiomatic.

## T05 — Customize Hub + sub-screens, batch save (P2-hub)
- **Commit:** 15210a1
- **Reviewer:** codex
- **Verdict:** PASS
- **Issues:** None. Break-count formula verified correct for all 6 spec table rows; batch-save
  semantics correct (single write on Done/Save & back, no partial writes on back-out); Dev
  Goal never surfaces in the Hub UI.

## T06 — Voice & guided capture shortcuts (P3-voice, P3-guided)
- **Commit:** f028a2a
- **Reviewer:** codex
- **Verdict:** PASS
- **Issues:** None. Only transcript text is ever sent to the backend (no audio upload,
  verified), guided-questions mapping is client-side only with zero network calls. (Codex again
  flagged the inapplicable `isDemoMode()` global rule — disregarded, as in T03/T06.)

## T07 — Start a Session -> live handoff (P7a) [core tracer bullet]
- **Commit:** 20ece5f
- **Reviewer:** codex
- **Verdict:** PASS
- **Issues:** None. Session-assembly greedy fill never cuts a video short, adjacent-band
  fallback pulls from exactly one neighboring band (never wider), used-fallback flag set
  correctly, time-band resolved server-side from server clock (client never sends a
  timestamp), child player never shows a duration control, per-child duration/mode persisted
  independently. Auth + per-child ownership checks verified on session endpoints.

## T08 — Recommendation shelf + Browse-myself (P5)
- **Commit:** ccc49df
- **Reviewer:** sonnet-fallback (Codex CLI unavailable in the subagent's environment this run;
  reviewed manually instead per the fallback instruction)
- **Verdict:** PASS
- **Issues:**
  - JUDGMENT CALL (not fixed — see needs-manual-approval.md) — `getRecommendations` /
    `postAddToLibrary` (`api/src/controllers/recommendations.controller.ts`) use the same
    single endpoint for both the normal recommendation-engine path and "Browse and pick
    myself," and both apply the child's saved category restriction (`choose_categories` mode)
    if one exists. Spec Section 11 #16.1 says Browse-myself "skips preference-tagging... the
    recommendation engine altogether" — ambiguous whether that includes ignoring an
    already-saved category restriction. Verified: in the documented entry point (fresh
    P2-confirm, before any Hub visit), curation settings default to "surprise_us" (no
    restriction), so this is likely unreachable in practice today — flagged, not fixed.
  - Verified independently: batch write only adds the still-selected subset; trust badge is
    honestly labeled with no fabricated per-dimension scores; cards default selected; back
    nav returns to P2-confirm.

## T09 — Watched-log ingestion + session-complete notification + inbox store (P8a)
- **Commit:** a2723ff
- **Reviewer:** sonnet-fallback (Codex again unavailable in the subagent's environment;
  fell back to a manual review)
- **Verdict:** PASS
- **Issues:**
  - Trivial wording nit (not fixed) — the thin-pool disclosure line says "a little thin
    **for** [ageBand]" vs. the spec's example wording "a little thin **in** [ageBand]"
    (`session-log.controller.ts:10`). Spec marks its wording as "e.g." (illustrative, not a
    literal template) and both phrasings are equally neutral/factual — not worth a fix.
  - Verified: fallback disclosure only renders when `usedFallback: true`; ingestion endpoint
    checks child ownership against the authenticated account before writing; inbox is
    per-account, in-app only, no push/email; notification copy has no behavioral-inference
    language anywhere.

## T10 — Handoff tray + thumbs feedback + per-child exclude (P8)
- **Commit:** 28b9b16
- **Reviewer:** codex (subagent hit a transient "policy error" on first attempt, self-retried
  internally and completed with real Codex the second pass)
- **Verdict:** FAIL (2 issues) → fixed 1, flagged 1 for manual approval
- **Issues:**
  - CLEAR BUG (fixed) — `web/src/app/watched/[childId]/page.tsx:77-85` `handleThumb`'s catch
    block silently swallowed a failed feedback POST while leaving the optimistic 👍/👎 state
    in place (inconsistent with `handleRemove`'s correct revert-on-failure pattern just below
    it) — a parent could believe feedback was saved when it wasn't, until next reload. Fixed
    to revert to the prior sentiment (or clear it) on failure, matching `handleRemove`.
  - JUDGMENT CALL (not fixed — see needs-manual-approval.md) — `feedback.controller.ts`
    accepts any string `contentId` with no check that it exists in the catalog or was
    actually watched by that account's child. Not a cross-account issue (feedback is scoped
    to `req.identity!.uid`), just unvalidated data integrity; not stated in T10's acceptance
    criteria, so flagged rather than assumed in-scope.
  - Independently verified AC4 (previously unverifiable from the diff alone, since this
    commit only touches `session.controller.ts`): confirmed `getExcludedContentIds(childId)`
    threads through to `content-catalog.ts`'s `notExcluded()` filter, which is applied on
    both the primary age-band and the adjacent-band-fallback candidate lists. Exclude list is
    genuinely wired into Session Assembly, not just stored and unused.

## T11 — My Videos + Add-a-Video + approval notifications (P9, P9a, P9b)
- **Commit:** 211479f
- **Reviewer:** codex
- **Verdict:** FAIL (1 issue) → flagged for manual approval, not auto-fixed
- **Issues:**
  - JUDGMENT CALL (not fixed — see needs-manual-approval.md) — `fetchYouTubeMetadata`
    (`api/src/services/youtube.ts`) doesn't extract/return a content category, so parent-added
    videos always store `category: null`. AC1 says the fetch should retrieve "title,
    thumbnail, duration, channel, and category," but the config file it's told to build on
    (`config/content-sources.json`, YouTube source's `fetch` list) doesn't list category at
    all, and YouTube's own `categoryId` taxonomy doesn't map to KidQ's category vocabulary
    (Animation/Stories/Science/etc.) without inventing an undocumented mapping. Not auto-fixed
    since a "fix" risks fabricating either a wrong mapping or a meaningless raw YouTube ID in
    a field the rest of the app expects to hold a KidQ category name — `category` is already
    typed nullable end-to-end so nothing crashes on the gap.
  - Verified independently: score never gates Add Content; Private access is instant
    regardless of Public toggle state; `postSimulateAdminDecision` and Remove both validate
    ownership; Remove deletes from storage (not a client-side hide); all 3 library-tag states
    render correctly, including the post-approval transition.

## T12 — Analytics summary + Admin CSV export (P8b)
- **Commit:** 19f3a8c
- **Reviewer:** codex
- **Verdict:** FAIL (2 issues, both pre-existing disclosed trade-offs) → documented, not
  behavior-changed
- **Issues:**
  - JUDGMENT CALL (documented, not fixed) — "% KidQ-reviewed" is computed from real library
    source tags (kidq_recommended / admin_approved / picked_by_parent), not a join against
    the scoring engine's badge data as AC3 literally describes — the scoring engine has no
    callable per-video result yet (same underlying gap as INTEGRATION_NOTES.md #5). The
    commit message already reasoned this is "a defensible, real proxy," and I agree it's a
    legitimate modeling choice, not a fabrication — but it was never added to
    INTEGRATION_NOTES.md despite that doc's own policy of tracking every such stand-in "not
    just mentioned in a commit message." Added as INTEGRATION_NOTES.md #9.
  - JUDGMENT CALL (documented, not fixed) — the CSV export endpoint is labeled "Admin" but is
    gated behind the same `requireAuth` as every parent endpoint and returns only the calling
    account's own data — there's no Admin identity/auth model anywhere in this repo to build
    a real Admin-scoped endpoint against (out of scope for a Parent-Experience-only build).
    Disclosed in the commit message but likewise missing from INTEGRATION_NOTES.md until now
    — added as INTEGRATION_NOTES.md #8.
  - Verified independently: no cross-account/cross-child data leakage (ownership checked via
    `assertChildOwnedBy`); day/week/month filtering uses correct inclusive cutoff comparison,
    no off-by-one; all figures factual, UI reads as a friendly summary not a raw table; only
    the one new phase-1 metric was added, others correctly left out of scope.

## T13 — Settings (P7)
- **Commit:** 4bbd688
- **Reviewer:** codex
- **Verdict:** PASS
- **Issues:** None. Break type is a single shared backend field (Settings and Hub both
  read/write the same CurationSettings value, no drift risk); daily-schedule warning is
  genuinely non-blocking, rendered in terracotta (never mango), requires no extra tap; Hub
  finish-button label correctly defaults to "Save & back" when entered from Settings.

## T14 — Content pool-depth monitor (backend-only)
- **Commit:** 98be96a
- **Reviewer:** codex
- **Verdict:** PASS
- **Issues:** None. Correctly computes the full age-band x category cross-product (60
  combinations verified), threshold is configurable (function param + CLI arg, sensible
  default), no UI/parent-facing surface, not wired into the session-start request path (a
  manual/out-of-band script only).

## T15 — Sync / device-status reporting (backend-only)
- **Commit:** eb6f603
- **Reviewer:** codex
- **Verdict:** PASS
- **Issues:** None. `postStartSession` creates a pending sync record per child
  (`markQueued`), a separate `postSyncAck` endpoint transitions it to acknowledged (with
  stale-ack rejection if superseded by a newer queue), record is scoped per-child via
  ownership checks, no new UI. (Codex flagged that `postSyncAck` requires parent auth despite
  a comment saying "called by the child device" — checked this against the spec: phase 1 has
  no separate child-device identity anywhere in this build; the "child device" is the same
  physical browser/session the parent hands over per spec Section 4, so parent-scoped auth on
  this endpoint is correct, not a gap. Not flagged further.)

---

## Summary

All 15 tickets reviewed. See needs-manual-approval.md for items flagged rather than
auto-fixed.
