# KidQ Design Integration Contract

## 1. Purpose

This file is the handoff contract for integrating KidQ's existing parent and
child designs into the application. The existing prototypes are the visual
source of truth. Preserve their layout, copy, spacing, colors, typography,
geometry, interaction patterns, motion, and responsive behavior. Do not
redesign, modernize, simplify, or introduce a new design system during the
port.

This is an integration reference, not production UI code. Prototype launcher
controls, hard-coded demo data, demo video files, and prototype notes are not
product requirements.

## 2. Source Files

### Child experience (repository)

| Source | Responsibility |
|---|---|
| `design/README.md` | Child-mode intent, screen inventory, `KidQData` seam, API mismatches, player requirements, TV/cast notes, and porting constraints. |
| `design/brand.md` | Locked child design system: color tokens, sky gradients, typography, motion tiers, exact geometry, accessibility and component rules. |
| `design/concept.md` | Child-mode product concept and guardrails. |
| `design/OPEN-ITEMS.md` | Unresolved design/product decisions; do not silently resolve these in UI code. |
| `design/prototype/index.html` | Runnable child prototype markup and screen inventory. |
| `design/prototype/kidq-desktop-app.css` | Child layout, tokens, component styling, container-query tiers, states, animations, focus states, and reduced-motion rules. |
| `design/prototype/kidq-desktop-app.js` | Child prototype state machine and interaction behavior. Its `KidQData` object is the backend integration seam, not a final API shape. |
| `design/prototype/kidq-breathe-anim.js` | Optional Lottie breathing animation bundle; SVG fallback is in the prototype markup. |
| `design/prototype/kidq-hifive-anim.js` | Optional Lottie high-five animation bundle; SVG fallback is in the prototype markup. |
| `design/prototype/proposal-src/thumb-a.jpg`, `thumb-b.jpg` | Demo thumbnails/footage source assets. They are proposal/demo media and must not ship as production content. |

### Parent experience (supplied reference artifacts)

| Source | Responsibility |
|---|---|
| `/Users/shalini/Downloads/KidQ_Parent_Prototype (1) (1).html` | Clickable parent prototype, including parent tokens, phone shell, all parent screens, state transitions, copy, and demo data. This file is outside the repository; preserve it as a reference and do not overwrite it. |
| `/Users/shalini/Downloads/KidQ_Parent_Experience_Spec_6.md` | Product and backend requirements for P0–P9, onboarding fields/defaults, session assembly, handoff, analytics, My Videos, voice/guided capture, and API surface. Treat it as product specification, not CSS/source code. |
| `/Users/shalini/Downloads/INTEGRATION_NOTES.md` | Explicit placeholders, fake/stub boundaries, real contracts, and swap-in instructions. Treat those limitations as integration facts. |

The parent artifact imports Google Fonts for `Baloo 2` and `Nunito`. The child
design system specifies `Baloo 2` and `Mukta`; this difference is intentional
in the supplied sources and must be resolved by design/product owners before
normalizing typography.

### Existing application seams

| Source | Responsibility |
|---|---|
| `web/src/app/page.tsx`, `web/src/app/page.module.css` | Current web landing shell; it is not the parent/child prototype implementation. |
| `web/src/app/analytics/page.tsx`, `web/src/app/analytics/analytics.module.css` | Existing production parent analytics page. Preserve its API-driven behavior when adopting parent visual treatments. |
| `web/src/services/api.ts` | Current web API client seam. |
| `web/src/features/analytics/*` | Event tracking and watch analytics plumbing; use it rather than inventing client event logic. |
| `packages/kidq-player/src/index.tsx`, `packages/kidq-player/src/story-reader.tsx` | Shared restricted video/story player. Child mode needs the additive `onProgress` and chrome-suppression seams described in `design/README.md`; admin defaults must remain unchanged. |
| `docs/api/README.md`, `api/openapi.json` | API contract and parent/child integration rules. |
| `INTEGRATION_NOTES.md` (source artifact in Downloads) | Placeholder/stub boundaries for Firebase, age bands, mascot lavender, candidate ranking, trust badges, admin decisions, YouTube, analytics, and other integrations. |

