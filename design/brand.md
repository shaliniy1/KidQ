# KidQ — Brand & Design System

**Tagline:** Screen time that ends well.
**Direction:** calm-playful hybrid — kid-friendly warmth on a calm cream
base, deliberately not candy-colored chaos. The product's argument is
anti-overstimulation, so the design must never overstimulate. Visual
references: Ploy (bold display type, motion-led) × Givingli (warm cream,
friendly type, one accent, floating illustrated objects).

Everything below is locked and already implemented in `design/prototype/`
(child mode) — the original values were established in the pre-prototype
`kidq-mockups-v1.html` and proposal design artifacts, both kept outside
this repository. Exact values throughout — copy them into Figma
styles/variables verbatim.

## 1. The world (core metaphors)

- **Sky-as-timer.** The session is a day. The sun travels a dashed arc;
  the sky shifts cream → dusk lavender → indigo as time passes. Time is
  legible to a pre-reader; "12 min left" text serves parents.
- **The sun is the hero and the only button.** It starts the day (tap on
  the horizon), sits on its arc while watching, hops down to lead
  playtime breaks, returns to its seat, and sets when the session ends.
  It has a face: awake (dot eyes + smile), sleepy (curved closed eyes),
  blowing (o-mouth), content (closed eyes + smile).
- **The moon owns the night.** Sessions end and reopen-after-end screens
  belong to the moon: smiling face, cream disc with two grey craters,
  halo, gold twinkles, z's when sleeping. It jumps like the sun does
  (same delight tier). As a night-light it toggles a warm gold glow.
- **Heart-as-verb.** The coral beating heart marks the parent's presence:
  "♥ Mumma picked 3 videos · 25 min", "♥ Picked by Mumma · 8 min".
- **The ending lives in the flow, not the queue.** The last video always
  runs into the sunset and the all-done screen - a queue that simply
  stops after its last real card is already visibly finite, so nothing
  inside the queue needs to announce the end itself.

## 2. Color tokens

UI palette (one UI accent: teal; sun yellow is illustration-only, never
a text surface):

| Token | Hex | Use |
|---|---|---|
| `cream` | `#FAF4E8` | base ground, moon disc, light text on night |
| `cream-deep` | `#F2E9D8` | secondary surfaces |
| `ink` | `#2E2A24` | primary text on cream/sky, phone frame |
| `ink-soft` | `#6B6459` | secondary text, captions, moon face strokes |
| `teal` | `#1F7A6D` | THE UI accent: pause button, avatar, flower stem, what's-next pick badge |
| `teal-deep` | `#16594F` | teal text on light, focus rings, pressed |
| `teal-on-dark` | `#7FD8C8` | teal on indigo (focus rings on night) |
| `sun` | `#FFC64D` | sun disc, gold glow, knob, twinkles, Playtime pill |
| `sun-deep` | `#F0A72E` | sun rays, flower center, filled breath dots, flame |
| `dusk` | `#C9B8E8` | lavender: sky transitions, text on night, dashed borders |
| `night` | `#2B2955` | indigo: night sky |
| `night-deep` | `#211F45` | deeper night |
| `heart` | `#E2705E` | coral: hearts, flower petals |
| `card` | `#FFFFFF` | clouds, white surfaces |

Sky gradients (top → bottom, 390×844 frame):

| Sky | Stops |
|---|---|
| Pre-dawn (sunrise screen) | `#9F8CCB` 0% → `#C9B8E8` 34% → `#EDD9C4` 50% → `#F7CBA0` 62% → `#F3B583` 100% |
| Morning/day (watching, breaks, cast) | `#FDF8EC` 0% → `#F7EBD2` 58% → `#F1E2C4` 100% |
| Night (no-session, all-done, splash) | `#3A3768` 0% → `#2B2955` 52% → `#211F45` 100% |
| Deep night (night-light) | `#2B2955` 0% → `#211F45` 48% → `#171530` 100% |
| Dusk overlay (sunset moment) | `#9F8CCB` 0% → `#C9B8E8` 40% → `#F3B583` 100%, at 85% opacity over the day sky |

Game content colours (the find-a-colour break only — these name a colour to
a child, so they are content, not UI, and never appear as a UI surface):

| Colour | Hex | OKLCH | Contrast on the day sky |
|---|---|---|---|
| red | `#CC4C40` | L 58.8 · C 0.165 · H 28.5 | 3.51–4.24:1 |
| blue | `#217AD8` | L 57.9 · C 0.165 · H 253.9 | 3.39–4.09:1 |
| green | `#049640` | L 58.8 · C 0.165 · H 149.0 | 3.02–3.64:1 |

