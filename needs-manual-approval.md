# Needs Manual Approval

Issues found during the T01-T15 review that were NOT auto-fixed because they're ambiguous,
a product/design judgment call, out of a ticket's scope, or conflict with the spec in a way
that isn't clear-cut. Each entry: ticket, what was flagged, why it wasn't auto-fixed.

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
explicit spec decision. This looks like loose ticket wording rather than a real product
requirement, but it's a spec-vs-ticket conflict, not a clear-cut bug — needs a call on
whether AC4 means something else (e.g. just wiring the *content-mix* default, which isn't
hidden) or whether the ticket text should simply be corrected to match the spec's copy-only
intent.

**Recommendation:** Treat the existing static copy as sufficient and correct the ticket's
AC4 wording, since it's the copy that's spec-mandated verbatim and Development Goal must
stay hidden.

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
category restriction (not true today). The ticket's own AC5 only requires skipping
preference-tagging to *reach* P5, not ignoring settings once there — genuinely ambiguous.
Practically low-impact: via the ticket's documented entry point (P2-confirm, before any Hub
visit), curation settings default to "surprise_us" (no restriction), so this likely isn't
reachable in the shipped flow today. Worth a product call if Browse-myself ever gets a second
entry point post-Hub-visit.

---

## T10 — Handoff tray + thumbs feedback + per-child exclude

**Flagged:** `api/src/controllers/feedback.controller.ts` (`postFeedback`) accepts any
string as `contentId` with no check that it exists in the content catalog or was ever
actually watched/shown to that account's child before accepting a 👍/👎 for it.

**Why not auto-fixed:** Not a security/cross-account issue — feedback is correctly scoped to
`req.identity!.uid`, so a parent can only pollute their own account's feedback data. Not
stated anywhere in T10's acceptance criteria, and "should feedback require prior watch, or
also apply to P5/My Videos browsing before a video is ever watched?" is a product decision
this ticket doesn't settle. Low severity (data-integrity nit, not a vulnerability) — flagged
for a call on whether to add a watched-log/catalog existence check.

---

## T11 — My Videos + Add-a-Video + approval notifications

**Flagged:** `fetchYouTubeMetadata` (`api/src/services/youtube.ts`) never extracts or returns
a content category — every parent-added video is stored with `category: null`.

**Why not auto-fixed:** Ticket AC1 says the fetch should retrieve "title, thumbnail,
duration, channel, and category," matching spec Section 7's "no manual entry" promise — but
the very config file the ticket points to for the fetch-field contract
(`config/content-sources.json`, `sources[youtube].fetch`) does **not** list category at all.
Separately, YouTube's own `snippet.categoryId` taxonomy (numeric IDs like "27" = Education)
doesn't correspond to KidQ's own category vocabulary (Animation, Stories, Storybooks, Crafts,
Science, etc.) — populating it would require inventing an unspecified ID→category mapping,
the same kind of fabrication the codebase explicitly avoided elsewhere (see
INTEGRATION_NOTES.md #4's Development-Goal rotation stand-in, which deliberately didn't
invent an unspecified mapping either). `category` is nullable end-to-end so nothing breaks
today; it just never gets populated for parent-added videos.

**Recommendation:** Either (a) confirm category should be left for the parent (or a future
admin pass) to assign manually for privately-added videos, and update AC1's wording to match,
or (b) provide an explicit YouTube-category→KidQ-category mapping table for a follow-up fix.

---

## T12 — Analytics summary + Admin CSV export

**Flagged (already decided by the original author, surfaced here for visibility, not asking
for a new decision):**
1. "% KidQ-reviewed" (`api/src/services/analytics.ts`) is computed from real library source
   tags, not a literal join against the scoring engine's badge data as AC3 describes — the
   scoring engine has no callable per-video result yet. The commit message calls this "a
   defensible, real proxy." I agree it's reasonable, not a fabrication.
2. The CSV export endpoint is labeled "Admin" but runs under ordinary parent `requireAuth`
   and returns only the caller's own data — there's no Admin identity model anywhere in this
   repo to build a real one against.

**Why not auto-fixed:** Both require product/architecture decisions (a scoring-engine join
that doesn't exist yet; an Admin auth model that doesn't exist anywhere in this codebase) —
building either from scratch is well outside T12's scope. Action taken instead: added both as
proper INTEGRATION_NOTES.md entries (#8, #9) since they were previously only mentioned in the
commit message, not tracked in the doc whose own stated policy is to catch exactly this kind
of stand-in.

**Recommendation:** No action needed unless/until the scoring engine or an Admin auth model
becomes available — then swap per the INTEGRATION_NOTES.md entries' "to swap in" notes.