## 3. Page Structure

### Parent screens

The parent prototype is a 390×844 phone experience inside a prototype-only
studio shell. The studio masthead, rail, launcher, and stage are review chrome;
they are not part of the product.

| Screen | Structure and behavior |
|---|---|
| P0 Login | Centered KidQ mark, welcome copy, Google Sign-In CTA, shared-account note. First-time routes to P1; returning routes to P7a. |
| P1 DPDP consent | Back link, privacy explanation, consent card and tap checkbox. Continue is unavailable until checked. One-time gate before child creation. |
| P2 mandatory | Parent name, 1–6 child count stepper, repeated nickname/age-band fields, optional mascot color. Mandatory fields cannot be skipped. |
| P2 confirmation | Explains age-based defaults. Primary starts immediately; secondary opens Customize Hub; tertiary Browse and pick myself bypasses preference tagging and goes to recommendations. |
| P2 Customize Hub | Direct-edit hub for interests, content mix, regulation goal, screen time/breaks, plus optional Talk/type and Guided questions shortcuts. Voice/guided results fill these fields directly; there is no separate review screen. |
| P2 interests | Multi-select interest chips; empty is valid. Final vocabulary comes from taxonomy, not prototype constants. |
| P2 content mix | Surprise us or selected categories. Selected categories reveal chips. |
| P2 regulation | Multi-select parent-facing regulation goals. Engine tags are backend values. |
| P2 screen time | Duration chips 15/30/45/60/90, derived break summary, break interval, and independent break-type choice. Final wind-down is always included. |
| P3 voice | Tap mic/listen state, typed fallback, transcript preview, disabled Continue until input exists. Applies through Voice-to-tag NLU into the Hub. |
| P3 guided | Two short tap-based questions. Continue is disabled until both answers exist. Applies the same Hub fields as voice. |
| P5 recommendations | Two-column content shelf, title/category metadata, trust badge/detail seam, Continue to child preview. Browse-myself enters here without preference tagging. |
| P6 child preview | Dark/night preview of the child experience, no settings-heavy child UI, then continue to Start a Session. |
| P7a Start a Session | Returning-parent home. Child switcher first when multiple profiles exist; per-child remembered duration chips; voice duration affordance; session summary; preference link; primary starts live immediately on handoff. |
| P8a session-complete notification | Completion notification and factual watched list, with bounded adjacent-age fallback disclosure only when it occurred. View details or return home. |
| P8 session log | Factual watched-content list, category/duration, 👍/👎 controls, and link to My Videos. Never infer mood/attention. |
| P8b analytics | One child at a time, child switcher, day/week/month range, factual screen-time/completion/category breakdowns. Use production analytics API data, not prototype numbers. |
| P9 My Videos | Family library, remove item, per-child include/exclude avatars, Add a video CTA. |
| P9a Add a Video | Paste YouTube URL, optional “suggest to other families” toggle, submit. Preview/detection and trust status come from API. |
| P9b/P9b-reject | Approved/rejected submission notification. Approval is an Admin-flow result; parent-triggered simulation is prototype-only. |
| P7 Settings | Rare defaults: content/curation Hub link, autoplay, break type, sensory-friendly mode, daily schedule. Keep settings distinct from P7a quick session start. |

### Child screens

The child prototype uses one responsive sky world and a finite state machine:

1. Splash: balloon-letter KidQ entrance, approximately 2.4s.
2. Who's watching: child profile picker on pre-dawn sky.
3. Sunrise: greeting, parent attribution, and one large sun button.
4. Watching: player, sun on time arc, time-left pill, progress/day bar, current title, and finite session strip.
5. Playtime: transition into an activity break.
6. Breathing: three guided breaths with sun/flower/candle or Lottie animation.
7. Find three: spoken and visual color-finding activity.
8. After-break choice: tap sun for next or select any remaining video.
9. Sunset/all done: moon, high five, “what's next” choices.
10. No session: “sun is still asleep”; no child CTA to create a session.
11. Night light: warm moon glow toggle after the session; no route back to videos.
12. Cast: visual cast-mode mock; real casting remains an integration decision.

The child design's core metaphor is fixed: the sky is the timer, the sun is the
primary action, the moon owns the night, the heart marks parent presence, and
the “The End” card is visible in the session queue from the start.

## 4. Component Mapping

No production component currently exists for the parent or child prototype.
Do not claim that a target exists when it does not.

| Existing design element | Target application component |
|---|---|
| Parent phone shell and screens | NEW COMPONENT REQUIRED: parent app shell and route/state components. |
| Parent top bar/back arrow | NEW COMPONENT REQUIRED: `ParentTopBar`/screen navigation. |
| Parent primary/secondary buttons | NEW COMPONENT REQUIRED; preserve `.kq-primary-btn` and `.kq-secondary-btn` geometry. |
| Parent card/row/pill/chip/tab bar | NEW COMPONENT REQUIRED; preserve the prototype classes/tokens. |
| Parent child switcher/avatar | NEW COMPONENT REQUIRED; source child nickname/color from API. |
| Parent onboarding forms | NEW COMPONENT REQUIRED; connect to `/onboarding` and `PATCH /children/:id`. |
| Parent Customize Hub | NEW COMPONENT REQUIRED; shared by onboarding, Settings, and Start a Session preference link. |
| Parent analytics screen | Existing production page at `web/src/app/analytics/page.tsx`; adapt visual treatment only if explicitly requested and preserve its API/data logic. |
| Child screen state machine | NEW COMPONENT REQUIRED under `web/src`/feature boundaries. Port behavior from prototype JS; do not port `KidQData` as a fake production store. |
| Child sky, sun, moon, arc, day bar | NEW COMPONENT REQUIRED; use child prototype SVG/CSS geometry and tokens. |
| Child restricted player | Existing `KidQPlayer`; add only the agreed additive progress/chrome props, then wrap it with child-mode controls. |
| Child story reader | Existing `KidQStoryReader`; preserve credits and page navigation. |
| Child breaks | NEW COMPONENT REQUIRED; consume API `break_activity`, `spoken_instruction`, and `variant`. |
| Child Lottie animations | Reuse `kidq-breathe-anim.js` and `kidq-hifive-anim.js`, with existing SVG fallback. |
| Prototype launcher/demo bar | DO NOT IMPLEMENT in production. |

## 5. Styling Rules

### Parent tokens (from supplied parent prototype)

Use the existing names/values or map them one-to-one; do not approximate:

```text
saffron #FF8C00, saffron-ink #C96F00
teal #008080, teal-deep #00666a
cream #FFF8F0, mango #FFC107, terracotta #D9534F
charcoal #2B2B2B, text-secondary #6B6355, text-tertiary #736A5A
border #E4DDD0, border-dashed #D8CFBC, white #FFFFFF
night-bg #2E2A5C, night-bg-deep #262247, dusk #8B85C9
card-mint #E9F5F5, card-sky #DCEEF7, card-peach #FDEBD8
card-lavender #F1EAFB, card-butter #FFF3D6
card radius 24px; control radius 16px; pill radius 999px
card shadow 0 8px 16px rgba(0,0,0,.08)
CTA shadow 0 8px 16px rgba(255,140,0,.28)
display Baloo 2 / Fredoka / Nunito; body Nunito / system-ui
```

Parent baseline geometry is 390×844, 44px phone radius, 10px outer shadow
ring, 20px horizontal screen padding, 30px top padding, 54px primary CTA,
52px secondary CTA, 16px card padding, 14px chip/field radius where the
prototype uses inline styles, and 14px body/subtitle text. Preserve the
prototype's exact values when converting inline styles into CSS modules.