Tuned in OKLCH, not by eye. **One lightness and one chroma across all three**,
so no swatch reads as "the dark one" — the failure the previous brick red had.
A colour a child is asked to name out loud has to be unmistakably that colour,
which is a question of chroma, not lightness: at C 0.146 and hue 32 the old red
was terracotta. Chroma stops short of the crayon primaries (0.19 and up), which
clear contrast fine but go electric against this warm sky and break the rule
above that the emotional arc is carried by sky colour, not extra hues.

A swatch is a graphical object, so 3:1 is not required of it — but a child has
to see this one to play the game, so all three clear it against every stop of
the day sky. There is no yellow: the sun is on that screen and is also the
button. Green is a true green rather than a second teal, so game content never
reads as the UI accent; red is deeper and less orange than the `heart` coral,
which a 2–4 year old does not read as red.

**Flower-and-candle prop colours (2026-09-16) — a new subsection, not an
addition to the find-a-colour table above:** that table is scoped to
find-a-colour's own three named hunt colours (line 69); the flower/candle
break's props are hero-scale illustration, not a colour the child is asked
to name, so they get their own entry. Promoted from the breathing screen's
own offline-fallback SVG row (`docs/superpowers/specs/2026-09-16-kidq-
flower-candle-break-design.md`), then recoloured for the sky/petal/rose
adjacencies this hero scale actually needs:

| Element | Hex | Contrast |
|---|---|---|
| Petals | `#A8506E` (rose, the already-verified balloon palette) | 4.07–4.91:1 vs the three day-sky stops |
| Flower centre disc | `sun` `#FFC64D` (the token, not `sun-deep` — see below) | 3.33:1 vs the rose petals; face ink `#2E2A24` on it measures 9.12:1 |
| Flame body | `sun-deep` `#F0A72E` (unchanged token) + a ~2px outline ring `#9C6A18` | 3.66–4.41:1 (the ring) vs the three day-sky stops |
| Candle outline | `#6B6459` (`ink-soft`, unchanged token) | 4.57–5.52:1 vs the three day-sky stops |
| Stem/leaf | `teal` `#1F7A6D` (unchanged token, reused as-is) | already covered above |

The flame's ring is the **second live instance of the outlined-gold contrast
mechanism** open item 35 asked this file to document: gold alone measures
only 1.60–1.93:1 against this sky (the same structural failure the sun-
button hero on the follow-the-sun break already worked around at
3.9–4.7:1, task-7-report.md) — so rather than swap the hue a second time,
the fill stays gold-as-illustrated and a darker rim of the same hue family
carries the WCAG 1.4.11 non-text floor instead. This is now an established
pattern in this app, not a one-off: **gold content keeps its hue and earns
contrast from an outline ring**, everywhere gold has to sit on the day sky.

**Resolved (2026-09-16, coordinator follow-up).** The centre disc first
shipped as `sun-deep` `#F0A72E`, which measured only 2.54:1 against the
rose petals — under this pairing's own 3:1 expectation, logged honestly
rather than rounded up. Fix: swap to the `sun` token (`#FFC64D`) instead of
inventing a new hex — 3.33:1 against the petals, clears the gate, and
happens to match the centre sun's own disc colour as a bonus. Face ink
stays legible on the lighter fill (9.12:1, more headroom than the gold
pairing had). No open call remains on this adjacency.

Supporting: arc/horizon stroke on day sky `#E4D6B8`; on sunrise sky
`#FAF4E8` at 65% opacity; moon craters `#E4D6B8`; night cloud `#454179`.

**Rules:** exactly one UI accent (teal). The emotional arc is carried by
sky colors, not extra hues. All text-bearing pairs must pass **WCAG 2.1
AA** (4.5:1 text, 3:1 large text/UI components); if a base token fails as
text, darken for text surfaces and keep the base for non-text (the
Ticklist accent/accent-hover pattern).

## 3. Typography

- **Display: Baloo 2** — weights 700/800. Greetings, headlines, titles,
  wordmark. Ek Type (Indian foundry), full Devanagari support — the
  regional-language future is in the typeface.
- **Body: Mukta** — weights 400/500/600/700. Labels, captions, time
  text, instructions. Also Ek Type, Devanagari-ready.
- Both on Google Fonts (self-hostable later). No Inter.

Scale in use (size / weight / face):

