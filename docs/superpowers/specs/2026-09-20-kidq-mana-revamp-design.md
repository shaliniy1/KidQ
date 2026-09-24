# KidQ MANA-style revamp + subscription — design spec

Date: 2026-09-20 · Approved in-conversation by user (brainstorming skill flow)
Reference: https://en.manayerbamate.com/collections/all (MANA yerba mate, Shopify theme `mana/main`)

## Context & goal

KidQ moves to a subscription model (**90-day free trial, then ₹99/month, single
plan** — long trial is deliberate: the product is still validating the idea).
The user wants the design revamped "in this way, animations exactly like this,"
pointing at MANA's collections page. Two surfaces get the revamp:

1. A **new marketing/landing page** carrying the subscription pitch (new surface).
2. The **parent web app mockup** (`design/parent-mockups-v1.html`, artifact
   https://claude.ai/artifact/Pf552qVtm4AmY431WkYxMs) — restyled + 3 subscription
   additions.

Kid mode (child screens) is explicitly **out of scope** — its calm
anti-overstimulation brand stays untouched, and the child never sees a paywall.

The user also said the current palette "feels dull" → the revamp includes a
**brightened color pass**, not just treatment.

### What "MANA's animations" means (observed on the live site)

- Giant **scroll-scrubbed typewriter headline**: pinned hero, letters appear
  one-by-one tied to scroll progress, mostly ink with a few letters in accent
  colors (their `titre rainbow` / per-letter `lettre` spans).
- **Parallax floating decorations** (`parallaxEtoile`) drifting at different
  scroll speeds.
- **Full-bleed color-block product tiles**, edge-to-edge saturated colors, big
  title on top, centered product; hover swaps a `base`/`hover` image layer.
- Curved/rotated text accents; full-width video band; playful illustrated
  footer (walking mascot, outline clouds, wavy horizon, round social buttons).
- Cream page canvas; saturation lives in the blocks, not the canvas.
- Plain CSS/JS, no animation libraries — we match that.

## Sequencing (locked: landing-first)

**Phase 1 — landing page** (`design/kidq-landing-v1.html`, NEW file, published
as a NEW artifact). The brightened palette and the motion system are designed
and proven here first.

**Phase 2 — app restyle** (edits `design/parent-mockups-v1.html`, republished
to the existing artifact URL). Ports the proven tokens + motion, adds the
subscription screens.

**Concurrency constraint (2026-09-20):** peer session shreena-28 is actively
editing `parent-mockups-v1.html` (desktop sidebar→top-nav conversion, will
publish artifact Version 20). Phase 2 must start only after it reports done,
must re-read the file fresh, and must build on the top-nav layout, not the
sidebar this spec's author last saw (Version 19).

## Brightened palette

Canvas and ink stay (identity + already max contrast): cream `#FAF4E8`,
ink `#2E2A24`, night `#2B2955`.

New **tile-grade block colors** (computed WCAG ratios, 2026-09-20):

| Token | Hex | Text on it | Ratio | Role |
|---|---|---|---|---|
| `--kq-block-leaf` | `#58B368` | ink | 5.47 ✓ | grass green (brightened from teal family) |
| `--kq-block-sun` | `#FFC64D` | ink | 9.12 ✓ | existing sun gold, unchanged |
| `--kq-block-sky` | `#3D64C4` | cream | 5.02 ✓ | bold blue (evolved from dusk lavender) |
| `--kq-block-coral` | `#F26B4E` | ink | 4.74 ✓ | punchy coral (brightened from terracotta) |
| `--kq-block-pink` | `#F585B9` | ink | 6.07 ✓ | new playful pink |
| `--kq-block-night` | `#2B2955` | cream | 12.36 ✓ | existing night, unchanged |

Rules (carried over from the existing system, still binding):

- Saturated **fill = selected/active**, light **tint = available** — mechanics
  unchanged in the app; only hue values change.
- Every text-bearing pairing passes WCAG 2.1 AA (4.5:1 body, 3:1 large text
  ≥24px/19px-bold). The table above is body-grade; display-only text may use
  lighter pairings at ≥3:1 if a build-time check confirms.
- Teal stays the app's action color: bright teal `#17A398` for icons, borders,
  and non-text surfaces; any **text-bearing** teal surface uses a deep variant
  verified ≥4.5:1 against its text color at build time (candidate `#167D72`;
  adjust lightness until it passes — same pattern as Ticklist's accent-hover
  rule). Validate the final set with `better-colors` / `critique-color`.
- Tints for the app are derived per-hue at build time (~10-14% strength on
  cream) and verified the same way the existing tint set was.

## Phase 1 — landing page (`kidq-landing-v1.html`)

Single page, sections top-to-bottom. English; ₹ pricing; India audience.
Fictional/no real social links (placeholder `#` hrefs). Desktop-first
responsive with a phone breakpoint (same conventions as the parent mockup).

1. **Header** — KidQ wordmark left; How it works · Pricing links; round pill
   CTA "Start free". Sticky, cream, thin ink border-bottom.
2. **Hero (signature animation)** — pinned section ~250vh of scroll: giant
   display type (clamp ~4rem→10rem) typing out **"SCREEN TIME THAT ENDS
   WELL."** letter-by-letter, scrubbed to scroll progress (not time). Letters
   ink by default; a fixed, deterministic subset in block colors (leaf, sky,
   coral, sun — chosen positions, not random, so every load matches).
   Parallax decorations: outline sun, stars, small clouds drifting at 0.2-0.5×
   scroll speed. One curved rotated accent line ("and ends with goodnight")
   arcing near the headline, MANA's "AND YOUR WARDROBE" style.
3. **How-it-works tiles** — 2×2 full-bleed color-block grid (edge-to-edge, no
   gaps, like MANA's product grid): *Mumma picks* (coral block, heart), *The
   sun keeps time* (sun block, sun+arc), *Breaks to play* (leaf block, flower),
   *Ends with goodnight* (night block, moon). Big tile titles top-center, flat
   illustration centered (pure CSS/SVG shapes in KidQ's existing visual
   vocabulary — sun with rays, arc, hearts, moon+stars; no raster images).
   Hover = base/hover state swap (sun rises along its arc, moon halo glows,
   heart beats, flower opens) + slight lift.
4. **Demo band** — full-width "living sky" strip: the session-sky gradient
   with the sun crossing its arc on a slow CSS loop, day-bar underneath —
   KidQ's own signature reused as the MANA full-width-video slot. Caption line
   "The sky is the timer. When the sun sets, the day's videos are done."
5. **Subscription block** — one bold full-bleed color block (sun gold):
   headline **"90 days free."** sub "Then ₹99/month. One plan, everything in
   it." Short 4-item feature list (you pick the videos · the sky keeps time ·
   playful breaks · ends with goodnight, phrased for parents), big pill CTA
   **"Start your 90 days"**, small honest footnote "No card needed to start."
   CTAs link to `#` (mockup).
6. **Footer** — cream; KidQ balloon-letter wordmark (the 4 brand-hue glossy
   balloon letters from the splash) gently idle-bobbing as the mascot moment;
   outline clouds; wavy horizon line; round social buttons; © line.

## Motion system (both phases)

- **Hero typewriter**: scroll-scrubbed; letter visibility stepped from scroll
  progress (`IntersectionObserver` + scroll handler with rAF; no libraries).
  Letters pop in fully-formed (no per-letter fade), matching MANA.
- **Parallax**: `translateY` at 0.2-0.5× scroll delta per decoration layer.
- **Tile hover**: 250ms ease-out crossfade between base/hover illustration
  states + `translateY(-4px)` lift + shadow per existing elevation language.
- **Entrances**: fade-up 20px, 400ms, 60-80ms stagger — reuse the app's
  existing `kq-fade-up` vocabulary, don't invent a second system.
- **Footer balloon bob**: ±6px, ~3s ease-in-out alternate, staggered per letter.
- **Reduced motion** (`prefers-reduced-motion`): hero renders fully typed and
  unpinned; parallax off; hovers become opacity-only; bob off. Binding, per
  the pinned WCAG 2.1 AA standard.
- App (Phase 2) gets the **load-time** variant of the letter animation on
  headlines (plays once, ~40ms/letter stagger), never scroll-scrubbed —
  it's an app, not a page.

## Phase 2 — app restyle + subscription screens

- Swap the fill/tint token **values** to the new palette (leaf/sky/coral/pink
  replacing their duller counterparts; mapping decided at plan time against
  the current `FILL_HUE`/`CATEGORY_FILL`/`KID_HUE` maps). Mechanics, focus
  restoration, and all prior a11y work stay untouched.
- Headline letter-pop entrance on Today's existing bold headline (and only
  there — one hero moment, not every screen).