### Child tokens and geometry

Use `design/brand.md` and `kidq-desktop-app.css` as the authority. Key values:

```text
cream #FAF4E8; cream-deep #F2E9D8; ink #2E2A24; ink-soft #6B6459
teal #1F7A6D; teal-deep #16594F; teal-on-dark #7FD8C8
sun #FFC64D; sun-deep #F0A72E; dusk #C9B8E8
night #2B2955; night-deep #211F45; heart #E2705E; card #FFFFFF
display Baloo 2 (700/800); body Mukta (400/500/600/700)
default motion 400–600ms ease-out; sun travel 1.25s cubic-bezier(.3,.7,.3,1)
phone frame 390×844, radius 44px, ink border/shadow ring 10px
sun on arc 64px; cast 110px; sunrise 168px; break guide 170px
arc quadratic from (28,286) through (195,50) to (362,286)
```

The child sky gradients, game colors, WCAG requirements, exact font scale,
motion loops, pause semantics, and component geometry are all specified in
`design/brand.md`; copy values from there rather than recreating them.

### Responsive rules

Child layout uses `container-type: inline-size` on `#app`, not a separate phone
layout. Preserve the three tiers in the stylesheet:

- Base: flexible column layout for short/narrow screens.
- `@container (min-width: 601px)`: tablet sizing and player budget.
- `@container (min-width: 1100px)`: wide layout, larger typography/sun/cards.

Parent prototype uses a 390px phone that becomes fluid with
`aspect-ratio: 390/844` below 760px; the outer review layout changes to a column
and moves the rail below the stage. Product UI should preserve the phone
screen's internal layout and scrolling, not ship the review rail.

### Accessibility and motion

All controls need keyboard/TV focus, Enter/arrow operation where applicable,
and visible focus rings. Do not rely on hover-only affordances. Honor
`prefers-reduced-motion: reduce`; the child prototype disables ambient loops and
shortens transitions. A child pause freezes video and the entire sky/world.

## 6. Asset Mapping

| Asset | Existing path | Use |
|---|---|---|
| Child prototype markup/SVG faces, sun, moon, arc, icons | `design/prototype/index.html` | Port inline SVGs as components or preserve equivalent markup; do not substitute iconography. |
| Breathing Lottie bundle | `design/prototype/kidq-breathe-anim.js` | Optional breathing animation; use the hand-built SVG fallback when unavailable. |
| High-five Lottie bundle | `design/prototype/kidq-hifive-anim.js` | Optional all-done animation; use the hand-built SVG fallback when unavailable. |
| Demo thumbnails | `design/prototype/proposal-src/thumb-a.jpg`, `thumb-b.jpg` | Prototype only; do not use as production content. |
| Parent logo/avatar/Google icon | Inline SVG/HTML in `/Users/shalini/Downloads/KidQ_Parent_Prototype (1) (1).html` | Reuse the visual treatment when implementing; do not create a replacement icon set. |
| Production content thumbnails | API `ContentCard.thumbnails` | Use the size appropriate to phone/TV; never hard-code prototype images. |
| Story illustrations/credits | `GET /content-items/:id/story` | Render through `KidQStoryReader`; retain source credits. |

## 7. Responsive Behaviour

- Parent screens scroll vertically inside the phone; the bottom tab bar is
  present on P7a, P8b, P9, and P7 and remains visually separate from content.
- Parent layouts use one/two-column content within the phone as shown; do not
  turn the phone flow into a desktop dashboard without a new approved design.
- Child watching/cast player width is constrained by both container width and
  viewport-height budget. Preserve the prototype's player aspect ratio and
  queue/card resizing at 601px and 1100px.
- Child has no separate mobile redesign. Arrangement and scale change within
  the same sky world.