| Element | Spec |
|---|---|
| Greeting ("Hi, Aarav!") | 40 / 800 / Baloo, line-height 1.08 |
| Closing greeting / All done | 36–38 / 800 / Baloo, cream |
| Break headline ("Smell the flower…") | 29 / 800 / Baloo, ink |
| Now-playing title (cast) | 23 / 700 / Baloo |
| Now-playing title (phone) | 21 / 700 / Baloo |
| Session header name | 17 / 700 / Baloo |
| Touch instruction ("Touch the sun to start your day") | 19 / 600 / Mukta, ink |
| Night hint / sub-lines | 17 / 500 / Mukta, dusk on night |
| Heart line / break sub-line | 16.5 / 500 / Mukta |
| Pills ("12 min left", "Playtime!") | 13 / 600–700 / Mukta |
| What's-next pick badge ("Mumma & Papa's pick") | 11 / 700 / Mukta, white on teal, letter-spacing 0.02em |
| "UP NEXT" label | 13 / 600 / Mukta, uppercase, letter-spacing 0.06em |
| "WHAT'S NEXT" label | 12 / 700 / Mukta, uppercase, letter-spacing 0.14em, dusk |

## 4. Motion

- **Default: 400–600 ms ease-out.** No bounces or pops by default —
  springy moments are *earned* (sun tap, high five, break celebration).
- Sun return-to-arc / sunrise travel: 1.25 s `cubic-bezier(.3,.7,.3,1)`.
- Earned pop (squash & stretch): 550 ms — scale 1 → (1.22,.82) →
  (.92,1.14) → (1.06,.96) → 1, with a gold ring bursting outward
  (ringout: scale .7 → 2.1, fade, 800–900 ms).
- Ambient loops (always running, all pausable): sun breathe 3 s scale
  1→1.045; halo pulse 3–5 s; ray ripple 2.6 s staggered 150 ms/ray;
  star twinkle 3.4 s; cloud drift 30–44 s linear; heart beat 2.6 s
  (scale 1→1.3 at 12%); moon float 7 s with a little jump; moon sway
  6.5 s ±3°; moon one-eye peek every 8 s; z's float up 3.6 s.
- Breathing exercise: inhale 3.2 s scale →1.16 (eyes closed), exhale
  3.2 s back (o-mouth), 3 rounds.
- **Pause pauses time.** Pausing a video freezes the entire world —
  clouds, sun, heart, progress — not just playback.
- Night-light glow fade: 1.2 s. Sheet/overlay fades: 700 ms.
- What's-next reveal (all-done screen): cards float in staggered at
  700 ms, the pick lights up at 2700 ms. On the pick: badge pops in
  (scale 0→1, `cubic-bezier(.34,1.56,.64,1)`, 450 ms, 150 ms delay);
  card straightens out of its resting tilt and grows (scale 1.12,
  rotate 0), squash-popping there over 500 ms; three small hearts drift
  up from it in a staggered loop (3.6 s each, rise + fade, started at
  0.3/1.5/2.5 s) — pure decoration, hidden outright under reduced
  motion rather than left to freeze mid-air.
- **Playful placement is a static value, not a motion** — the small
  per-card tilt on every "parent's picks" grid (what's-next, the
  watching-screen strip, the choice-screen row) is baked into each
  card's resting `transform`, so it persists under reduced motion
  exactly as drawn; only the transitions/animations that move a card
  into or out of that resting state are shortened.
- Respect `prefers-reduced-motion`: ambient animations off, transitions
  shortened, static mid-states shown.

## 5. Components (with exact geometry, 390×844 frame)

- **Phone frame:** 390×844, corner radius 44, ink border (10px shadow
  ring in mocks).
- **Sun:** SVG face — disc r16.5 on 60-viewBox, 8 rays (round caps,
  width 3.4 idle / 5 rippling), dot eyes r1.9, smile stroke 2.2.
  Sizes: 64 px on-arc (watching), 110 px (cast), 150 px (sleeping),
  168 px (sunrise hero), 170 px (break guide). Halo: radial gold glow
  ~34 px beyond disc.
- **Moon:** disc r26 on 64-viewBox, craters r4 + r3, curved-eye smile;
  sizes 94–150 px. Gold four-point twinkles (11/9/8 px) around it.
- **Arc:** dashed stroke 2.5, dash `1 9`, round caps; horizon line
  solid 2.5. Day-screen arc: quadratic curve from (28,286) through
  control (195,50) to (362,286) in frame coords; sun's mid-session seat
  center = (212,169). Empty seat during breaks: dashed circle r11.
- **Pills:** radius 99; time pill: `rgba(250,244,232,.85)` bg, ink-soft
  13/600, padding 3×12; Playtime pill: sun bg, ink 13/700, padding 3×14;
  cast pill: `rgba(255,255,255,.78)` bg, teal-deep 14/600, padding 9×18.
  The time pill and the Playtime pill share one **status-pill slot**, top-right
  of the sky. The Playtime pill takes that slot on the breathing and find
  screens, where it is a status badge with no other job; on the playtime seam it
  stays in flow above the sun, where it is a mode badge introducing the break.
  Never place either pill directly above a heading — that is the eyebrow
  pattern, which this design does not use.
