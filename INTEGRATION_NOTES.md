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