- TV/PWA controls must be focusable and work with arrow keys, Enter, and Back;
  TV wrappers load the live HTTPS app rather than a `file://` bundle.

## 8. Interaction Behaviour

### Parent

- Primary CTAs are saffron filled; secondary CTAs are white with teal border;
  selected chips are teal filled with white text.
- Consent checkbox and all required form validation gate Continue.
- Back arrows preserve the prototype's explicit destinations, including the
  “use KidQ's recommendation instead” escape hatch from capture screens.
- Child switcher changes the active child and never shares remembered duration
  between children.
- Start a Session creates/starts the session immediately when the parent
  confirms duration; the child does not tap a second Start control.
- Voice input is an optional shortcut. It must return best-effort tags or a
  duration, require review in the Hub fields, and never write directly to a
  child library.
- Analytics range is day/week/month in the prototype; production analytics
  uses the API's today/7d/30d contract where that page is already implemented.
- My Videos remove and per-child inclusion are separate actions.
- Public submission approval/rejection comes from Admin; do not retain the
  prototype's parent-triggered simulation in production.

### Child

- Splash auto-advances; profile selection starts the appropriate sunrise/no-
  session path.
- The sun is the primary action. Autoplay continues between videos but never
  out of a break; returning from a break requires a tap.
- Breaks occur at time targets snapped to the nearest video boundary; never
  cut a video short. The production API's final `WIND_DOWN` is the terminal
  break seam that must be reconciled with the prototype ending.
- The session strip always shows the finite queue, current item, watched state,
  and The End card. Switching videos does not rewind the sun.
- Break instructions are spoken with device voice when available; speech is an
  enhancement and must never be required for the break to work.
- Night light toggles a warm glow with a 1.2s fade and does not reopen videos.

## 9. Existing Business Logic to Preserve

Use `docs/api/README.md` and `api/openapi.json` as the API authority. The
following must remain connected while replacing prototype state with real data:

- Auth: repository API currently documents Supabase Bearer auth and dev auth;
  the supplied parent spec calls for Google/Firebase. This is an explicit
  integration discrepancy—do not silently replace the repository auth stack.
- Onboarding: `GET /me`, `POST /onboarding`, `PATCH /children/:id`,
  `POST /children`; preserve nickname/age-band minimization and 1–6 children.
- Taxonomy: `GET /taxonomy` supplies interest/category/regulation options;
  do not ship the prototype's hard-coded vocabulary as authoritative.
- Recommendations/library: `GET /children/:id/recommendations`, library add/
  remove, and `GET /children/:id/library`; only approved playable content may
  be shown to children.
- Sessions: `POST /children/:id/sessions` starts a session, returns ordered
  slots/breaks/opener/wind-down; current session, replay, item updates, end,
  activity events, and session history must use the documented routes.
- Player telemetry: send watched/position updates and analytics events through
  existing tracker/player seams; do not count paused/hidden time as playback.
- Analytics: `GET /children/:id/analytics?period=today|7d|30d` supplies the
  production analytics page; preserve privacy and idempotent event behavior.
- Parent submissions: preview/detect, submit, poll, and library “Keep” use the
  documented submission routes. Trust badges render API-provided plain words;
  do not fabricate scoring dimensions.
- Attribution, content categories, age fallback disclosure, safety filtering,
  session assembly, server-side time-band determination, and admin approval are
  backend responsibilities. The UI must render their results rather than
  recompute or invent them.

## 10. Integration Mapping