- **Subscription additions (3):**
  1. Today: trial chip "Free until {date}" (neutral until last 7 days, then
     warms: "{n} days of free left · Keep KidQ for ₹99/mo" — calm, no
     countdown-panic).
  2. Settings: Subscription block — plan (₹99/month), state (trial/active),
     renewal or trial-end date, Cancel link (mockup, non-destructive styling
     per the existing destructive/benign grouping convention).
  3. New screen: trial-expired/upgrade — landing-language bold block, single
     plan, "Keep KidQ for ₹99/month" CTA. Parent-side only; kid mode lapses
     to its normal "sun is still asleep" screen, never a paywall.
- Copy voice: existing parent-side voice (plain, warm, no urgency tricks).

## Workflow & verification

Round-43 loop, unchanged: main session specs/plans (Fable read-only planning
where useful) → **Sonnet build agent** implements → main session verifies
(full file read of changed regions, Node syntax check on script blocks, live
Chrome walk over a local `python -m http.server` — never `file://`) →
republish artifact. Never two build agents on one file concurrently; Phase 2
additionally waits for shreena-28's all-clear and re-reads the live artifact
before republishing (expect Version ≥20).

Landing page publishes as a NEW artifact (title "KidQ Landing", own URL).
Detector pass (`impeccable detect`-class checks) + contrast verification on
both files before calling done. Animation claims are verified visually only
where the automation window allows; otherwise state-verification is reported
as such, per the project's documented hidden-window limitation.

Spec file deliberately left uncommitted (worktree branch is 86 behind
upstream and the mockup itself is untracked by prior user choice).

## Out of scope

Kid-mode screens; real billing/checkout (UPI/Razorpay/Play Billing is a
future implementation decision); real social links; Hindi localization;
porting either surface into the real `web/` Next.js app (separate,
teammate-owned step); any change to the child-facing prototype repos.
