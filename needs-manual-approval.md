# Needs Manual Approval — resolved 2026-09-15

Issues found during the T01-T15 review that were not auto-fixed at review time because
they were ambiguous, a product/design judgment call, out of a ticket's scope, or in
conflict with the spec in a way that wasn't clear-cut. All 5 items below were walked
through with the user one at a time and a decision recorded for each; this file now
records both the original flag and the resulting decision/action.

---

## T04 — Child profile + default confirm

**Flagged:** Ticket acceptance criterion 4 says P2-confirm should render "with age-derived
defaults pulled from the Age-band default config (ticket 01) — not hardcoded." The shipped
screen (`web/src/app/onboarding/confirm/page.tsx`) shows only the spec-exact static copy
("We've set up [Child]'s KidQ using just their age...") and never calls
`getAgeBandDefaults()` or displays any Development-Goal/content-mix value.

**Why not auto-fixed:** Spec Section 1 Block C and Section 11 #14 explicitly say Development
Goal is "never shown to parent" and this is "reconfirmed, unchanged." Literally satisfying
AC4 by rendering age-derived Development-Goal defaults on this screen would violate that
explicit spec decision — a spec-vs-ticket-text conflict, not a clear-cut bug.

**Decision:** Correct the ticket's AC4 wording to match the spec's copy-only intent. No
code change.

**Resolution:** Updated
`.scratch/kidq-parent-experience/issues/04-child-profile-default-confirm.md` AC4 to
describe the spec-exact static copy as the full extent of what P2-confirm shows, with a
note explaining the original wording conflicted with the hidden-Development-Goal
requirement. No code changed.

---

## T08 — Recommendation shelf + Browse-myself

**Flagged:** `getRecommendations`/`postAddToLibrary`
(`api/src/controllers/recommendations.controller.ts`) apply the child's saved
`choose_categories` restriction (if one exists) to both the normal recommendation-engine
path AND the "Browse and pick myself" path — there's no separate unfiltered endpoint for
browse-myself.

**Why not auto-fixed:** Spec Section 11 #16.1 says Browse-myself "skips preference-tagging...
the recommendation engine altogether," which could mean either (a) it never applies the
recommendation *ranking* engine (true today), or (b) it should also ignore any already-saved
category restriction (not true today). Practically low-impact: via the ticket's documented
entry point (P2-confirm, before any Hub visit), curation settings default to "surprise_us"
(no restriction), so this likely isn't reachable in the shipped flow today.

**Decision:** Leave as-is. Not reachable in the shipped flow today; revisit only if
Browse-myself ever gets a second entry point post-Hub-visit.

**Resolution:** No code change. Documented here as accepted, not a live bug.

---

## T10 — Handoff tray + thumbs feedback + per-child exclude

**Flagged:** `api/src/controllers/feedback.controller.ts` (`postFeedback`) accepts any
string as `contentId` with no check that it exists in the content catalog or was ever
actually watched/shown to that account's child before accepting a 👍/👎 for it.

**Why not auto-fixed:** Not a security/cross-account issue — feedback is correctly scoped to
`req.identity!.uid`, so a parent can only pollute their own account's feedback data. Not
stated anywhere in T10's acceptance criteria.

**Decision:** Leave as-is. Low severity, self-inflicted at worst, out of T10's stated scope.

**Resolution:** No code change. Documented here as accepted, not a live bug.

---

## T11 — My Videos + Add-a-Video + approval notifications

**Flagged:** `fetchYouTubeMetadata` (`api/src/services/youtube.ts`) never extracts or returns
a content category — every parent-added video was stored with `category: null`. Ticket AC1
wanted category, but the config file it points to for the fetch contract doesn't list
category at all, and YouTube's own `categoryId` taxonomy doesn't map to KidQ's category
vocabulary without inventing an undocumented mapping.

**Decision:** Add a category picker to the Add-a-Video review step (P9a) — parent selects
one of KidQ's config-sourced categories, or an explicit "Other" option, before Add Content
is enabled. No auto-detection, no invented YouTube→KidQ mapping. "Other" stored as its own
explicit value, not null. Confirmed against the spec first: the proposed 7-category
taxonomy update (spec Section 10 item 10) is not yet finalized ("analyzed... but not yet
merged"), so the picker uses the current confirmed category list (the existing config
already served by `GET /config/categories`), not a new 7-category set.

**Resolution (2026-09-15):**
- `api/src/controllers/my-videos.controller.ts` (`postAddVideo`): `category` is now
  required and validated against the config category list + the new `OTHER_CATEGORY`
  ("Other") constant, matching the validation style already used in
  `curation-settings.controller.ts`.
- `web/src/services/my-videos.ts` (`addVideo`): now takes a `category` parameter and sends
  it in the request body.
- `web/src/app/videos/add/page.tsx`: fetches the config category list on mount, renders a
  Pill-based category picker (all config categories + "Other") in the review step, and
  disables "Add Content" until one is selected.
- Both `web` and `api` typecheck clean after the change.

---

## T12 — Analytics summary + Admin CSV export

**Flagged (already decided by the original author, surfaced here for visibility, not asking
for a new decision):**
1. "% KidQ-reviewed" (`api/src/services/analytics.ts`) was computed from real library source
   tags, not a literal join against the scoring engine's badge data as AC3 describes — the
   scoring engine has no callable per-video result yet.
2. The CSV export endpoint was labeled "Admin" but ran under ordinary parent `requireAuth`
   and returned only the caller's own data — there's no Admin identity model anywhere in
   this repo to build a real one against.

**Decision:** Remove the CSV export entirely (both admin and parents already have separate,
real analytics dashboards elsewhere — this in-app export duplicated existing functionality
on both sides and never had real Admin access controls). Separately, rename "% KidQ-reviewed"
to something accurate ("% from KidQ's curated sources"), since it's computed from library
source tags, not a scoring-engine result.

**Resolution (2026-09-15):**
- Removed the CSV export entirely: `GET /analytics/export.csv` route
  (`api/src/routes/analytics.routes.ts`), `getAnalyticsCsvExport` controller function
  (`api/src/controllers/analytics.controller.ts`), `buildCsvExport` service function
  (`api/src/services/analytics.ts`), and the "Admin: download CSV export" button +
  `downloadCsvExport` client function (`web/src/app/analytics/page.tsx`).
- Renamed the field `percentKidqReviewed` → `percentFromKidqCuratedSources` end-to-end
  (`api/src/types/analytics.ts`, `web/src/types/analytics.ts`,
  `api/src/services/analytics.ts`) and updated its doc comment to describe what it actually
  measures (curated-source mix, not a scoring-engine pass/fail join).
- Updated the displayed copy in `web/src/app/analytics/page.tsx` from "…was KidQ-reviewed"
  to "…came from KidQ's curated sources."
- Both `web` and `api` typecheck clean after the change.
- INTEGRATION_NOTES.md #8 (CSV export's missing Admin auth model) is now obsolete since the
  endpoint no longer exists — see the note added to that entry. #9 (the "% KidQ-reviewed"
  proxy) updated to reflect the rename.