| Existing design | Target location | Logic to preserve | Visual rules | Risk |
|---|---|---|---|---|
| Parent onboarding P0–P2 | New parent route/components | Auth, consent, onboarding payload, taxonomy | Parent tokens, 390×844 flow, exact copy and CTA hierarchy | Supplied parent artifact expects Google/Firebase while repo docs specify Supabase. |
| Customize Hub and capture | Shared parent feature used by onboarding/Settings/P7a | PATCH child preferences; NLU only fills fields | Same row/card/chip geometry; no extra review screen | Do not overwrite independently saved fields or use shared demo state. |
| Recommendations/P5 | New parent recommendations screen | API cards, why, trust badge, approved-only | Two-column shelf/card rhythm | Real scoring detail may be unavailable; use documented placeholder behavior. |
| P7a session start | Parent home route | Child-specific duration, mode, POST session, immediate handoff | Child switcher and duration chips; Settings stays separate | Do not imply time-of-day content ranking Layer 2 exists. |
| P8/P8a/P8b | Existing analytics plus new handoff screens | Sessions history, notifications, analytics API/tracker | Factual copy; no mood/attention inference | Prototype numbers are fake. |
| P9/P9a/P9b | New My Videos/submission screens | Library/submission/admin callback contracts | Cards, avatars, toggle, notifications | Parent-triggered admin simulation must not ship. |
| Child sky/session screens | New child feature using shared player | Current session, slots, events, item updates, end | Exact sky/sun/moon/arc and motion tokens | Wind-down cadence and child player chrome require seam decisions. |
| Child breaks | New child break components | `break_activity` and activity events | Spoken instruction, visual swatches, breathing motion | Must retain fallback if speech/Lottie unavailable. |

## 11. Integration Sequence

1. Confirm the auth discrepancy and the unresolved child cadence/player/casting
   decisions in `design/OPEN-ITEMS.md` and `docs/api/README.md`.
2. Extract parent and child tokens into scoped styles without changing values.
3. Build the parent shell/navigation and screen-state routing, excluding review
   launcher chrome.
4. Implement onboarding and Customize Hub against taxonomy/API contracts.
5. Implement recommendations, child preview, Start a Session, and handoff.
6. Implement My Videos, Add a Video, submission notifications, and Settings.
7. Preserve/adapt the existing production analytics page and wire session log.
8. Port the child state machine and sky world, replacing `KidQData` with API
   adapters.
9. Add the minimal `KidQPlayer` progress/chrome seams, then child controls,
   break activities, playback telemetry, and TV focus behavior.
10. Add responsive/container-query behavior and reduced-motion handling.
11. Verify visual parity at parent 390×844 and child base/601px/1100px tiers.
12. Run the repository's typecheck, lint, tests, build, and relevant API tests;
   manually verify auth, onboarding, session start, pause/resume, breaks,
   completion, analytics, and submission states.

## 12. Do Not Change

- Do not redesign, modernize, or consolidate the parent and child visual
  systems without explicit design approval.
- Do not change spacing, colors, typography, copy, radii, shadows, iconography,
  animation timing, or responsive tiers to match personal preference.
- Do not implement the prototype launcher, rail, stage labels, demo bar, fake
  session data, fake analytics numbers, or demo media as product UI/data.
- Do not delete or overwrite the supplied prototypes, design docs, or original
  assets.
- Do not invent mappings for components that do not exist; mark them NEW
  COMPONENT REQUIRED until implemented.
- Do not replace API business logic with local state, hard-coded taxonomy,
  fabricated trust scores, fabricated admin decisions, or broad fallbacks.
- Do not expose child settings icons, YouTube descriptions/links, seek/scrub
  controls, or numeric clocks in child mode.
- Do not add ad/monetization slots between videos.
- Do not claim time-of-day content ranking exists; only Layer 1 opener and
  wind-down copy are currently safe to imply.

## 13. Open Questions and Known Blockers

These are genuine source-level discrepancies or explicitly unresolved items:

1. Repository auth is documented as Supabase; the supplied parent spec and
   integration notes describe Firebase/Google placeholders. The owning team
   must choose the production auth contract before wiring login.
2. Child prototype breaks (time-targeted MOVE/SETTLE and no terminal break) do
   not exactly match the API/spec's interval-derived mandatory WIND_DOWN.
3. `KidQPlayer` needs an approved additive `onProgress` and child chrome
   suppression interface; CSS hiding is only a fallback.
