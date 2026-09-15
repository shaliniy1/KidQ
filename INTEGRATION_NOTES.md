# Integration Notes

A running list of every placeholder, stub, or "teammate-owned / not-yet-real" piece this
build has stood in for, across all tickets in `.scratch/kidq-parent-experience/issues/`.
Updated every time a new one is introduced — not just mentioned in a commit message.

Each entry: **ticket**, **file/module**, **what's faked and why**, **the exact contract
the real implementation needs to satisfy**, and **what swapping it in requires**.

---

## 1. Firebase Auth — env-var placeholders, not a real project

- **Ticket:** T02 (Login & routing)
- **File/module:** `api/src/services/firebase-admin.ts` (server-side token verification),
  `web/src/lib/firebase.ts` (client SDK init). Config surface:
  `api/.env.example` (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`),
  `web/.env.example` (`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`).
- **What's faked and why:** All Firebase config is unset (empty placeholders). Per your
  explicit choice (T02), the app was built against these env vars rather than pausing for
  a real project. There is **no fake-auth bypass** — with the vars unset, every
  auth-gated endpoint returns `501 "Firebase Admin is not configured"` (see
  `FirebaseNotConfiguredError`), and the login screen shows a disabled button with the
  same message. Real Google Sign-In and the resulting onboarding-routing decision have
  never run end-to-end.
- **Real contract:** `verifyIdToken(idToken: string): Promise<{ uid: string; email: string
  | null }>` (`api/src/services/firebase-admin.ts`) must verify a Firebase ID token issued
  by Google Sign-In and return the verified identity — this shape is already final: every
  downstream consumer (`requireAuth` middleware, all `req.identity!.uid` reads) only ever
  needs `uid`/`email`, nothing else. Client-side, `firebaseAuth`/`googleAuthProvider`
  (`web/src/lib/firebase.ts`) must be a real initialized Firebase App's `Auth` instance and
  `GoogleAuthProvider`.
- **To swap in:** Create a Firebase project, enable Google as a sign-in provider, generate
  a service-account key (Console → Project Settings → Service Accounts) for the 3 server
  vars, and copy the web app's SDK config (Console → Project Settings → General → Your
  apps) for the 4 client vars. Drop both sets into `api/.env`/`web/.env.local`. No code
  changes needed — the moment all 7 vars are real, `isFirebaseConfigured`/
  `getFirebaseApp()` pick them up automatically.

## 2. Child age band — no birthdate captured, so no real re-derivation

- **Ticket:** T04 (Child profile + default confirm)
- **File/module:** `api/src/types/child-profile.ts` (`ChildProfile.ageBandAssignedAt`).
- **What's faked and why:** Spec Section 11 #10 promises silent age-band re-derivation
  when a child's actual age crosses a band boundary, but Section 1 (Block "mandatory
  fields") only ever captures a coarse band (0-2/2-3/3-4/4-5/5-6), never a birthdate —
  there is no continuous signal to detect a crossing from. Every child profile records
  `ageBandAssignedAt` (an ISO timestamp) so *something* exists to compute from later, but
  no re-derivation logic runs against it today; a band picked at onboarding stays fixed
  forever unless a parent manually edits it (no edit UI exists yet either).
- **Real contract:** Not yet defined — this is a product decision, not an interface gap.
  Whatever's decided needs to resolve to: given a `ChildProfile`, decide whether its
  `ageBand` should change, silently, with no parent prompt (per spec). That decision could
  be birthdate-based (`ageBand = f(birthdate, today)`) or a coarser heuristic
  (`ageBand` + `ageBandAssignedAt` + a per-band "typical duration" table).
- **To swap in:** Needs a product call first (capture an actual birthdate at onboarding,
  alongside or instead of the band picker; or define an explicit estimation policy — e.g.
  assume mid-band, re-check after N months). Once decided: add the new field to
  `ChildProfile`/the P2 Screen 1 form, then add a background job/check that updates
  `ageBand` and refreshes `ageBandAssignedAt` when it changes.

## 3. Mascot "lavender" — no real design token

- **Ticket:** T01 (App shell, design tokens & config)
- **File/module:** `web/src/lib/mascot-colors.ts` (`MASCOT_COLORS` — the `lavender` entry).
- **What's faked and why:** The spec names 5 brand accents for mascot colors including
  "lavender", but `kidq-design-tokens.css` only defines solid brand colors for
  teal/saffron/terracotta/mango. The only lavender-family tokens are
  `--kq-card-lavender` (a pastel, documented for category-card backgrounds — not a solid
  fill) and `--kq-dusk-lavender` (a deeper, saturated tone from the night/wind-down
  palette). `mascot-colors.ts` currently maps mascot "lavender" to `--kq-dusk-lavender` as
  a reasonable stand-in, since it's the more avatar-appropriate (solid-fill-suitable) of
  the two — but this was never confirmed by design.
- **Real contract:** `MASCOT_COLORS` needs 5 entries, each `{ id: MascotColorId; token:
  string }`, where `token` is a CSS custom property name defined in
  `kidq-design-tokens.css` and intended for solid fills (avatars, active pill/toggle
  states) — not a pastel meant for large background areas.
- **To swap in:** Get design sign-off on either (a) a new solid `--kq-lavender` brand
  token added to `kidq-design-tokens.css`, or (b) explicit confirmation that
  `--kq-dusk-lavender` is the intended value. Then update the one `token` field for the
  `lavender` entry in `web/src/lib/mascot-colors.ts` — every consumer (`Avatar`, the P2
  mascot picker, the future child-switcher) reads through that single source, so nothing
  else needs to change.

## 4. Session Assembly's candidate source — catalog-read adapter over seed data, not the real scoring/recommendation engine

- **Ticket:** T07 (Start a Session — Session Assembly / Timing API)
- **File/module:** `api/src/services/content-catalog.ts` (the adapter);
  `api/data/content.jsonl` (seed data — generated by `api/scripts/seed-content-catalog.ts`).
- **What's faked and why:** Session Assembly needs a ranked list of admin-approved,
  age/category-matched candidate videos to greedy-fill session slots from. The real
  source for that — the content scoring/recommendation engine (spec Table B #8: relevance
  + KidQ Score + expert review + parent preference ranking) — is explicitly teammate-owned
  and "in progress," and today exposes no callable "get ranked candidates" interface
  anywhere in this repo (only a write-only content-discovery pipeline exists). Per your
  explicit choice, built a thin, honestly-scoped adapter instead: it reads the same
  admin-approved catalog store the discovery pipeline already writes to
  (`content.jsonl`), filters to `content_status === "APPROVED"` + age-band match, and
  orders results by catalog insertion order — **not** real relevance/score/preference
  ranking. 20 seed videos across age bands and categories were added
  (`api/scripts/seed-content-catalog.ts`) so Session Assembly's actual algorithm (greedy
  fill, category rotation, calm-final-slot, adjacent-band fallback) could be proven working
  end-to-end, not just typechecked against empty data.
- **Real contract:** A function `getCandidates(query: { ageBand: AgeBand; categories:
  string[] | null; excludeContentIds: string[] }): Promise<{ candidates:
  KidqContentRecord[]; usedFallback: boolean; fallbackCategory: string | null }>` (exact
  current signature — `api/src/services/content-catalog.ts`) returning **already-ranked**
  (best-first) approved content matching the age band (or the immediately adjacent band,
  flagged via `usedFallback`/`fallbackCategory`, if the primary band came back empty), and,
  when `categories` is non-null, restricted to those categories. Session Assembly
  (`api/src/services/session-assembly.ts`) only ever consumes the ordering it's given — it
  does not re-rank, only re-sorts locally for rotation/calm-preference within what it's handed.
- **To swap in:** Replace `content-catalog.ts`'s internal implementation (the JSONL
  read + filter + insertion-order sort) with a call into the real scoring/recommendation
  engine's output, keeping the same `getCandidates` signature so Session Assembly itself
  needs no changes. The seed data (`api/data/content.jsonl`) can stay for local dev/demo
  purposes or be cleared once the real engine has real catalog data to serve.
- **Related internal-modeling stand-ins in this same ticket (not spec-mandated, my own
  documented calls — flagging since a teammate picking up Session Assembly should know
  these exist):**
  - Spec Section 2 Rule 4 ("rotate across the 2-3 categories implied by that age's default
    Development Goals") has no Development-Goal→Content-Category mapping table anywhere in
    the spec. Implemented as "rotate across whatever categories are present in the matched
    candidate pool, no repeat in a row" instead — satisfies the checkable part of the rule
    without inventing an unspecified mapping. See the comment above `assembleSession` in
    `session-assembly.ts`.
  - Spec Rule 5 ("leans calm on purpose") names no specific calming-category list either;
    `CALMING_CATEGORIES = new Set(["Storybooks", "Yoga", "Music/Rhymes"])` in
    `session-assembly.ts` is a reasonable, documented stand-in.
  - "Never repeat a video within one session" is a baseline default this build added (not
    spec-stated) for obvious correctness — but it's set to yield to actually filling a slot:
    if the thin seed catalog exhausts the no-repeat pool before every slot is filled, the
    algorithm falls back to allowing repeats rather than ship an empty break slot (found via
    direct testing of the algorithm against the seed data, fixed before commit).

## 5. Recommendation shelf's trust badge — no real scoring dimensions

- **Ticket:** T08 (Recommendation shelf + Browse-myself, P5)
- **File/module:** `api/src/controllers/recommendations.controller.ts` (`toCard`'s
  `trustBadge` field).
- **What's faked and why:** Every card on the P5 shelf shows a trust badge, and spec
  Section 11 #19 says tapping it optionally expands into a plain-language readout of 5
  scoring dimensions (pacing, language, content, visual, audio). That data comes from the
  same content scoring engine Session Assembly is waiting on (see #4 above) — not yet
  callable. Rather than fabricate plausible-looking per-dimension scores, every card gets
  a plain **"Reviewed"** badge (true of the underlying data — these are genuinely
  `content_status === "APPROVED"` catalog records) and the frontend's tap-to-expand states
  explicitly that per-dimension detail isn't available yet, instead of inventing numbers.
- **Real contract:** `toCard(record)` needs the scoring engine's assessment result per
  content item — at minimum a badge label and, for the expandable detail, 5 named
  dimension results (pacing/language/content/visual/audio), each with at least a
  pass/fail/concern-level and a short plain-language note (mirroring the
  `CriterionAssessment { status, evidence }` shape already used for `filter_out`/
  `filter_in` on `KidqContentRecord` — reusing that shape rather than inventing a new one
  is the natural fit if the real engine doesn't dictate otherwise).
- **To swap in:** Once the scoring engine exposes a callable "assess this content item"
  result, replace `toCard`'s hardcoded `trustBadge: "Reviewed"` with the real badge label,
  and add the 5-dimension detail to `RecommendationCard` (`api/src/types/recommendation.ts`)
  for the frontend's expand-on-tap to render. The same swap point covers P9a's trust badge
  (ticket 11) and the P8 session-log badge (ticket 10) once those are built — all three
  consume the same engine output, so wiring it once here sets the pattern.
- **Update (T11):** P9a's `POST /videos/detect` (`api/src/controllers/my-videos.controller.ts`)
  now uses this exact same placeholder — `trustBadge: "Reviewed"`, no fabricated
  per-dimension scores — confirming the "same swap point" prediction above.

## 6. My Videos' Public-submission decision — Admin review queue is stubbed, not real

- **Ticket:** T11 (My Videos + Add-a-Video + approval notifications, P9/P9a/P9b)
- **File/module:** `api/src/controllers/my-videos.controller.ts`
  (`postSimulateAdminDecision`); route `POST /library/:entryId/simulate-admin-decision`.
- **What's faked and why:** The real Admin review queue (spec Table B #11) is owned by
  the Admin flow, and ticket 11 itself instructs building "against a stub/mocked queue
  until the contract is available" — so this is a deliberate, ticket-sanctioned stub, not
  an undisclosed gap. A parent-facing "Also suggest this to other families" toggle sets a
  library entry's `submissionStatus` to `"pending"`; a separate, parent-triggered endpoint
  simulates the Admin decision (approve/reject) so the resulting P9b/P9b-reject inbox
  notification path (ticket 09's inbox store) can be verified end-to-end without a real
  Admin flow existing yet. In the real product this decision would arrive as a webhook/
  callback *from* the Admin flow, never something the parent's own client triggers.
- **Real contract:** Whatever hand-off contract the Admin flow settles on needs to reach
  this backend as an inbound call carrying at minimum `{ libraryEntryId (or contentId),
  decision: "approved" | "rejected" }`, authenticated as the Admin flow (not as the
  submitting parent) — the current stub abuses `requireAuth` (the parent's own token) only
  because nothing else exists yet to call it.
- **To swap in:** Once the Admin flow's hand-off contract is confirmed (spec Section 10
  item 7 territory — confirm this is being built as a separate component), add a new
  endpoint (or webhook receiver) that authenticates the Admin flow itself, look up the
  library entry by whatever identifier the contract uses, and call the same
  `setSubmissionStatus` + `addNotification("submission_approved" | "submission_rejected",
  ...)` pair this stub already calls. Delete `postSimulateAdminDecision`; nothing on the
  frontend needs to change since it doesn't call that endpoint directly today (it's a
  manual verification aid).

## 7. YouTube Data API — env-var placeholder, not a real key

- **Ticket:** T11 (My Videos + Add-a-Video, P9a)
- **File/module:** `api/src/services/youtube.ts`; config surface: `api/.env.example`
  (`YOUTUBE_DATA_API_KEY`).
- **What's faked and why:** Same pattern as Firebase (#1 above) — the integration itself
  is real (`fetchYouTubeMetadata` makes an actual call to
  `googleapis.com/youtube/v3/videos`), but `YOUTUBE_DATA_API_KEY` is unset. Unlike the
  scoring-engine gaps above, nothing here is faked with placeholder data: with the key
  missing, `POST /videos/detect` returns `501 "YouTube Data API is not configured"` —
  never fabricated video metadata. URL parsing (`extractYouTubeVideoId`, all 3 common
  YouTube URL shapes) and ISO 8601 duration parsing were verified directly and work
  correctly independent of the API key.
- **Real contract:** `fetchYouTubeMetadata(videoId: string): Promise<{ videoId, title,
  channel, thumbnailUrl, durationSeconds }>` — already the final shape; no changes needed
  once a key is supplied.
- **To swap in:** Get a YouTube Data API v3 key (Google Cloud Console → enable "YouTube
  Data API v3" → Credentials → API key) and set `YOUTUBE_DATA_API_KEY` in `api/.env`. No
  code changes — `fetchYouTubeMetadata` picks it up automatically.

## 8. Analytics CSV export — no separate Admin auth model exists in this repo

- **Ticket:** T12 (Analytics summary + Admin CSV export, P8b)
- **File/module:** `api/src/routes/analytics.routes.ts` (`GET /analytics/export.csv`).
- **What's faked and why:** Spec Table B #13 calls this an Admin-facing endpoint, but this
  build is Parent-Experience-only — there is no Admin account/identity system anywhere in
  this repo to gate it behind. The endpoint is instead gated behind the same `requireAuth`
  as every other parent endpoint, and returns only the *requesting account's own* aggregated
  data (all of its children, all-time) — not a cross-family Admin export. Disclosed in the
  T12 commit message as a phase-1 simplification; added here per this doc's own policy of
  tracking every such stand-in, not just mentioning it in a commit.
- **Real contract:** Whatever Admin identity/auth model the Admin flow settles on needs its
  own middleware (parallel to `requireAuth`) that this endpoint (or a genuinely separate
  Admin-flow-owned endpoint) authenticates against, with a query surface that spans families,
  not just the caller's own.
- **To swap in:** Once an Admin auth model exists, add an Admin-scoped route (or middleware)
  and decide whether `/analytics/export.csv` moves behind it as-is or a new cross-family
  export endpoint is added alongside it.

## 9. "% KidQ-reviewed" — computed from library source tags, not a scoring-engine join

- **Ticket:** T12 (Analytics summary + Admin CSV export, P8b)
- **File/module:** `api/src/services/analytics.ts` (`percentKidqReviewed`).
- **What's faked and why:** Spec Section 11 #19 and this ticket's AC3 describe this stat as
  a join against the scoring engine's badge/pass-fail result per watched video — that data
  doesn't exist yet (same gap as INTEGRATION_NOTES.md #5). Rather than block the metric on
  it, `percentKidqReviewed` is computed from each watched video's real library source tag
  (`kidq_recommended` + `admin_approved_from_submission` vs. `picked_by_parent`; a video not
  in the library at all — i.e. it came straight from Session Assembly, never explicitly
  added — defaults to `kidq_recommended`). This is real data, not a fabricated number, but it
  answers a related-but-different question ("was this from KidQ's curated source?" vs. "did
  this specific video pass the scoring engine's checks?") than the spec literally describes.
- **Real contract:** Once the scoring engine exposes a per-video pass/fail result (see
  INTEGRATION_NOTES.md #5's real contract), `percentKidqReviewed` could either switch to that
  join, or the two could become two distinct stats if both remain useful.
- **To swap in:** Add the scoring-engine join once callable; decide whether it replaces or
  supplements the current source-tag-based stat.