- **Break-screen suns:** three sizes, and the order between them is the point —
  find `min(30cqw,132px)` < seam `min(34cqw,160px)` < breathing
  `min(40cqw,190px)`. The breathing sun is largest because the child breathes
  with it; the find sun is smallest because swatches share its screen. They step
  up twice — to 154 / 184 / 214 at the tablet tier (container ≥601px) and
  176 / 208 / 240 at the desktop tier (≥1100px) — so the break screens grow as
  one piece with their headlines and keep the same order at every width.
  **Set these in CSS, never inline on the element** — an inline width cannot be
  overridden by a container query, which is how the find and seam suns came to
  be the only things on those screens that never scaled.
- **Stand-like-a-tree scene:** she is the hero — largest bounded element of
  the four break screens, square stage `min(46cqw,196px)` → `228px` (tablet,
  ≥601px) → `264px` (desktop, ≥1100px), a step above the breathing sun's own
  caps but kept close to them: the break-count digit row below adds height
  the other three screens' sub-lines don't carry, so the stage stays modest
  to keep the assembled cluster within the sibling screens' vertical budget
  (find's own cluster is the tallest of the other three, and is the
  reference — tree runs ~20-40px past it at every width, not the 90-120px
  the first, unconstrained pass measured). The sun perches beside her, small
  (~1/3 her height), lower-side, existing face/halo/no limbs — the stick-limb
  performer this scene replaces is retired. **Side-tree decor rule:** two
  simple rounded trees (stacked circles + a trunk rect, breathing's-clouds
  craft tier) at the screen's side edges, `top: calc(50% + 54px)` — off the
  *viewport's* vertical centre with a downward nudge, not the raw screen
  bottom, since `.kq-centercol` centres the whole cluster regardless of
  viewport height and an edge anchored to the true bottom clips off-screen
  on a short viewport. Teal foliage, ink-soft trunks, 62% opacity, gentle
  sway (same subtle tier as the sun's own wobble), one faster rustle on
  celebration. Mirrored hold: `scaleX(-1)` on the Lottie container only,
  never the stage — a bounce keyframe (`translateY`) and a static mirror
  both touch `transform`, and only different elements can carry both without
  one clobbering the other.
- **Break-count digit pattern** (shared: tree's two 5-counts, count-to-10
  next): the live count for a timed counting break renders as one BIG
  current digit with the still-to-come numbers trailing small and dimmed
  beside it (`5` then `4 · 3 · 2 · 1`, shrinking each step) — never a plain
  small text sub-line, which read as too quiet for a MOVE-bucket break.
  `--cnt` (36/44/54px across the three tiers) sizes the big digit; the
  trail sits at `--cnt * .48`, `var(--ink-soft)`, 72% opacity. The digit
  pops on every change (the existing squash-stretch `pop()` helper,
  retriggered — reduced motion needs no special-casing: `pop()`'s own
  `later()` cleanup clamp only delays removing the animation class, and the
  animation itself is already crushed to instant by the global
  `.reduce-motion` rule). Colour was a two-round call: a sun-gold chip
  first, then overruled — flat sun (`#FFC64D`) or sun-deep (`#F0A72E`) text
  measures 1.2–1.9:1 against this app's cream sky gradient (`#FDF8EC` /
  `#F7EBD2` / `#F1E2C4`), nowhere near the 3:1 AA floor for large text this
  project holds every game element to. Plain **teal** (`var(--teal)`, the
  app's one UI accent) measures **4.04–4.88:1** across those same three sky
  stops — clears 3:1 everywhere with real margin — so the digit sits
  directly on the sky, no badge. The whole count row is `aria-hidden`; the
  break's own headline stays the sole accessible carrier, so a five-times-a-
  break digit swap never spams a screen reader's `aria-live` region.
- **Break-count digit BALLOON** (user request 2026-09-15, "make them like
  coming on balloon" — superseding the flat-teal digit above, which both
  break screens rode on until this session): the big current digit now
  arrives riding a brand-hue balloon instead of sitting bare on the sky.
  Balloon over ball — the app already has an established balloon
  vocabulary: the splash's own KidQ letters (the splash screen itself,
  `kidq-desktop-app.css:89–141`) are glossy inflating balloons, four brand
  hues, squash-stretch inflate. This reuses that vocabulary rather than
  inventing a new shape, cycling one hue step per digit change
  (`hue-<name>` class, swapped by a shared `setBalloonHue()` helper both
  break screens call): **teal → rose → coral → dusk → repeat**.
  **Why rose, not gold** (2026-09-15, user-directed — the first of two
  deliberate divergences from the splash): gold was the original fourth
  hue, matching the splash's own "i". Measured against this app's warm
  cream/amber sky it came back a structural failure, not a narrow miss —
  the same finding already on record for the flat sun icon: no sun-gold
  value clears 3:1 against this sky at any lightness that still reads as
  gold. Darkening gold itself would only trade one problem for a muddy
  near-brown that no longer reads as gold, so it was replaced outright with
  **rose** (H≈340°, distinct from teal H≈171/coral H≈8/dusk H≈261) — a
  genuinely different, unclaimed hue — after an outline-only fix (keeping
  gold, adding a stroke for edge definition) was considered and turned
  down in favour of a real colour change.
  **FLATTENED AND MUTED** (2026-09-15, the second divergence from the
  splash): this component originally borrowed the splash's own 5-stop
  glossy radial-gradient recipe verbatim (near-white specular highlight
  through a fully-saturated "true hue" to a near-black shadow — a shiny 3D
  sphere), with an explicit `circle calc(var(--cnt) * .729)` radius so a
  small round digit badge's own centre landed past the gradient's highlight
  band. Live in the browser, across repeated break screens rather than the
  splash's one-time entrance, that read as brighter and glossier than the
  rest of the app's own language, which is flat illustration throughout
  (sun, moon, clouds, the tree-pose figure — none of them glossy-shaded).
  Replaced with a simple 2-stop soft `linear-gradient` (135deg, a light
  tint down to a single muted base tone at 65%) — a hint of directional
  light, not a sphere; the old radius trick is moot once the gradient is
  linear rather than radial, since there is no highlight band to steer the
  badge's centre away from. Base tones pulled DOWN in saturation toward the
  app's own established palette register, not just darkened — teal's base
  is literally `var(--teal)` itself, this project's one UI-accent token:
  **teal `#1F7A6D`, rose `#A8506E`, coral `#C2543F`, dusk `#6F5AA8`.**
  **Digit ink per hue, measured** against the flattened recipe's base tone
  (`kidq-desktop-app.css`'s own copy of this table sits above
  `.kq-digitballoon.hue-teal`; supersedes the glossy-recipe numbers this
  table originally carried, which were measured against a different hex
  set entirely):

  | hue   | base tone | cream (digit text) | vs bright sky (tree) | vs dim sky (count) |
  |-------|-----------|---------------------|------------------------|-----------------------|
  | teal  | `#1F7A6D` | 4.72:1              | 4.37:1                 | 3.94:1                |
  | rose  | `#A8506E` | 4.75:1              | 4.40:1                 | 3.96:1                |
  | coral | `#C2543F` | 4.14:1              | 3.83:1                 | 3.45:1                |
  | dusk  | `#6F5AA8` | 5.18:1              | 4.80:1                 | 4.32:1                |

  All four clear the 3:1 AA large-text floor for the digit **text** (the one
  piece actually carrying the count) and the same self-imposed 3:1 floor
  this project holds decorative balloon-vs-sky contrast to (the balloon is
  `aria-hidden` pure decoration, so this is past what WCAG 1.4.11 itself
  requires) — each hue with more margin than the old glossy recipe had for
  teal/dusk, and much more than the old recipe's coral, which narrowly
  missed on the dimmed sky (2.78:1, logged as a known gap at the time):
  flattening incidentally fixed that pre-existing narrow miss too, not just
  the brightness complaint. Cream still works for digit text on all four
  hues, no ink-flip exception — gold was the only hue that ever needed one,
  and it is gone from the rotation.
  **Knot:** a darker shade of the same hue's own base tone (`#11433C` teal,
  `#5C2C3D` rose, `#6B2E23` coral, `#3D325C` dusk) — the shape's own shadow
  colour, not a new one. **String:** a
  short, slightly-tilted `1.5px` thread in `var(--ink-soft)`, neutral across
  all four hues (real balloon string doesn't recolour with the balloon) and
  deliberately short — a long one is more rigging than read at this badge
  scale. **Entrance diverges by screen, both reusing existing vocabulary
  rather than inventing a third:** tree's balloon bounces in with the same
  `pop()` squash-stretch the bare digit used before (now targeting the
  whole balloon wrapper, so body/knot/string/digit bounce as one unit) —
  energetic, like the splash's own inflate, same hold-chain trigger, same
  re-entrancy discipline. Count's balloon instead floats gently up into
  place (`kq-balloonfloat`: `translateY(14px)→0`, `.4→1` opacity, no scale,
  no squash-stretch) — replacing the flat digit's old quiet scale-pulse
  (`kq-countpulse`, retired) with a motion that still reads as "the settle
  game," now carried by the balloon instead of the bare glyph. Both
  keyframes' `100%` state matches the wrapper's own unanimated rest state
  exactly (`transform:none`, `opacity:1`), the same discipline `pop()`
  itself already held, so reduced motion's blanket crush to `.001ms`
  (`kidq-desktop-app.css` reduced-motion block) never leaves a balloon stuck
  mid-bounce or mid-float — confirmed live, both screens, both motion modes.
  **Sharing judgment call:** one shared CSS component (`.kq-digitballoon`
  + `.kq-balloon-body/-knot/-string`, hue classes, the `setBalloonHue()` JS
  helper) covers the balloon shape and hue-cycling identically for both
  screens — that part clearly wanted one implementation, not two
  copy-pasted balloons. The *entrance* animation stays two separate,
  screen-scoped rules (`#screen-tree .kq-digitballoon.tapped` vs
  `#screen-count .kq-digitballoon.pulse`) rather than one shared "balloon
  entrance" abstraction: tree and count already used two different
  triggering helpers before this session (`pop()`'s two-hardcoded-class
  design vs count's own small remove/reflow/add re-trigger, brand.md's own
  earlier note on this) for reasons specific to each screen's timing
  structure, and forcing them into one shared entrance function would have
  meant either widening `pop()` past its established two-class shape or
  losing the "bounce vs float" distinction the design brief asked for by
  name — judged not worth it for two three-line CSS rules.
- **Splash backdrop: night sky + glowing balloons** (user-chosen 2026-09-16,
  after evaluating this treatment side by side with a plain-balloon
  version and a Tangled-style paper-lantern version): the splash's
  unconditional, default state is now a night sky (`.kq-sky--night`, §2)
  behind four large flat balloons, edge-anchored and partially cropped off
  the screen's corners/edges, each carrying a soft warm static halo — the
  Givingli reference (this file's own locked visual reference, top of
  file — warm cream, floating illustrated objects) applied to this
  screen's own edge/crop structure. All four `.kq-digitballoon` hues
  (teal/rose/coral/dusk, the flattened recipe in the bullet just above)
  are used, one per balloon, none skipped.
  **Flat balloons, glossy letters — a figure/ground decision, not an
  accident:** the backdrop balloons deliberately keep the flattened/muted
  finish, while the hero KidQ letters they frame keep their own original
  glossy 5-stop recipe untouched (`kidq-desktop-app.css:89–141`). The flat
  finish is what lets the balloons recede as backdrop instead of competing
  with the glossy letters as a second focal point — the same screen
  renders the same four hue names two different ways at once on purpose,
  the flatter one always behind the glossier one.
  **Static halo, no pulse:** a second, hue-tinted `drop-shadow` behind each
  balloon, blurred, never animated — this project's anti-overstimulation
  argument (top of file) rules out a pulsing or flickering glow the same
  way §6 rules out points, badges and streaks: affirmations, not rewards.
  **Night, not predawn — the sky-as-timer arc gets its starting frame:**
  the splash previously opened on the same predawn sky the login screen
  uses; it now opens on full night, one step earlier on the sky-as-timer
  arc (§1) than predawn was — the day genuinely has not started yet when
  the app opens, and it begins only once the child touches the sun on the
  sunrise screen ("Touch the sun to start your day"). Night splash flowing
  into a sunrise screen is a more legible first beat of that arc than
  predawn flowing into a second, separate predawn (the login screen keeps
  its own predawn sky unchanged). This was a readability finding as much
  as a narrative one: measured (not assumed) against the letters' own
  dominant gradient tone at their actual on-screen position, all four
  letters contrast measurably better on night than on predawn — e.g. teal
  2.59:1 vs 1.71:1, dusk 2.36:1 vs 1.56:1 — so the arc change and the
  contrast improvement point the same direction, and no retuning of the
  letters themselves was needed.
- **Count-to-ten scene:** eyes-closed sun as hero, sized like breathing's own
  (`min(40cqw,190px)` → `214px` → `240px`) — the closest sibling in
  complexity: one bounded hero, no side decor, no dots, no new assets of any
  kind (the cheapest break in the set, deliberately). Eyes are the one new
  mechanism this scene adds. **Donor: BREATHING's own `.bsun` dual-group
  `eyesOpen`/`eyesClosed` markup** — the only sun with a working eye
  *toggle* — not the sunrise sun's eyes, whose unscoped
  `.eyes-awake{opacity:0}` only lifts under `.screen.risen`, a class
  `#screen-count` never gets ("Open your eyes!" would render no eyes at
  all). This is new markup + new ID-scoped CSS, not shared-component reuse —
  no shared sun component exists yet; rays and mouth stay the fixed smile
  every static sun already uses, no toggle needed there. A single state
  class (`.dim`, on `#screen-count` itself) drives both the sky dim and the
  closed eyes together, since the sequence pairs them at the same two beats
  (entry closes both, "Open!" opens both) — reusing the existing
  `.kq-duskveil` overlay (`kidq-desktop-app.css:66-68`) that already powers
  the watching screen's own dusk, pinned to a NEW ~0.25 opacity of its own
  (`.screen.setting`'s existing 0.85 is a full dusk, far too strong for
  "dims slightly"). **Digits walk while the eyes are closed, on purpose:**
  the child playing can't see the screen, but a peeking child (guaranteed at
  this age), a watching parent, and the sibling-break visual-count pattern
  all still want it, so the sub-line stays visible and `aria-hidden` (never
  `aria-live`) exactly like every other break's count row — the headline
  alone carries the accessible experience. **Digit entrance diverged from
  tree's own `pop()` from the start:** count is the settle game, so each
  digit's entrance was a quiet ~300ms scale-up pulse (`kq-countpulse`:
  `.82→1` scale, `.55→1` opacity), not tree's springy squash-stretch bounce
  — its own small remove/reflow/add re-trigger helper, not a widened
  `pop()`, since that helper's two hardcoded class names (`tapped`/
  `moontap`) weren't reusable for a third animation only this screen
  needed. **Superseded 2026-09-15** by the balloon-float entrance in the
  break-count digit BALLOON bullet above (`kq-balloonfloat`, on the same
  re-trigger helper, now targeting the balloon wrapper) — the "quieter than
  tree, no bounce" *intent* survives unchanged, just carried by the balloon
  instead of the bare glyph now. **Trail direction is the
  opposite of tree's:** tree counts down and its trail previews what's
  still coming; count-to-ten counts up and its trail shows the
  WALKED-THROUGH numbers behind the current one — at nine numbers wide (one
  more than tree's own four-wide max) this was the width risk named and
  measured explicitly (item 44): the shared `.kq-breakcount-trail` size and
  `" · "` punctuation turned out to already carry real margin (180px
  against 330px usable at the narrowest tier) with no override needed,
  `font-variant-numeric:tabular-nums` added only to keep that measurement
  stable as the digits themselves change width. Digit colour was the SAME
  shared teal (`var(--teal)`) as tree's own — re-measured, not inherited
  blindly, against THIS screen's dimmed sky specifically: `.kq-duskveil`
  composited at 0.25 opacity over the day sky's own three gradient stops
  shifted the contrast to **3.72–4.05:1** across the composited gradient —
  still clearing the 3:1 AA large-text floor with real margin, closer to it
  than tree's own 4.04–4.88:1 against the undimmed sky, but not close
  enough to need a different colour. **Superseded 2026-09-15:** the digit
  now sits on a balloon, not the bare dimmed sky — its colour is decided by
  which hue balloon it's currently riding (cream, or ink on gold; table in
  the break-count digit BALLOON bullet above), not by a single fixed teal
  any more. The dimmed-sky number above stays true as history (it's why
  teal was the safe default before the balloon), and the *balloon's own*
  contrast against this same dimmed sky was re-measured fresh for the
  balloon build (see above) rather than assumed to inherit a pass.