4. Casting direction/implementation and TV wrapper behavior are not settled.
5. Parent font difference (Nunito) versus child/body font (Mukta) is present in
   the supplied sources and needs design sign-off before unification.
6. Lavender mascot token is a documented stand-in until design confirms a
   solid lavender token.
7. Child age-band re-derivation is not defined because onboarding captures a
   coarse band rather than birthdate.
8. The real scoring/recommendation candidate interface and per-dimension trust
   detail are not yet available; preserve the documented placeholders.
9. Admin review callback for public parent submissions is not yet a real
   parent-triggerable operation.
10. Production YouTube/Firebase credentials and any other environment secrets
    remain deployment configuration, never hard-coded in UI.

## 14. Current Parent Flow Implementation

The active Parent route is `/parent` and keeps persona navigation inside the
Parent experience. The login header is hidden until sign-in; the Kid route is
only opened by an explicit Kid-mode link or a confirmed child-queue action.

The implemented parent journey is:

`Login → Consent → Child profile → Confirmation → Preferences → Screen time →
Get recommendations → Recommendation review → Add/Edit Your Q → Plan ready`.

Recommendation review is backed by `web/src/features/parent/recommendationService.ts`.
Mock recommendations are filtered to age-compatible catalog entries, fit the
selected duration with transition space, expose guardrail labels, and remain
uncommitted until the parent confirms the queue. The UI supports remove/add
back, approved-content additions, playlist editing, duration totals, and an
over-duration warning.

Add Content includes three parent-only paths:

- Approved catalog content.
- URL validation, metadata/scoring loading, good-score and poor-score results,
  with a private “add anyway” path.
- PDF upload state with extracted URL cards and per-item selection.

The current UI models good URL submissions as `public_candidate` eligible for
later moderation and poor-score additions as private parent content. Real URL
fetching, PDF parsing, AI scoring, and authorization must replace the mock
states at the documented backend boundaries; content is not auto-published or
made visible to the Kid experience before queue confirmation.

The centralized activity catalog is
`web/src/features/kidq/activityCatalog.ts`. It preserves live `find`, `follow`,
`breathe`, and `breathe_sun` activities and records the requested `SPEC'D` and
`NEW CONCEPT` moving/calmer activities without falsely presenting them as live.

Responsive behavior uses a wide desktop recommendation grid and summary panel,
two-column tablet cards, single-column mobile cards, a mobile bottom tab bar,
safe-area padding, touch-sized controls, and visible keyboard focus rings.
## 15. Kid PR Sync for Integration

`origin/main` was fetched at `0a355f6`, including the merged Kid prototype
updates. The synced source of truth is now under `design/prototype/`, and the
local reference bundle is mirrored under `web/public/kid-prototype/`.

The active React Kid route remains `/kid` so the product route does not expose
prototype demo controls. The meaningful merged Kid behavior is represented in
the active route as the explicit child flow:

`Profile → Sunrise/session → Finite queue → Playtime → Breathe with the sun →
Follow the sun → Find 3 colours → Session complete`.

The merged prototype also contains richer production handoff seams for Claude
to connect next: session/video progress, break planning, replay and resume,
reduced-motion behavior, audio fallback, follow-the-sun timing, choice-screen
autoplay, high-five completion, no-session/night-light states, and cast mode.
The prototype demo bar is reference-only and must not be shipped as product UI.

Integration boundaries:

- Keep Parent routes under `/parent` and Kid routes under `/kid`; browser Back
  and default fallbacks must never switch personas.
- Replace local Kid session state with the existing child-session API and
  activity event contracts; preserve the finite queue and parent approval gate.
- Map activity keys to `activityCatalog.ts`; live seams are `find`, `breathe`,
  `breathe_sun`, and follow-the-sun. `tree`, `butterfly_wings`, `puddle_jump`,
  `cloud_reach`, `sleepy_stretch`, and `firefly_count` remain non-live until
  their assets/specs exist.
- Use backend session progress and break scheduling as the authority. Do not
  derive production breaks solely from client timers.
- Keep the synced follow audio and Lottie assets available for integration,
  with speech/audio fallback when unavailable.

## 16. Parent Bug-Fix Verification

The active Parent UI now keeps the complete queue-management path inside the
Parent persona:

`Start → timing preference → screen time → Get recommendations → Review →
Your Q → Add/Edit → Confirm → Your Screen Time Plan is Ready`.

Specific fixes included:

- `Change content preferences` is a distinct tune control with an accessible
  popover. It shows Auto, Morning, Daytime, and Bedtime, keeps the selected
  value visible, and provides an entry to the full preferences flow.
- `Get recommendations` is visually separated as the single primary action;
  it never opens the Kid route directly.
- Recommendation review now labels the queue as `Your Q`, shows selected
  screen time and current Q duration, and updates totals immediately when a
  card is removed or restored.
- Your Q supports add, remove, confirm, and up/down reorder controls. Empty Q
  and over-duration states are explicit and readable on mobile.
- Plan confirmation copy is exactly `Your Screen Time Plan is Ready` and the
  Kid queue remains behind an intentional action.
- URL import has invalid/retry, loading, score, good-score, poor-score, cancel,
  private Add Anyway, and duplicate-safe states.
- PDF import exposes upload, extracted-item selection, and partial-result
  behavior so one failed URL does not need to block the remaining items.
- Repeated `Parent space` labels were removed from flow headers; the login
  screen remains free of authenticated navigation.

The URL/PDF scoring and parsing shown in the frontend are mock integration
seams. Claude should replace them with authenticated service calls and enforce
the `private → public_candidate → public` lifecycle at the data layer. A poor
score must remain private to the owning parent; a good score is only a
moderation candidate and is never auto-published.

## 17. Responsive QA Results

Live viewport checks were run against `/parent` at 375, 390, 430, 768, 1024,
1280, and 1440 CSS pixels. No horizontal overflow was reported at any tested
width. Desktop uses the wide centered shell and recommendation grid; tablet
and mobile use the compact bottom navigation so the full desktop nav does not
wrap into clipped or unreadable labels.

The recommendation summary primary action has an explicit orange fill and
white text so it cannot be hidden by the summary link styles. Mobile queue
rows wrap their reorder/remove controls, and the shell reserves bottom safe
area space for the fixed navigation.

## 18. Parent Desktop Navigation Layout

At widths above 1100px, the Parent experience uses a proper web layout with a
left workspace rail containing Start a session, First-time setup,
Recommendations, Analytics, My videos, and Preferences. The shortcut-card row
is hidden on desktop so the main content is not pushed below the session card.
The existing top header remains for global identity, parent/kid switching, and
secondary route access.

At widths of 1100px and below, the left rail and dense top route nav collapse;
the mobile/tablet bottom navigation remains available with safe-area padding.
The shortcut cards remain available in the responsive content area where they
are useful for touch navigation.

## 19. Cross-Route Responsive Verification

The responsive foundation was audited across the landing/Kid entry route,
`/kid`, `/parent`, and `/analytics` at 375, 390, 430, 768, 1024, 1280, and
1440 CSS pixels. Each route completed with `scrollWidth === clientWidth`, and
no visible buttons or links extended outside the viewport.

The Kid profile picker now stacks its profile cards below 600px so the entry
flow remains touch-friendly and does not clip at 375px or 390px. The Kid
header wraps cleanly on narrow screens, and queue cards can wrap instead of
forcing horizontal scrolling. Desktop Kid, Parent, and Analytics layouts use
the available browser width while preserving their existing visual language.

Local verification URLs:

- `http://localhost:3000/` — Kid entry / profile selection
- `http://localhost:3000/kid` — Kid experience
- `http://localhost:3000/parent` — Parent experience
- `http://localhost:3000/analytics` — Parent analytics