- **Player card:** 16:9, radius 24, soft shadow `0 12px 28px -16px
  rgba(46,42,36,.4)`, at (20, 310) width 350. Corner pause: 44 px cream
  circle, teal-deep icon, top-right 14,14. Playing bars: 3 teal bars
  equalizer, bottom-left.
- **Day progress bar:** height 12, radius 99, gradient `#F7EBD2` →
  `#FFC64D` 34% → `#C9B8E8` 68% → `#2B2955` 100% (the day in a bar);
  unplayed portion veiled `rgba(250,244,232,.78)`; knob 20 px sun-gold,
  3 px white border.
- **Queue cards:** 124×70, radius 14; thumbnail card has 2 px
  `rgba(46,42,36,.1)` border. A queue simply ends after its last real
  card — there is no end-of-queue card or marker. The session's own end
  is carried by the flow itself (last video → sunset → all-done), not
  by anything inside the queue; a short row that visibly stops is
  already a visibly finite one. (An earlier "The End 🌙" card existed
  only as dead CSS, never wired to any queue render — removed outright
  rather than given a replacement treatment.)
- **Playful placement** (what's-next cards, the watching-screen picks
  strip, the choice-screen "or pick one of Mumma & Papa's videos" row):
  every card in these three "parent's picks" grids rests at a small
  tilt, one shared repeating cycle — card 1 -2.5°, card 2 1.8°, card 3
  -2°, repeating from card 4 on. **Straight means "this one" — tilted
  means "available."** The what's-next pick straightens (and grows,
  scale 1.12) when the child's day ends on it; the watching strip's
  now-playing card stays straight the whole time it's current; every
  other card - including watched ones, which only ever lose opacity,
  never their tilt - stays tilted. The choice screen's cards have no
  such "current" card, so all of them stay tilted.
- **What's-next pick badge:** pill, radius 99, teal bg, white 11/700
  Mukta text + a small white heart (12 px, same beating icon used
  elsewhere), padding 4×11, soft shadow `0 3px 10px rgba(0,0,0,.35)`,
  centered on the card's top edge (top -13px). Reads "‹household
  label›'s pick" - "Mumma & Papa's pick" today, sourced from the same
  session data as the picked-by credit everywhere else, never
  hardcoded. White-on-teal here measures 5.17:1, clearing the 4.5:1
  small-text bar with room to spare.
- **Drifting hearts** (what's-next pick, choose stage only): three
  small coral hearts (18/14/15 px), positioned around the card's
  edges, each rising and fading on its own 3.6 s loop, staggered
  0.3/1.5/2.5 s. `aria-hidden`, pure decoration - hidden outright under
  reduced motion.
- **Big pause (cast):** 76 px teal circle, white icon, shadow
  `0 14px 26px -14px rgba(22,89,79,.55)`.
- **High five:** 96 px cream disc, 🖐 at 42 px, breathing pulse 2.6 s,
  shadow `0 16px 34px -16px rgba(0,0,0,.55)`.
- **Avatar:** 40 px teal circle, white Baloo initial 18/800.
- **Heart:** 17 px coral SVG; outline (unfilled) variant = "nothing
  picked yet".
- **Breath dots:** 12 px circles, `rgba(46,42,36,.16)` → sun-deep when
  filled.
- **Props on clouds** (breaks): flower (coral petals ×5, sun-deep
  center, teal stem) and candle (cream body, gold flame) each float on a
  small white cloud.
- **Focus states:** `:focus-visible` = teal-deep stroke on the SVG disc
  (light screens) / teal-on-dark (night screens); buttons get 3 px
  outline, offset 2–3 px.

## 6. Voice & copy

Warm, short, spoken to the child in second person. Parents get quiet
factual labels. Never nagging, never gamified.

- Greetings are time-neutral, not time-aware — a session can start (and
  end) any time of day, so "Good morning, Aarav!" / "Good night, Aarav!"
  are wrong the moment they land outside their literal window. Use
  "Hi, Aarav!" to open a session and "Bye bye, Aarav!" to close one
  (all-done high-five, and the night-light reopen screen), regardless of
  the visual night sky those closing moments sit on — that sky is the
  app's own day-is-over motif, not a claim about the real clock.
- Instructions are one line, verb-first: "Touch the sun to start your day",
  "Keep your head still — follow me with your eyes!"
- The parent's presence is always credited: "Mumma picked 3 videos".
- Affirmations, not rewards: "You did it! ✨", "Here we go! ☀️" — no
  points, badges, streaks.
- Endings are warm and final: "All done for today!", "The sun will be
  back tomorrow ☀️". The next step is concrete and parental: "Now:
  blocks with Dadi 🧱".
- No-session copy blames no one: "The sun is still asleep!" + "Ask Mumma
  to pick today's videos".
- Emoji are functional objects (🌙 ☀️ 🖐 🧱 ♥), used sparingly, one per
  line max.
- **"Touch", not "tap" (2026-09-15).** Group feedback: family members who
  aren't comfortable with apps don't reliably know "tap"; "touch" is
  universal and warmer. All child-facing instruction and aria-label copy
  uses "touch" (e.g. "Touch the sun to start your day"). Interaction/build
  vocabulary — CSS class names like `.tapped`, code comments about tap
  targets — is unaffected; this is copy only.

## 7. Accessibility

- **WCAG 2.1 AA** on every text-bearing pair (project-wide standard).
- Sun yellow is never a text surface; teal-deep is the text-safe teal on
  light; dusk and cream carry text on night skies; white on the raw
  `teal` token (the what's-next pick badge) measures 5.17:1, clearing
  the 4.5:1 small-text bar directly - no darker substitute needed here.
- All interactive elements are real buttons with aria-labels that
  describe the outcome ("Start today's watching session", "Night light —
  touch to turn on or off" with `aria-pressed`).
- Live-changing captions (break phase lines) use `aria-live="polite"`.
- Full `prefers-reduced-motion` support.

## 8. Engineering notes (for the eventual build)

- PWA, phone-first (390×844 design frame), Android proportions.
- Casting in MVP: TV plays the stream (official embedded player rules —
  see the YouTube/DPDP sheet); the phone shows the sky and becomes the
  session clock + remote. Screens stay a "living sky", never a black
  cast void.
- Do not animate CSS `offset-path` (reproducibly crashes the artifact
  viewer's compositor); use transform keyframes sampled along the arc.
  Avoid `filter: drop-shadow` inside opacity-animating layers.
