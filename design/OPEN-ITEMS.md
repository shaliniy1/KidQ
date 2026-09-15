# Open items — child mode

Everything still unresolved between this design and the rest of the repo, with
an owner against each. Tick items off here as they settle; delete nothing, so
the reasoning stays readable later.

Status: `[ ]` open · `[x]` done · `[~]` decided, not yet built

---

## Needs Shalini

### [ ] 1. Expose playback progress from `KidQPlayer`
The sky-as-clock needs position while a video plays. The player already tracks
`time` and `duration`, normalised across providers (YouTube polled every 500ms,
HTML5 via native `onTimeUpdate`), and renders them in its own seek bar — they
are simply not exposed.

**Ask:** `onProgress?: (time: number, duration: number) => void`, fired where
`setTime` / `setDuration` already run. Purely additive; `admin/` is unaffected.
`onEnded` already covers session advance.

### [ ] 2. Let child mode suppress the player's built-in controls
Decided: **child mode is play/pause only.** The player always renders
play/pause, a clickable seek bar, a `0:12 / 3:45` readout and mute, with no way
to restrict them. The seek bar gives a child scrubbing inside a video their
parent chose; the readout puts a clock beside a sun that exists because a child
aged 0–6 can't read one.

**Ask:** `chrome={false}` or `controls="none"`, admin keeping today's behaviour
by default. Child mode draws its own control and drives playback through the
handle's existing `play()` / `pause()`.

### [x] 3. Confirm what parent attribution means
**Settled: one family label.** It reads "Mumma & Papa" everywhere — never a
different parent per video.

**This removes the ask rather than creating one.** No "who added this" field on
the library entry, and no second parent figure on the family: one account per
family with a single `parent_name` is already enough. The prototype now carries
the label on the *session* rather than on each video, which is the shape the API
can back today.

**The string is fixed for the MVP**, decided rather than pending: not derived
from `parent_name`, not settable by the parent. Logged as item 23 so the cost is
visible, but nothing here is blocking.

---

## Needs both — design input into the session-queue slice

`docs/status.md` lists "the session queue with break slots, and the Orange Break
Agent with its activity library" as a next slice. This design is that surface,
so these are offered as input rather than raised as gaps.

### [x] 4. A session, distinct from the library
Shipped in PR #4: `POST /children/:id/sessions` returns a started session with
ordered `slots`.

### [x] 5. Per-video duration
Shipped: slots hold whole videos, and `PATCH /sessions/:id/items/:itemId` records
`watched_seconds`, which is what the sun needs.

### [~] 6. Break slots on the session
Shipped as `break_after` per slot (`MOVEMENT` / `QUIET` / `WIND_DOWN`), and the
"nearest video boundary" rule matches this design exactly. **But the cadence
disagrees — see item 24.**

### [ ] 7. Yesterday's session
Powers the replay path on the no-session screen. `GET /children/:id/sessions`
returns the log; whether a past session can be replayed as a new one is unclear,
and "there's no resume" suggests not.

### [ ] 8. "What's next" cards
Shown after the session ends. Currently invented, with no source.

### [ ] 24. Break cadence, and the missing wind-down
Both specs give a 30-minute session two breaks, but place them differently.

| | This design | Sessions API |
|---|---|---|
| Rule | 1/3 and 2/3 of the minutes | one per 15 minutes |
| 30 min | ~10 and ~20 min | ~15 min, then a terminal wind-down |
| Final break | none | mandatory `WIND_DOWN` |

The real gap: **child mode has no wind-down break.** Its ending is the sunset
and the all-done screen — which do wind-down work, but are not a break slot and
the child does not act in them. Either the design grows a wind-down break before
sunset, or the API's terminal slot maps onto the existing ending.

`MOVE` and `SETTLE` map onto `MOVEMENT` and `QUIET`; only the third type is new.

### [ ] 9. Reconcile casting
This design assumed Google Cast in the MVP, with the child's device as sender.
`docs/api/README.md` ships a thin hosted wrapper per TV platform instead, and
notes YouTube embeds need a real web origin. The prototype's cast screen is a
visual mock, so nothing is blocked yet — but the two directions disagree and
only one can be built.

---

## Ours — design and porting

### [x] 10. Document the game colours in brand.md
**Done: documented, and both undocumented fills deepened.** Of the two options,
moving the fills onto documented tokens was not open — there is no blue token at
all, and the only green-ish token is `teal`, which is the single UI accent and
must not double as game content. So `brand.md` section 2 now carries a **game
content colours** table.

Retuning went with it, in two passes. The first only deepened blue and green to
match red's contrast, and that was the wrong axis: the user flagged the red as
looking dark, and measuring in OKLCH showed why. Red was in fact the *lightest*
of the three (L 58.3 against 55.1 and 54.1) — what read as dark was **chroma**,
0.146 against pure red's 0.258, at hue 32.6 which leans orange. Low saturation
plus an orange lean is terracotta, and a child asked to say the colour out loud
has to see red.

So the set is now tuned as a set: one lightness (L≈58) and one chroma (0.165)
across all three, which is what stops any one swatch reading as the dark one.
Red `#CC4C40`, blue `#217AD8`, green `#049640`, at 3.02–4.24:1 across the day
sky's three stops — still above 3:1 everywhere. Chroma deliberately stops short
of the crayon primaries at 0.19+, which pass contrast just as well but go
electric against this warm sky and cut against `brand.md`'s rule that the
emotional arc is carried by sky colour rather than extra hues.

The graphical-object exception still means 3:1 is not *required* here; the
argument for clearing it anyway is that a child with low vision has to see the
swatch to play at all. Green is a true green rather than a deeper teal, so game
content never reads as the UI accent.

Was for a while: blue `#3A75B0` and green `#3F7F52` (the first pass), and before
that the pastels `#6FA8DC` at 1.98–2.38:1 and `#5FA88A` at 2.20–2.66:1.

Still pointer-only in the sense that the colour is named in speech and shown as
a swatch — see item 14 for dropping colour as the axis entirely.

### [x] 11. Move the "Playtime!" pill out of the eyebrow slot
**Done, both halves.** On the breathing and find screens the pill has moved out
of `.kq-centercol` and into the status-pill slot — top-right of the sky, the
same absolute position the time pill holds on the watching, choice and cast
screens. The position is now a shared rule (`.kq-timeleft, .kq-ptpill.slot`)
carried through all three container tiers, so the two pills cannot drift apart
in the slot. Each keeps its own fill. The seam screen keeps the pill in flow
above the sun, untouched, because there it is a mode badge introducing the
break rather than a status badge.

The size drift is corrected to brand's 13px / 700 / padding 3×14. `brand.md`
section on pills now documents the slot, both uses, and the rule that neither
pill may sit directly above a heading.

### [x] 12. Heading structure on the watching and cast screens
**Done.** Every `<h4>` chosen for its size is gone. On watching and choice,
"Aarav's watch time" is the `h1` and the video title the `h2`; on choice that
also puts the levels in DOM order, since the header block precedes the
headline. The styling moved off the tag onto classes — `.kq-head h4` became
`.kq-head .name`, `.kq-now h4` became `.kq-now .title`, across all tiers — so
nothing renders differently.

The cast screen has no header block to promote, so its `h1` is the video title
itself: that screen is *about* what is playing on the TV, and an invisible
heading added only to satisfy the outline would be a crutch. It needs no `h2`.

Checked across all twelve screens: each now opens with exactly one `h1` and
skips no level. `#screen-all-done` carries two `h1`s in the markup, but
`.kq-donehead.gn` is `display:none` until the hi-five, so one is live at a time.
`#screen-splash` has no heading and keeps its `aria-label` — it is an opening
animation, not a page.

### [x] 13. Spoken instruction on the activity breaks
Done in the prototype. Find speaks its full instruction on entry including the
colour, and "You found them!" on the tap; breathing speaks only its opening
line, because the sun's swell and shrink guides the rest and narrating six
half-breaths would talk over the quiet. Voice prefers `en-IN`. `showScreen`
hushes, so a line never carries into the next screen, and the breaks still work
with speech unavailable.

**Settled: the device voice ships in the MVP.** No assets to record, nothing
extra to host, and it speaks whatever copy a break carries, including a colour
name chosen at runtime. Accepted trade: warmth and accent vary by device and are
outside our control, and some platforms fetch voices over the network. Recorded
voice in Indian English is a **post-MVP upgrade, not a blocker** — it would give
every child the same voice on every device.

### [ ] 23. "Mumma & Papa" is wrong for some households
Post-MVP. The label is a fixed string, so every family reads "Mumma & Papa"
whatever their household actually is — a single parent, grandparents raising a
child, or a family who say Amma and Appa. In a product whose whole emotional
core is the child feeling a parent's presence, naming the wrong person works
against that.

Making it settable needs nothing new from the API: onboarding already collects
`parent_name`, and a household display name would sit beside it.

### [ ] 21. No way to turn the voice off
Speech plays automatically with no preference to disable it, and there is no
sound control anywhere in child mode (the jingle and chime have the same gap).
`break_type` already exists as a per-child setting, so an audio preference has a
natural home on the parent side.

### [ ] 22. No way to hear the instruction again
Deliberate for now: a replay control would be a second tap target on a screen
whose rule is one action, and repeating unprompted would be nagging, which
`brand.md` section 6 rules out. But a child who misses the line has no recourse.
Worth revisiting with recorded voice, when a replay could be cheaper to place.

### [ ] 14. Consider non-colour break rounds
About 1 in 12 boys has red-green colour vision deficiency, mostly undiagnosed
before age 5. The game has no fail state, so it is unfair rather than punishing
— but "find 3 round things", "3 soft things", "3 things bigger than you" are
colour-blind-safe, richer, and need no swatch at all.

### [ ] 15. TV remote focus states
The integration guide requires every control focusable and arrow-key operable,
with no hover-only UI. The prototype is pointer-and-hover first. Partly solved
already: the player handles TV Back keys (Tizen `10009`, webOS `461`).

### [ ] 16. Port the prototype into `web/`
Vanilla HTML/CSS/JS with one closure-scoped state machine → React components
under the App Router. Layout is driven by container queries on `#app` at three
tiers, with one element inventory at every size.

### [x] 17. Three more activity breaks
**"Follow me with your eyes" is done — shipped as follow the sun**, built on
`design/follow-the-ball-break` (Tasks 1–10 plus the closing verification
sweep) per `docs/superpowers/specs/2026-09-14-kidq-follow-the-ball-break-design.md`.
**"Stand like a tree" is done too** — see item 43. **"Count to 10, eyes
closed" is done too, the last of the three** — see item 44. The cadence and
rotation supported all three with no further change beyond the per-game
work each one's own spec called for.

Building it surfaced follow-ups that were logged in the spec (sections 11 and
13.7) but not yet tracked anywhere in this file — now items 26–35 below.

### [ ] 18. Decide: resume or restart a half-watched video
Returning to a partly watched video currently restarts it at 0:00. Resuming
where the child left off is the alternative. Deferred once already.

### [ ] 19. Confirm the session strip with the group
The strip lets a child switch video mid-session, which supersedes the group's
earlier "no switching before completion". Already flagged, and easy to revert.

### [x] 20. Sync the phone mockups
**Moot — the file doesn't exist in this repo.** `kidq-mockups-v1.html` was a
static design artifact from the pre-prototype phase, kept in a separate,
non-git folder (`Downloads/KidQ/`) outside this repository; it was never
committed here and this repo's `design/mockups/` only ever held the later
desktop-pivot mockup. The actual up-to-date reference for child mode is
`design/prototype/` itself — the live interactive build, which every round's
PR work has kept current by construction. Nothing to sync.

### [~] 25. Can a small child actually get out of a break?
A break ends on "Touch the sun for your next video", and nothing continues until
that tap lands. Raised as a doubt that a child at the younger end of 0–6 will
reliably manage it, and that they are then stuck with no way forward.

The tap is not arbitrary — it is the thing that makes a break a break.
`concept.md` ends its loop with "Nothing plays without the tap"; `README.md`
draws the line as "autoplay runs between videos, but never **out of a break**",
because sliding straight from an activity back into video undoes the
interruption the activity existed to create. So autoplaying out of a break is
not a small change: it removes the mechanism, and the break becomes an interlude
between videos rather than a stop.

Against that, three things make the worry real rather than theoretical:

- **The child has done this before, but only once.** The same gesture starts the
  day on the sunrise screen. Mid-session, after an activity, there is no
  equivalent teaching moment and no prompt if they simply do not act.
- **On a television it may not be their tap to make.** Item 9 is unresolved, and
  on the Cast path the tap arrives from the sender — the parent's phone, which
  in the flow `concept.md` calls natural is in another room. A remote (the
  wrapper path) a grandparent can use; a parent's phone they cannot.
- **There is no nudge and no timeout.** The sun waits indefinitely and says
  nothing more. `concept.md` treats waiting as a designed state, not an error,
  which is right for a child who wandered off — and wrong for one who is sitting
  there not realising it is their move.

Directions, not yet chosen:

1. **Keep the tap, make it easier to find.** A gentle repeat of the spoken line
   after a few seconds, or the sun's existing breathing animation growing more
   pronounced. Cheapest, keeps the principle intact. Bounded by `brand.md`'s rule
   against nagging, and by open item 21 — there is still no way to turn the voice
   off.
2. **Keep the tap, add a quiet timeout.** After a long wait with no tap, end the
   session gently into the all-done screen rather than advancing into a video.
   Honours "nothing plays without the tap" literally, since nothing plays.
3. **Autoplay out of the break.** What was proposed. Solves it outright and costs
   the principle; would need `concept.md` and `README.md` amended rather than
   worked around.
4. **Make it a parent-side setting.** Defers the judgement to the family. Adds a
   preference where `break_type` and `session_minutes` already live, so it is
   cheap on the API — but a setting is also a way of not deciding.

**Decided (user, 2026-09-14): direction 1+3 combined — the choice screen stays
and auto-advances.** The break still ends on the choice screen, showing the
session strip, the time left and what is next. A tap still wins: the sun plays
the next video, a card plays that one instead. If neither comes within a few
seconds, the next video starts on its own.

This reverses "nothing plays without the tap", and the reversal was raised as a
conflict and confirmed rather than assumed. `concept.md`, `design/README.md` and
the comment above `autoAdvance` have all been amended, so no document still
asserts the old rule. The principle that survives is narrower and, on reflection,
the one that was actually load-bearing: **the interruption is the activity plus
the choice screen** — not an indefinite wait that a three-year-old has no way out
of.

**Not yet built.** It is a change to `startChoice`, affecting all three breaks,
and it is deliberately not being folded into the follow-the-ball plan mid-flight.
Implementation notes for whoever picks it up:
- the timer must use `hold()`, not `later()` — `later` clamps to 200ms under
  reduced motion and would make the choice screen flash past;
- it must be cancelled by any tap, and by `showScreen`/`clearTimers` like every
  other timer on that screen;
- the wait wants tuning against a real child, not a number chosen at a desk;
  ~4s was the starting point discussed.

---

## Surfaced by follow the sun (item 17), not yet tracked elsewhere

Logged in the follow-the-ball-break spec (sections 11 and 13.7) while building
the break; none are fixed there, and none are fixed by this sweep.

### [ ] 26. `brand.md:160` no longer matches what break screens render
Documents an empty seat as a dashed circle (`r11`) during breaks. No break
screen implements that — they are full-bleed sky. Correct the line to say so.

### [ ] 27. `brand.md:214`'s instruction-voice example is stale
Uses *"Keep your head still — follow me with your eyes!"* as the canonical
instruction-voice example — this break's round-1 copy, before the §13
redesign. The break now says "Follow the sun! / Keep your head still — just
your eyes" (and "Where's the sun? / Find it each time it hops" under reduced
motion). Update the example.

### [ ] 28. The lean-back multiplier (~1.7×) is still missing
**Measured (task-7-report.md, Step 2): no hierarchy inversion at any of the 8
tested `far` widths.** Far hero diameter = `clientWidth/13.4` (2° × ppd, ppd =
`clientWidth/26.8`) — 143px at a 1920px container, still under the find sun's
176px cap at every tested width. The hero would only exceed that cap above
**~2358px** container width (`176 × 13.4`) — a width this sweep did not test
and that no realistic device hits today, so the inversion the spec originally
predicted is not currently present.

The multiplier stays open anyway, but on the spec's real ground: **angular
size**, not a present pixel-overflow inversion. At a fixed 2° visual angle,
the far-context sun subtends the same angle on a 43" TV at 2m regardless of
container pixel width — pixel size vs. the find sun's cap is a proxy that
just doesn't happen to trip yet at realistic container widths. The actual
problem the multiplier fixes is that, without it, the far-context sun still
reads *smaller in visual angle* than the near-context breathing/find suns do
on their own devices (spec §11 item 3: ~2.9° on a 55" TV at 3m vs. ~4.9° on a
phone, where `40cqw` binds under the 190px cap) — a real hierarchy problem
independent of whether any single element's pixel size happens to cross
another element's cap at today's tested widths.

Belongs in `brand.md` section 5 beside the tier table, scaling hero suns, the
big pause and headlines for `far` context — not just this ball. Must land as
one `--lean` custom property folded into existing formulas (`--lean: 1`,
`[data-context=far] { --lean: 1.7 }`), never a parallel far-context table.

### [ ] 29. Item 9 (casting) should be reframed
Not "Cast vs. wrapper" but "which shim first, and who holds the tap": a custom
Cast receiver is one HTML page on our HTTPS origin plus Google's framework
script; Shalini's TV wrapper (`docs/api/README.md:101`) loads that same HTTPS
URL. Both put our HTML on the television. Gated on one spike: does a YouTube
embed play inside a Cast receiver.

### [ ] 30. Item 15 (TV remote focus) has two concrete child-mode rules now
Focus lands on the sun on entry wherever the sun is the action (Enter/Space
fires the button's click — already implemented for follow the sun's landings);
the after-break choice screen is the only child screen with several
focusables. Blocking for the wrapper path only, not for Cast.

### [ ] 31. Breathing's reduced-motion collapse
Pre-existing, not introduced by this break: 19.2s of breathing becomes ~1.2s
because its phase timers use `later()`, which clamps to 200ms under reduced
motion. `hold()` (added for follow the sun, spec 9.2) is the fix; breathing
itself is untouched.

### [ ] 32. Breaks cannot be paused
`.paused` reaches only watching (`js:414`) and cast (`js:676`); `css:22-23`
freezes a six-selector allow-list a break element would not be in; no break
screen has a pause control. Pre-existing, matters more on a television where a
parent may want to interrupt.

### [ ] 33. Item 13's device-voice premise weakens on television
The device voice (item 13) was accepted for the MVP partly because it speaks
whatever copy a break carries at runtime. Cast Web Receivers and the
webOS/Tizen web engines generally ship no speech-synthesis voice, so on the
device `concept.md:29` calls dominant, the app may speak nothing — nothing
breaks (`sayLine`'s fallback chain degrades silently), but "spoken
instructions" should not be counted on when designing any future break.

### [ ] 34. Production licensing for the generated neural voice clips
`proposal-src/voice-follow-intro.mp3` and `voice-follow-done.mp3` are
generated (edge-tts) neural-voice output, prototype-only until licensing for
production use is cleared.

### [ ] 35. `brand.md`'s game-content-colours reasoning needs an outlined-gold-hero note
The find-game colours section reasons about contrast from ink-on-fill. The
SETTLE hero (follow the sun) is gold with no ink ring — contrast against the
day sky is carried entirely by the amber rim outline (measured 3.9–4.7:1
across the three day-sky stops, task-7-report.md). `brand.md` should note this
second contrast mechanism exists alongside the ink-on-fill one.

## Surfaced by the splash redesign ("Constellation Seeds"), not yet tracked elsewhere

### [ ] 36. Screen-cut crossfade briefly shows ~25% raw cream — affects every screen cut in the app, not just this one
Measured, not assumed: sampling `#screen-splash`/`#screen-login`'s computed
`opacity` every animation frame through the `.5s` crossfade
(`kidq-desktop-app.css:19-21`) shows the two curves sum to ≈1 throughout (both
screens share the same `.5s ease-out`, triggered in the same tick). With
`login_op + splash_op ≈ 1`, the raw-cream fraction reduces to `s×(1-s)` for
`s` = either curve — algebraically maxed at exactly **25%** (not an estimate;
`s=0.5` is the peak by construction), reached where the shared ease-out
curve crosses its own 50% progress point, around 170ms into the .5s
transition. Both screens hold a full-bleed opaque `.kq-sky` at `inset:0`,
so this isn't confined to gaps between content — at the 170ms peak, 25%
of `#app`'s flat `background:var(--cream)` (`:17`) shows through the
*entire* viewport, composited under whatever fraction of each screen's
own sky is currently opaque.

**This is a structural property of every screen cut in the app**, not
something specific to the splash→login pair — any two `.screen`s crossfading
via this shared mechanism hit the same 25% cream ceiling at their own
midpoint. The old cream→indigo splash→login cut never exposed it visually
(cream-on-cream is invisible); predawn→predawn is the first pair dark enough
on both sides that a warm/light pulse would actually read. Flagged as
measured-but-not-eyeballed — a reliable screenshot of this exact ~150ms
window kept losing the race against browser-automation round-trip timing,
though the frame-by-frame opacity data itself is solid.

**Fix, if a human eye check confirms it's visible:** not a per-transition
patch (giving `#app` a dark ground would just move the pulse to the
cream-sky cuts instead). The general fix is structural — hold the outgoing
screen at opacity 1 and only fade the incoming screen in on top of it,
which needs a `z-index` bump on `.screen.active` (currently DOM order alone
decides stacking, so "Restart full flow" — which re-shows splash after
login — would stack backwards without one).

## Surfaced by making the watching screen's wide mode the default, not yet tracked elsewhere

### [x] 37. `#screen-watching.wide`'s tablet-only rules now also apply at the 1100px+ tier, by accident
`#screen-watching.wide`'s overrides (`kidq-desktop-app.css:725-733`) were
written inside the `@container (min-width:601px)` block, meaning they were
only ever exercised at the 601-1099px tablet tier while `wide` was an
opt-in toggle — nobody had reason to click "make it bigger" and then
resize past 1100px in the same sitting. Now that `wide` is the default
state (item added 2026-09-14, commit `791e4d7`), those rules are live at
*every* width ≥601px, including the 1100px+ tier, and because they're
scoped `#screen-watching.wide .selector` (ID+2 classes), they beat that
tier's own plain-class rules on specificity regardless of source order —
confirmed by measurement: `.kq-arcwrap` reports **110px** tall at the wide
tier, not the 150px `kidq-desktop-app.css:763` says it should be.

**Resolved (2026-09-14, same day).** Left unfixed at first — a naive reset
of the leaked `.kq-arcwrap`/`.kq-content` properties back to this tier's
intended values also reverted the player from 640px to 498px, undoing the
wide-default improvement, since the leaked `--playerw` formula
(`min(94cqw,1100px,max(340px,(100vh-305)*16/9))`) was the same leak giving
the bigger player. A design review then found the leak had a worse
consequence than "smaller arc" — the leaked `content:top:92px` pushed the
player's own box into the arc's territory, visibly slicing the sun's rays
on the player card's top edge. Real fix: gave `#screen-watching.wide` its
own *deliberate* wide-tier values (`kidq-desktop-app.css`, wide-tier
block) — `.kq-arcwrap{height:150px}`, `.kq-content{top:148px}`, and a
freshly-budgeted `--playerw:min(88cqw,1040px,max(440px,(100vh-361px)*16/9))`
(361, not 305, since content now correctly starts 56px lower) — instead
of inheriting the tablet tier's values by accident. Player is ~440-540px
depending on window height (down from the leaked 640px, but not
overlapping the arc); `positionSun()` retuned to match (see commit
history, same day).

**Real fix, when someone has time to do it properly:** decide on purpose
whether the wide tier should use its own formula or the tablet one, name
it once, and stop relying on an accidental specificity collision to get
there — right now two different `--playerw` formulas exist for this tier
and only one of them is reachable, silently.

## Surfaced while reconciling item 25, not yet tracked elsewhere

### [x] 38. The high-five had the same "stuck waiting for a tap" risk as item 25
Item 25 (above) settled the general rule for this app: a screen that waits
indefinitely for a young child's tap, with no nudge and no timeout, risks
stranding a child who cannot land it. The all-done screen's high-five button
had exactly that shape — `startAllDone()` shows two open palms and waits, with
nothing to end that wait but a tap on a small moving target.

**Decided and built (2026-09-15), user-directed, same resolution as item
25's direction 1+3:** the tap still wins immediately when it lands; if it
doesn't land within `HIFIVE_AUTO_MS` (~4s, same starting point as item 25's
`CHOICE_AUTO_MS`, tunable against a real child), the celebration (clap
animation, chime, moon pop) fires on its own. The tap handler was extracted
into `fiveUp()`, reused by both the click listener and the new `hold(fiveUp,
HIFIVE_AUTO_MS)` scheduled after `showScreen("screen-all-done")` in
`startAllDone()`. Unlike item 25, the reward sound is NOT silenced on the
auto path — item 25's jingle was muted specifically because it marks a
child's *own* choice, but the high-five chime already plays on other
non-tap moments elsewhere in the app (e.g. `startSunset`), so it stays on
here too. No separate cancellation wiring was needed: `fiveUp()`'s existing
`hifived`-class guard (unchanged from the original tap handler) already
makes a late auto-fire a no-op if the child already tapped.

Verified live in Chrome by playing a full demo session through to the
all-done screen without tapping: the celebration fired on its own, on
schedule. Tap-wins and reduced-motion-isn't-clamped were not independently
re-verified live for this item — both follow directly from unchanged code
(`fiveUp()`'s pre-existing guard; `hold()`'s unconditional, unclamped
`setTimeout`), the same guarantees item 25 already established for the
identical mechanism.

### [x] 39. A backgrounded tab could leave the watching screen frozen with the UI still claiming "playing"
Chrome silently pauses a video-only background tab to save power — no error
fires, just a real `pause` event, roughly 5s after the tab is hidden. The app
only ever listened for `timeupdate` and `ended` on the video, so that pause
went unnoticed: the pause button kept saying "Pause", `.paused` never got
added, and the child was left looking at a frozen frame with no visible way
back in. The policy itself is the browser's, not a bug reachable from here —
Chrome doesn't expose an opt-out for a hidden video-only stream — so the fix
is to listen honestly and recover on return, not to fight the pause.

**Built:** `video` now carries real `pause`/`play` listeners that sync
`#screen-watching`'s `.paused` class and `#watch-pause`'s aria-label to
whatever actually happened, whoever caused it — the browser, a demo-bar
screen jump's own `video.pause()`, or the click handler. Both listeners only
act while the watching screen is the active one (the same guard `ended()`
already used, since screen jumps and the swapping auto-advance dip pause/
play the video for their own reasons); the pause listener also skips a
video that has already `ended`, since a native `pause` fires right before
`ended` and would otherwise flash the paused UI on every video that finishes
normally.

A new `userPaused` flag, set in the existing `watchPause` click handler and
reset whenever `startWatching()` starts a new video, is the one rule that
matters here: **a deliberate pause by the child is never silently
overridden.** A `visibilitychange` listener calls the existing `attemptPlay`
when the tab returns to visible and the video is paused — but only when
`!userPaused` and the video isn't already `ended` (the swapping dip between
videos holds a paused-and-ended video on an active watching screen for
~700ms, and `attemptPlay` on an ended video would seek to 0 and replay it
briefly), so the recovery only ever undoes the browser's own mid-video
pause, never the child's or the tail end of a finished video.

Verified live in Chrome (`python -m http.server`, port 8471, the demo bar's
"Sun: midday" jump straight to watching) at the state level, since
`document.hidden` is always `true` in this automation environment and every
`setTimeout` is throttled — which meant Chrome's real background pause was
genuinely available to trigger and observe, not something to fake:
- Programmatic `video.pause()` / `video.play()` each correctly toggled
  `.paused` and the aria-label both ways.
- Clicking the real pause button, then overriding `document.visibilityState`
  to `"visible"` and dispatching `visibilitychange`, left the video paused
  and `HTMLMediaElement.prototype.play` uninvoked (instrumented with a
  counter) — `userPaused` held.
- The same override after a *programmatic* (non-user) pause invoked
  `attemptPlay`: the play-count counter increased and the UI flipped back to
  "playing" immediately, matching `attemptPlay`'s synchronous `play()` call
  even though the actual retry (visible in the counter) was blocked by the
  hidden tab, exactly as `attemptPlay`'s own `.catch` retry is built to
  handle.

One thing was environment-blocked rather than observed directly: natural
end-of-video. The dev server (Python's `http.server`) doesn't support HTTP
Range requests, and combined with `document.hidden`, the demo clips never
progressed past `readyState 0` — no real `ended` event was reachable. Rather
than skip the check, the same technique used above for `visibilityState` was
applied to the video itself: shadowed the read-only `ended` getter to `true`
on the element instance, dispatched a synthetic `pause` (confirming no
paused-UI flash), then a synthetic `ended` — which correctly ran the real
break-seam flow (`screen-watching` lost `active`, `screen-playtime` gained
it), since video 1 of the demo session lands exactly on the first break
boundary. Both the anti-flash guard and the ended-flow continuation are
therefore verified at the code-execution level, just not via an actual
decoded video frame reaching its last one.

---

## The parent app's Autoplay setting arrives (2026-09-15)

### [x] 40. Mirror the parent app's Autoplay toggle; never strand a non-tapper when it's off

The KidQ Parent app (built by a teammate) now has a per-family **Autoplay**
toggle: "Play the next video automatically within a session." This
prototype had no notion of it and always auto-advanced — unconditionally
between videos (`autoAdvance`), out of a break (item 25's `CHOICE_AUTO_MS`),
and, separately, the all-done screen's high-five (item 38's
`HIFIVE_AUTO_MS`). It needed to honour the setting.

**Decided and built (2026-09-15), user-directed.** A session-level
`autoplay` flag (default ON) stands in for the parent setting, flipped by a
new Autoplay control on the demo bar, following `#motion-toggle`'s existing
pattern — a plain variable, not part of `state`, read fresh at each decision
point rather than reset per session.

- **Autoplay ON is exactly today's behaviour, unchanged.** All three
  existing timers — `autoAdvance`'s 700ms dip, item 25's `CHOICE_AUTO_MS`,
  item 38's `HIFIVE_AUTO_MS` — fire exactly as before. Zero regressions was
  the bar.
- **Autoplay OFF, between videos:** the `ended` handler no longer calls
  `autoAdvance()` — it calls `startChoice()` directly instead, landing on
  the same after-break choice screen (sun plus the remaining parent picks),
  with no auto-advance timer. The existing copy — "Touch the sun for your next
  video / or pick one of Mumma & Papa's videos" — turned out to already read
  correctly from either entry point, so no copy changed.
- **Autoplay OFF, the choice screen itself (both entry paths):**
  `CHOICE_AUTO_MS` is never scheduled. In its place, an **escalating-nudge
  ladder**, added specifically so a pre-reader is never silently
  stranded — this was *the* concern raised for this item, the same one
  item 25 raised for the indefinite pre-autoplay wait and item 38 raised
  for the high-five. With autoplay off, the choice screen has no timeout to
  fall back on the way autoplay-on does, so instead of ending the wait it
  interrupts it: a first attention beat at ~7s, then every ~15s after that,
  for as long as the child sits there. Each beat reuses `pop()`'s existing
  squash-stretch (`choiceSun`) — the same animation a real tap produces
  elsewhere in the app — rather than inventing new motion, plus a soft
  audio cue. It never advances anything by itself; only a tap does that, so
  nudging "forever" is fine here in a way a timeout wouldn't have been.
  No separate cancellation wiring was needed: a tap (sun or a card) already
  runs `startWatching` → `showScreen` → `clearTimers`, and so does every
  demo-bar jump away from the screen — both already wipe whatever `hold()`
  is pending, `CHOICE_AUTO_MS`'s or the nudge's, the same way.
- **The high-five stays exempt from the flag.** `HIFIVE_AUTO_MS` is
  unconditional either way — decided explicitly, and unchanged in this
  diff beyond a comment. It ends the session; it doesn't advance content,
  so "play the next video automatically" has no opinion about it.
  End-of-session is likewise not an advance: the last video's `ended` still
  goes straight to sunset in both modes, exactly as before.
- **Timer discipline:** the nudge uses `hold()`, not `later()` — the delay
  *is* the nudge, not a transition, so it must not clamp to 200ms under
  reduced motion, the same reasoning already documented above
  `CHOICE_AUTO_MS` and `HIFIVE_AUTO_MS`.

**Voice line placeholder.** There is no recorded "Touch the sun for your next
video" line in the repo — the existing clips (`voice-follow-intro`,
`voice-follow-done`) are follow-the-sun specific — so the nudge's audio cue
reuses the soft sunset chime for now, with a `TODO(production)` comment in
`kidq-desktop-app.js` next to `scheduleNudge`. Production should record a
spoken "Touch the sun for your next video" line for pre-readers, in the same
voice as the other clips, and wire it in via `sayLine()` the way
`startFollow` already does for its own intro line.

**Note for the parent-side settings owner:** suggested copy for the
Autoplay setting's off-state description, to sit under the toggle:
*"Off means Aarav continues each video himself."* Flagging it here rather
than deciding it — it's the parent app's copy to own, not this prototype's.

**Verified live in Chrome** (port 8517), instrumenting `window.setTimeout`,
`HTMLMediaElement.prototype.play` and a `MutationObserver` on `#choice-sun`
rather than trusting wall-clock timing, since this machine's automation
tabs run with `document.hidden === true` throughout (confirmed), which
throttles `setTimeout` — delays land late but the scheduled `ms` values
and firing order are exactly what's asserted below, not an artifact:

- **Autoplay ON:** the between-video dip scheduled `setTimeout(…, 700)`
  and landed on the next video; the after-break choice screen scheduled
  `setTimeout(…, 4000)` (`CHOICE_AUTO_MS`) and auto-advanced on schedule;
  a full demo session driven through to all-done (both breaks, including a
  live "breathe" break with no interaction needed) scheduled
  `setTimeout(…, 4000)` for `HIFIVE_AUTO_MS` and the high-five auto-fired
  (`#screen-all-done.hifived`, chime replayed).
- **Autoplay OFF:** a synthetic `ended` dispatched on the un-final video
  landed directly on `#screen-choice` with **no** `setTimeout(…, 4000)`
  anywhere in the log — only `setTimeout(…, 7000)`. Confirmed for both
  entry paths (straight from a video's `ended`, and after a break). The
  first nudge fired at ~7s: `#choice-sun`'s class flipped to include
  `tapped` (matching the new `#screen-choice .kq-sun.tapped svg` CSS pop
  rule), the chime's `play()` was called, and a fresh `setTimeout(…,
  15000)` was logged for the next beat. A tap partway through a nudge wait
  cancelled it cleanly — waited well past when the next 15s beat would
  have fired and the log showed nothing further for `#choice-sun` after
  the tap. A demo-bar jump away mid-wait did the same. Toggling the flag
  between two decision points (after a break finished, before `startChoice`
  had run) was picked up correctly at the next decision point, with no
  errors and no stale timers. With reduced motion on, the nudge still
  logged `setTimeout(…, 7000)` (unclamped, confirming `hold()` is in use,
  not `later()`), while `pop()`'s own internal cleanup timer clamped to
  200ms as expected — the global reduced-motion CSS rule
  (`kidq-desktop-app.css:850`) is what actually shortens the pop animation
  itself, and needed no item-specific handling.
- Not independently re-verified live: toggling mid-`CHOICE_AUTO_MS`-wait
  down to the exact millisecond (an attempt was made; this machine's
  background-tab timer throttling had, by ~10 minutes into the session,
  degraded enough that a bounded poll loop hit a 45s CDP timeout, so the
  attempt was redone as a toggle-between-decision-points instead, which
  is the case that actually matters — see above). Both directions follow
  from the same mechanism (the flag is a plain variable read once per
  decision point, never polled), which the above does establish live.

One thing worth flagging for whoever picks up "port to `web/`" (item 16):
the nudge ladder's "forever" is correct for a design prototype with no
session end other than the child's own choices, but a real deployment may
want a cap — a pre-reader is never stranded now, but neither is a parent
told anything if a child truly walks away and the nudge just keeps going.
Not raised as a concern for this item (out of scope — nothing in the brief
asked for one, and item 38's high-five timer already gives the session a
hard end regardless), just noted since it wasn't obviously covered
elsewhere.

---

## The parent app's break settings arrive (2026-09-15)

### [x] 41. Config-driven break schedule + parent-chosen break type (PARENT-KID-CONTRADICTIONS items 2-3)

The prototype hardcoded exactly two breaks, at the 1/3 and 2/3 marks of
whatever session the child got, first always from MOVE, rest from SETTLE.
The KidQ Parent app has two settings that made every config but the default
render wrong: a **break interval** (every 10/15/20 min) and a **break
type** (Movement / Quiet-calm / Let KidQ alternate). Both are now
config-driven, per the design at
`docs/superpowers/specs/2026-09-15-kidq-config-driven-breaks-design.md`
(Opus-reviewed before this round started).

**Built:**
- `planBreaks(videos, intervalMinutes)` now targets `k · interval / total`
  for every `k` with `k · interval < total`, snapping each target to the
  nearest not-yet-used video boundary — under a **max snap distance** (a
  target whose nearest remaining boundary is more than half an interval
  away is dropped, not snapped) and a **min gap** (a boundary within half
  an interval of an already-chosen break is ineligible for a later target).
  Both guard against the same failure mode: on a lopsided queue (e.g.
  20+1+9 min at every-10m), unconstrained snapping used to place two
  breaks one minute apart. Ties keep the earlier boundary (unchanged,
  now documented rather than incidental).
- `gameForBreak(index)` now goes through `bucketForBreak(index)`, which
  reads the live `breakType` flag: `movement`/`quiet` force a bucket
  outright; `alternate` (default) buckets on the break's **planned**
  fraction (`state.breaks[index]`, not `sessionProgress()` at fire time —
  a strip-switching child can fire a break late, and the planned slot is
  the contract you'd want an analytics event to match), `≤ 0.5` → move,
  `> 0.5` → settle. The `≤` matters: the demo session's own default
  (every-15m) yields exactly one break at fraction 0.5000 exactly, and it
  has to stay the movement break for this to be a faithful generalisation
  of "first break is always find" rather than a quiet regression.
- `breakEveryMinutes` (default 15) and `breakType` (default `"alternate"`)
  are now fields of the session object — but `prepSession()` *projects*
  the session object into `state.session`, so an unlisted field is
  silently dropped the way `pickedBy` already was. Both defaults are
  applied on that projection line, once, rather than at every read site.
  Interval is read once, at `prepSession()` (breaks are planned there);
  breakType is read live, at `gameForBreak()` fire time, seeded from the
  session's own config each time a session starts but overridable
  mid-session without disturbing the already-planned break positions.
- Demo bar gained two controls, both cycling buttons like the existing
  Autoplay/Reduce-motion toggles rather than a row of one-shot buttons:
  **Break type** is a live flag exactly like Autoplay — flips `breakType`,
  read fresh at the next `gameForBreak()` call, no restart. **Breaks:
  every Nm** cannot apply mid-session (positions are planned once, at
  `prepSession`), so it restarts the session — always back into the demo
  `aarav` queue, the one with breaks to show. Its handler runs the same
  `[data-demo]` prologue every other jump uses (`clearTimers();
  video.pause();`) before restarting, or a pending `autoAdvance` dip or an
  autoplay-off nudge chain (item 40) fires into the new session holding
  stale state.
- The rotation comment's old claim — "the same session never serves a
  game twice" — is now "no immediate repeat": true with two breaks, false
  in general once a config can ask for more breaks than a bucket has
  entries. The rotation formula itself (`bucket[(breakRotation + index) %
  bucket.length]`) needed no change to generalise.

**Contract note for the parent-side settings owner:** break count is
capped by boundary count (`n − 1` for `n` videos) and by the two snapping
constraints above — a config that asks for more breaks than the queue's
boundaries and spacing allow gets fewer, silently. This matches the
parent app's own hedged copy ("About one break every N minutes" already
reads as approximate, not a guarantee), but is worth stating plainly:
**the number configured is a target, not a floor.** The concrete case in
the data: the 17-minute replay session ("yesterday's picks") loses its
one break entirely at every-20m (`20 min > 17 min total`, zero targets
generated) — accepted, not a bug, and downstream code already handled
`state.breaks = []` before this round (any single-boundary or
single-video queue could already reach it).

**Explicitly not resolved by this round:** item 24's mandatory terminal
wind-down slot. The interval math above neither implements nor precludes
it — a future round would need to decide whether a forced last-break slot
composes with parent-chosen intervals/type or overrides them, and that
decision hasn't been made.

**Verified:** `node --check`. Break positions were hand-computed for the
demo queue (videos 8/7/8/7 min, boundaries at .2667/.5/.7667 of the 30-min
total) and matched live in Chrome (`python -m http.server`, port 8531,
killed after) at every interval: every-10m → `[.2667, .7667]` (today's
exact positions, now reachable by config instead of hardcoded), every-15m
→ `[.5]`, every-20m → `[.7667]`. Bucket selection was confirmed for all
three `breakType` values, including both discriminating cases (movement
forced at a fraction `alternate` would call settle; quiet forced at
exactly 0.5, where `alternate` would call move) — not just the
non-discriminating ones where `alternate` would have agreed anyway — and
the live-flag toggle was confirmed to apply with no `prepSession()` call
in between (no restart). The replay session at every-20m was confirmed to
play video → video → sunset with no playtime seam and no break-selection
call at all. Both restart-cleanliness cases in the design (mid-video,
mid-choice-screen with autoplay off) were confirmed to leave zero live
timers behind — the specific stale timer id was captured, shown cleared
the instant the interval control's restart ran, and never fired even
after many more timer-queue flushes.

As with items 39-40, this machine's automation tabs are always
`document.hidden`, which throttles real `setTimeout` timing unpredictably
— real playback and wall-clock waits were not relied on. Unlike those
items, the thing under test here (`state.breaks`, which bucket a break
drew from) lives in a closure-private module scope with no existing
external hook, so verification added temporary `console.log` calls at
`prepSession()` and `gameForBreak()` plus a virtualised, fully-controlled
`setTimeout`/`clearTimeout` (queue-and-flush-on-demand, so timer order
could be driven deterministically instead of raced) and a one-line
`location.hash`-gated test entry point for reaching the replay session
directly. All of this was removed before committing — `git diff` against
this section's own commit carries none of it, and `node --check` was
re-run clean afterward.

---

## The parent app's Sensory-friendly setting arrives (2026-09-15)

### [x] 42. Sensory-friendly mode: forced reduce-motion + softer (never silent) audio (PARENT-KID-CONTRADICTIONS item 7)

The KidQ Parent app has a family-wide **Sensory-friendly mode** setting:
"softer sounds, calmer visuals, fewer transitions." This prototype only had
half of that — a reduced-motion toggle, visual only, with jingle/chime
volumes untouched regardless of its state.

**Decided (parent cross-check, 2026-09-15): one kid-side flag, two
effects.** Reduce-motion already delivers "calmer visuals, fewer
transitions" — the existing `.reduce-motion` class + `reducedMotion`
variable needed no new mechanism, only a way to force them. The real gap
was sound, so the second effect is: **every audio element this file plays
drops to ~40% volume.** Softer, never silent — the audio carries meaning
(the autoplay-off nudge chime, item 40, is how a pre-reader knows it's
their move; the find/breathe/follow instructions are how a low-vision or
colour-blind child gets the instruction at all, per the spoken-instructions
block above `say()`). Silencing any of it would trade one accessibility
gap for another.

**Built**, following the same config pattern as `autoplay`/`breakType`
(items 40/41):
- `sensoryFriendly` is a session-config field (default `false`), added to
  `prepSession()`'s projection alongside `breakEveryMinutes`/`breakType` —
  an unlisted field is silently dropped, so the default is applied right
  there, once. Like `breakType`, it seeds a live module flag every time a
  session starts (through `setSensoryFriendly()`, mirroring
  `setBreakType()`), and the demo bar's own Sensory control then overrides
  the live flag between `prepSession()` calls — a plain login or restart
  always reflects the session's own config again, same as break type.
- **Volume.** `SENSORY_VOLUME = 0.4` (a starting point, not a tuned value —
  wants testing against real families, same caveat the parent cross-check
  itself raises). Applied at *play time*, not once at load, in every play
  helper this file has: `safePlay()` (jingle, chime), `sayLine()` (the
  recorded follow-the-sun voice clips) and its `say()` fallback (device
  TTS — `SpeechSynthesisUtterance.volume`, so a device with no clip, or a
  blocked clip, still gets the softer instruction rather than a full-volume
  one). Explicit `1` when the flag is off, not just "leave it alone" — that
  is what restores full volume the moment sensory-friendly turns off, and
  what keeps a stale `.volume` from a prior sensory-friendly session from
  surviving into a new one.
  **Judgment call, one extension beyond the brief's literal "audio
  element" wording:** the follow-the-sun break's catch sound (`plip()`) is
  real app audio too — two soft sine tones via Web Audio, not an `<audio>`
  element and not routed through `safePlay`/`sayLine` — so it was silently
  exempt from every reading of "audio element." Included it anyway,
  scaling the gain envelope's peak by the same constant (a `GainNode` has
  no `.volume` to set directly), on the reasoning that leaving exactly one
  sound at full volume while everything else the app plays drops to 40%
  would read as broken, not deliberate, and directly contradicts "this
  covers ALL audio." Flagged here rather than assumed silently.
  **Explicitly out of scope:** `video` itself. `startWatching()` already
  sets `video.muted = true` unconditionally — "demo clips carry no needed
  audio; jingle/chime are the sound design" (pre-existing comment) — so
  there is no audio there for this flag to soften either way.
- **Reduce-motion coupling.** Turning sensory-friendly ON forces
  `reducedMotion` on: the variable, the root `.reduce-motion` class, and
  `#motion-toggle`'s own pressed state/label, so the demo bar never shows a
  lying control. This reuses `setReducedMotion()`, extracted out of
  `#motion-toggle`'s click handler for exactly this purpose (previously
  inline, now a named function called by both the manual toggle and the
  sensory-friendly force/release) — including the existing "never restart
  mid-ending" follow-break guard, unchanged. Turning sensory-friendly OFF
  releases the force but does not stomp a reduce-motion the child's own
  household had chosen independently before the force: `preSensoryMotion`
  remembers whatever `reducedMotion` was live the moment the force was
  applied, and release restores exactly that value, not `false`. Both the
  force and the release are additionally guarded to a genuine value change
  (`reducedMotion !== target`) before calling `setReducedMotion()` at all —
  without that guard, releasing sensory-friendly back to an *unchanged*
  motion value (the case where motion was independently on, stays on)
  would still re-run `setReducedMotion()`'s follow-break-restart side
  effect for no reason. OS-level `prefers-reduced-motion` (`reducedMotion`'s
  own startup default) still governs the baseline underneath all of this —
  noted in-code, not just here.
- **Demo bar.** One new toggle, `#sensory-toggle`, "Sensory: Off"/"On",
  placed right after `#motion-toggle`, following the exact
  `aria-pressed`/label convention of `#autoplay-toggle`/`#motion-toggle`.

**Contract note for the parent-side settings owner:** this arrives as a
plain family-wide boolean, same shape as `breakType`/`breakEveryMinutes` —
nothing new needed from the API beyond carrying the field through.

**Verified:** `node --check`. Live in Chrome
(`python -m http.server`, port 8561, killed after), instrumenting through
the DOM rather than the closure-private module state (`sensoryFriendly`,
`reducedMotion`, `preSensoryMotion` have no external hook) — reading
`#jingle`/`#chime`'s own `.volume` after triggering their real play paths,
and the root element's `.reduce-motion` class plus both toggle buttons'
`aria-pressed`/label:
- **Flag ON** (toggled mid-session, after `prepSession()` had already run
  so the toggle wasn't immediately undone by another seed): root gained
  `.reduce-motion`, `#motion-toggle` read pressed/"Motion reduced", and
  both `#jingle` (via the sunrise tap) and `#chime` (via the find break's
  "I found them!") read `.volume === 0.4` on the very next play after the
  toggle.
- **Flag OFF after ON, both pre-force states:** motion was off before the
  force → off again after release, jingle/chime back to `.volume === 1`.
  Motion was turned on *manually* before the force → confirmed it stayed
  on after release (not reset to off), matching the "never stomp an
  independent choice" rule.
- **Session-config path:** temporarily added `sensoryFriendly: true` to
  the demo `aarav` session data (removed before committing — `git diff`
  carries none of it), reloaded, and started that session through the
  ordinary Sunrise demo button with the `#sensory-toggle` control never
  touched by hand. The flag came up already on, the demo bar's own label
  read "Sensory: On" with no click involved, reduce-motion was forced, and
  the next jingle played at `.volume === 0.4` — confirms `prepSession()`'s
  projection seeds the live flag on its own, and that the demo bar's label
  never drifts from what the session actually configured.
- **Regression:** with the flag left off throughout, jingle/chime stayed
  at `.volume === 1`, and `#motion-toggle` was independently exercised
  mid-way through a live follow-the-sun break (unchanged behaviour, now
  reached through the extracted `setReducedMotion()`) — the break stayed
  on screen, not re-celebrating, exactly as before this diff.
- No console errors across any of the above.

Not independently instrumented live: `plip()`'s gain scaling and
`SpeechSynthesisUtterance.volume` on the `say()` fallback. Both are
read-once-at-call parameters with no queryable element to inspect
afterward (unlike `<audio>`'s persistent `.volume`), so this is a
code-level guarantee — the same `sensoryFriendly ? SENSORY_VOLUME : 1`
expression already verified live for `safePlay`/`sayLine` — rather than
something observed firing softer live in this environment.

## Stand like a tree (2026-09-15)

### [x] 43. "Stand like a tree" activity break, built
Per `docs/superpowers/specs/2026-09-14-kidq-tree-pose-break-design.md`, built
on `design/tree-pose-break`. `BREAK_GAMES.move` is now `["find", "tree"]` —
the change item 17 flagged as making movement-bucket rotation real — and
`BREAK_START.tree = startTree` joins the dispatch map, plus a
`data-break="tree"` demo-bar button.

**Asset.** "Young woman meditating in yoga tree pose" by Farfique
(LottieFiles, Lottie Simple License). The documented download-URL technique
(Download button → editor → signed `private-cdn.lottie.host` fetch) wasn't
needed: the same public `.lottie` bundle that powers the LottieFiles page's
own live preview player is embedded directly in the page's server-rendered
HTML (`assets-v2.lottiefiles.com/.../K9v8FCUpy1.lottie`, 17,876 bytes —
matching the page's own stated 17.5KB dotLottie figure almost exactly).
Recoloured via `scratchpad/recolor-tree.py` into
`design/prototype/kidq-tree-anim.js` (`window.KIDQ_TREE_ANIM`, header
comment documents the exact mapping) — never hand-edited. Clothing only:
tank top `#F2F2F2` → cream `#FAF4E8`, shorts/bikini `#631218` → dusk
`#C9B8E8`, shorts/bikini shadow `#561216`/`#561217` → the existing
dusk-deep `#A991D6` (already used in this file for the high-five fallback's
second hand). Skin and hair untouched. The top-level "Shadow" layer (the
ground/mat ellipse) is removed entirely, not just recoloured. Verified: no
pure white/black fill remains anywhere in the bundle; no baked-in
lettering; the mirrored hold (`scaleX(-1)` on the Lottie container, never
the stage — see brand.md) renders clean, checked at 300×300 side by side
with the unmirrored pose.

**Voice.** Three new clips via the same edge-tts pipeline as follow
(`en-IN-NeerjaNeural`, `--rate=-10%`, confirmed against commit `a32e1a5`'s
own regeneration note rather than guessed): `voice-tree-intro.mp3` (6.360s),
`voice-tree-count.mp3` (7.800s — "5… 4… 3… 2… 1!", word-start offsets read
from edge-tts's own `--write-subtitles` output: 1758/3327/4827/6244ms),
`voice-tree-switch.mp3` (1.872s — "Other leg!"). Ending reuses
`voice-follow-done.mp3` (2.016s) — no duplicate file, per spec. The hold
chain is tuned to these REAL measured lengths, not the spec's own ~5.5s/
~1.1s-per-number estimates — at this unhurried a pace the real gap between
numbers runs ~1.4–1.7s. Consequence, flagged honestly: the full run is
**~26.6s** end to end (measured via instrumentation, see below), not the
spec's "~20s, same band as breathing" — a direct, logged result of
following the spec's own explicit instruction to tune to the measured clip
rather than the other way round.

**Count presentation — changed mid-build from the spec's small text
sub-line, twice, both by user steer, not a unilateral call:** (1) the
current number now renders as one BIG digit (36/44/54px across the three
tiers) with the still-to-come numbers trailing small and dimmed beside it,
popping in on every change via the existing `pop()` vocabulary — "a bit fun
and playful and visible," per the steer; (2) the digit's colour was
overruled a second time — sun-gold measured 1.2–1.9:1 against this app's
cream sky (nowhere near the 3:1 AA floor for large text), so it sits in
plain **teal** (`var(--teal)`, the app's one UI accent), measured
4.04–4.88:1 across the sky's three gradient stops. Written up as the
shared **break-count digit pattern** in brand.md §5 (not a tree-only
style), since count-to-10 (item 17's remaining entry) will reuse it.

**Scene.** Side-tree decor rule and sun-as-sidekick sizing documented in
brand.md §5, alongside the digit pattern. One real layout bug caught and
fixed before commit: the side trees were first anchored to the raw
viewport bottom (`bottom:0`), which sits far below the vertically-CENTRED
content cluster on a tall test viewport and would clip the trees off-screen
entirely on a real, shorter phone height — refactored to anchor off the
viewport's own vertical centre instead. A second: the sun sidekick's
position percentage was computed against the wrong containing block (the
full-width scene, not the stage), pushing it partly off-screen at some
tablet widths — fixed by nesting it inside the stage. A third: the
assembled cluster ran 90–120px taller than find's own cluster (the tallest
of the other three break screens) at every width on the first pass: the
stage was trimmed from a 220/258/300px cap to 196/228/264px and the
cluster's own gap from 18px to 14px, closing it to ~20–40px over find —
logged in brand.md as the reasoning for staying close to, not a full step
above, breathing's own hero caps.

**Verified** (§9, adapted to this machine's hidden-tab limits — see the
spec's own note): all eight widths (390/600/601/900/1099/1100/1440/1920)
via raw `getBoundingClientRect()` tables — nothing overflows, nothing
shrinks as the container grows, her stage never rectangularly intersects
either side tree at any width (a stronger check than a silhouette check).
Full hands-off run verified via `setTimeout` instrumentation (overriding
`window.setTimeout` to log every scheduled delay before it fires) rather
than watching it play, since automation tabs are always `document.hidden`
here and rAF/Lottie frames never advance visually — the captured schedule
matches the coded constants exactly (COUNT_STEP_MS, COUNT_MS=7800,
SWITCH_MS=2100, the final `hold(startChoice, 1900)`) with only ordinary
~10ms timer jitter, both dots ending lit and the mirrored class set.
Reduced-motion run verified the same way plus a `MutationObserver` on the
stage's class list: confirms the crossfade path fires (never the bounce
`.flipping` class), the still-pose `goToAndStop`, and an identical
~26.6s total (every phase here uses `hold()`, never `later()` — grepped to
confirm). Real-session dispatch path verified by driving an actual
`aarav` session through two videos via synthetic `ended` events (the demo
mp4s are too short to make a real 15-minute wait meaningful) — the break
lands on `screen-playtime` synchronously, then `screen-tree` after the
1600ms seam hold, through `gameForBreak()`'s own array indexing, not the
toolbar's direct jump. Recolour bundle greps clean (no pure `#fff`/`#000`).
`node --check` clean on every JS file touched.

**Human check still needed, not simulated here:** whether the pose, the
sun's wobble, and the tree sway actually *look* right in motion — this
environment can confirm the schedule and DOM state but not judge visual
motion in a hidden tab.

## Count to ten (2026-09-15)

### [x] 44. "Count to 10, eyes closed" activity break, built
Per `docs/superpowers/specs/2026-09-15-kidq-count-to-ten-break-design.md`,
built on `design/count-break` (worktree `KidQ-fork-count`, off main at
`7d1e692`, which already includes tree pose). `BREAK_GAMES.settle` is now
`["breathe", "follow", "count"]` — the key the array's own comment had
reserved — plus `BREAK_START.count = startCount` and a `data-break="count"`
demo-bar button. This closes item 17: all three activity breaks the
round-1 spec named are now built.

**Voice.** Eleven new clips, same edge-tts pipeline as follow/tree
(`en-IN-NeerjaNeural`, `--rate=-10%`, confirmed against commit `e7fa524`):
`voice-count-intro.mp3` (3.696s, "Close your eyes… and count with me!"),
`voice-count-1.mp3` … `voice-count-10.mp3` (ten SEPARATE per-number clips,
per spec §4's own explicit reasoning — the hold chain triggers each at its
own tick so digits and audio can't drift in any mode, including the
device-TTS fallback — all eleven measure **exactly 1.872s each**, mutagen),
`voice-count-open.mp3` (2.280s, "Open your eyes!"). Ending reuses
`voice-follow-done.mp3` unchanged, same decision and naming wart as tree.
Tick spacing is the measured per-number clip length itself (1872ms) —
"chain follows audio" (spec §3) taken literally: each number gets exactly
enough room to finish before the next starts, `hush()` the safety net
tree's own build didn't need but this spec calls for explicitly ("Each
sayLine call in this chain calls hush() first"), implemented on every one
of the ten ticks plus the "Open!" transition. `TEN_OPEN_MS` (2500) adds a
~220ms buffer past the measured 2.28s open clip, same reasoning as tree's
own `SWITCH_MS` cushion. Consequence, flagged honestly exactly as tree's
own item 43 did: the full run measures **~27.4s coded (~28.8s observed
through real browser timers, the gap ordinary hidden-tab setTimeout
coalescing)**, not the spec's own "~18.5s target" — ten clips at 1.872s
each is already ~19s on its own, before intro/open/celebration. Not
compressed to fit: this is the settle game, "sleepy and unhurried" is the
explicit design goal (spec §4), and forcing a faster cadence would fight
that goal directly.

**Scene.** Donor is BREATHING's own `.bsun` dual-group `eyesOpen`/
`eyesClosed` markup (spec §2's own explicit steer, Opus-reviewed) — the
sunrise sun's eyes were rejected as a donor since its unscoped
`.eyes-awake{opacity:0}` only lifts under `.screen.risen`, which
`#screen-count` never gets. New ID-scoped CSS under `#screen-count`, not
shared-component reuse (no shared sun component exists). A single `.dim`
state class on `#screen-count` itself drives both the sky dim (the
existing `.kq-duskveil` mechanism, pinned to a NEW ~0.25 opacity — the
existing `.screen.setting`'s own 0.85 is a full dusk) and the closed eyes
together, since the spec's sequence pairs them at the same two beats.
Digit colour stays the shared teal (`var(--teal)`) tree's own build
established, but RE-MEASURED against this screen's dimmed sky rather than
inherited: alpha-compositing `.kq-duskveil`'s gradient at 0.25 opacity over
the day sky's own three gradient stops gives **3.72–4.05:1** contrast
across the composited range (worst case at the sky's bottom stop) — clears
the 3:1 AA large-text floor with real margin, closer to the floor than
tree's own 4.04–4.88:1 against the undimmed sky but not close enough to
need a different colour. Digit entrance is deliberately quieter than
tree's own `pop()` (spec §1: "a slow pulse, not a bounce" — count is the
settle game): a new `kq-countpulse` keyframe, `.82→1` scale + `.55→1`
opacity, ~300ms, its own small remove/reflow/add re-trigger helper rather
than widening `pop()`'s two hardcoded class names for a third animation
only this screen uses. Trail direction is the opposite of tree's: tree
counts down and its trail previews what's still coming; this game counts
up and its trail shows the WALKED-THROUGH numbers behind the current one
(spec §1's own wording) — at nine numbers wide (big="10", trail="1 · 2 ·
… · 9") this is one wider than tree's own four-wide max, the width risk
spec §1 names by name. Measured rather than assumed to need mitigation
(§8.1, below): the shared `.kq-breakcount-trail` size and `" · "`
punctuation already carry real margin (180px scrollWidth against 330px
usable at the 390px tier), so the only addition is
`font-variant-numeric:tabular-nums`, to keep that measurement stable as
the digits themselves change width — no smaller font, no thinner
separator needed after all. No dots, no side decor, no new assets of any
kind (spec §2) — the cheapest break in the set.

**Demo note** (spec §8 item 5): the default "alternate" break-type config
cannot demo count on its own. Under alternate, `bucketForBreak` sends a
break to `move` at fraction ≤ 0.5 and `settle` above it; the default
every-15-minute session on the demo `aarav` data plans exactly ONE break,
landing at fraction 0.5000 — the `<=` boundary keeps it `move` (today's
"first break is always find/tree" behaviour, unchanged by this build), so
alternate can only reach `settle` — and only maybe reach count within
that, depending on rotation — at every-10-minutes (two breaks, the second
above 0.5) or wider gaps. To demo count specifically, use the demo bar's
Break type: Quiet (forces every break to `settle`) or Breaks: every 10m
(so there is a second, `settle`-side break to draw from) — exactly the
combination the verification below drives.

**Verified** (§8, same hidden-tab adaptation tree's own item 43 logged):
- **8 widths** (390/600/601/900/1099/1100/1440/1920) via raw
  `getBoundingClientRect()`/`scrollWidth` tables, worst-case digit state
  forced (big="10", trail at its nine-number widest): no overflow, no
  clipping, at any width. Cluster height (headline top to digit-row
  bottom) runs 7px UNDER find's own reference cluster at 390px and
  6.5–10.5px over it at the wider tiers — well inside tree's own precedent
  of running 20–40px over at every width.
- **Hands-off full run**, both motion modes, verified via the same
  `setTimeout`-override instrumentation tree's own item 43 used (captures
  the coded schedule without needing rAF/paint, which never advance in a
  hidden automation tab): the full-motion run's `hold()` delays land
  exactly on the coded constants (600, 4296, then 1872×9, 18720, 2500,
  1900) with only ordinary timer jitter; the reduced-motion run's `hold()`
  delays are **identical**, confirming spec §5 ("nothing shortened — all
  `hold()`") — only the digit-pulse cleanup's own `later()` calls clamp
  from 350ms to 200ms, a cosmetic detail outside the break's own pacing.
- **Silent fallback**: every `<audio>.play()` forced to reject AND
  `window.speechSynthesis` replaced with `null` (both the recorded clips
  and the device-TTS fallback unreachable at once) — the `hold()` schedule
  is bit-for-bit identical to the normal run; the digits still walk, same
  total time, confirming §3's claim that visuals and the hold chain never
  depend on audio actually playing.
- **Eyes actually toggle**: computed `opacity` of both `.eyesOpen`/
  `.eyesClosed` groups confirmed `1`/`0` at rest, `0`/`1` under `.dim`,
  back to `1`/`0` on removal — instant in both directions (no `transition`
  on that property, matching the sunrise sun's own reduced-motion
  behaviour by construction, not by special-casing). The sky-dim
  `.kq-duskveil` opacity target was confirmed the same way with its
  `transition-duration` temporarily zeroed (`0`/`.25`/`0`) rather than by
  waiting through the live 1.4s transition: this automation tab is always
  `document.hidden`, and Chrome never ticks CSS transitions forward for a
  hidden tab's compositor, so the live opacity reads frozen at its
  pre-transition value even a full second past the transition's own
  duration — a test-harness limitation (the same one that keeps rAF/Lottie
  from advancing), not a bug in the rule; the CSSOM match and the
  transition-bypassed target value both confirm the rule itself is
  correct, and the mechanism (`.kq-duskveil` + `!important`
  `transition-duration:.12s` under `.reduce-motion`) is the one already
  proven live on the watching screen.
- **`startCount` reached from the real session path**: Break type set to
  Quiet, breaks every 10 minutes, driven through the actual `aarav` demo
  session (sunrise tap → `ended` event on the video, real `state.current`/
  `state.watched` set by the real code path, not synthesised) across
  **7 fresh page reloads** (`breakRotation` reseeds per load, not per
  session restart, confirmed by checking that `window.speechSynthesis`
  and injected debug globals from a prior trial do NOT survive a `navigate`
  call — a genuine reload, not a bfcache restore). All three settle games
  appeared (count ×4, follow ×2, breathe ×1) — one more trial than tree's
  own item 43 logged ("verified uniform, 6 % 3 == 0"), added here because
  the first six landed on only two of the three games and a seventh was
  needed to see breathing actually fire before calling the wiring
  confirmed.
- Celebration state inspected directly mid-run: `#screen-count` carries
  `active celebrate` (not `dim`), headline reads "You did it! ✨", the
  digit row computes `display:none` and both digit spans are cleared —
  matching `#screen-count.celebrate` exactly as written.
- Console clean across every run above (normal, reduced-motion, silent
  fallback, all seven quiet-type reloads). `node --check` clean.

**Human check still needed, not simulated here:** whether the digit's
quieter pulse actually reads as calmer than tree's pop, and whether the
sky-dim/eyes-close/eyes-open beats feel right in motion — this environment
can confirm the schedule, the DOM state and the CSS rules' target values,
but not judge visual motion or timing *feel* in a hidden tab.

## Break-count digits ride balloons (2026-09-15)

### [x] 45. The shared break-count digit now arrives on a balloon, both screens
User request: "make them like coming on balloon" — balloon over ball because
the splash's own KidQ letters are already glossy inflating balloons
(`kidq-desktop-app.css:89–141`), an established brand vocabulary, not a new
shape to introduce. Built on `design/balloon-digits`, worktree
`KidQ-fork-balloon`, off `main` at `94f175f` (tree pose + count break + the
pick-pill package + the Touch docs sweep, all already in). Touches only
`design/prototype/index.html`, `kidq-desktop-app.css`, `kidq-desktop-app.js`
and `brand.md` §5 — no other screen, no backend, no asset files.

**Recipe, not a new style.** Same 5-stop radial-gradient recipe as the
splash's own balloons (identical hex values), same four hues in the same
cycling order the splash's own letters use — teal → gold → coral → dusk →
repeat, one step per digit change. A shared `setBalloonHue(el, i)` helper
(`kidq-desktop-app.js`, beside `pop()`) drives both screens so the cycle can
never drift between them. Only the gradient's *size* departs from the
splash's own default farthest-corner sizing: an explicit `circle
calc(var(--cnt) * .729)` radius, because a small round digit badge's own
centre only reaches t≈0.3 of the splash's default sizing (still the
near-white highlight band) — measured as cream failing on teal and coral
too, not just gold. The smaller radius moves the badge centre to t≈0.55,
the recipe's own literal mid-point between the 36/40% "true hue" stop and
the 62/66% deep one, without touching a single colour value.

**Digit ink per hue, measured** (`scratchpad/balloon-*.js` this session;
full table and worked geometry in `brand.md` §5 and the CSS comment above
`.kq-digitballoon`):

| hue   | sampled colour (t=0.55) | cream   | ink     | used |
|-------|--------------------------|---------|---------|------|
| teal  | `#258776`                | 4.00:1  | 3.25:1  | cream |
| gold  | `#F6B43B`                | 1.66:1  | 7.83:1  | **ink** |
| coral | `#D0604C`                | 3.52:1  | 3.70:1  | cream |
| dusk  | `#7C67B6`                | 4.28:1  | 3.04:1  | cream |

All eight combinations clear the 3:1 AA large-text floor. Gold is the one
hue cream can't sit on (matching the pre-existing flat-sun-vs-sky finding
already on record in brand.md §5, not a new gap this balloon build
introduces) — ink flips in on the same `hue-gold` class the body's own
gradient swaps on, one class, two effects, never drifts.

**Balloon-vs-sky (non-text, 3:1 floor), also measured, honestly mixed:**
the balloon is `aria-hidden` decoration around the digit (the digit text
is the one piece actually carrying the count), so this is a self-imposed
bar past what WCAG 1.4.11 requires of decorative graphics — checked anyway,
per the design brief. At the same t=0.55 body tone: bright sky (tree) —
teal 3.42:1, coral 3.01:1, dusk 3.67:1 clear, gold 1.43:1 does not; dimmed
sky (count, `.kq-duskveil` @ .25) — teal 3.15:1 and dusk 3.39:1 still
clear, coral drops to 2.78:1 (a real but narrow miss) and gold to 1.32:1
(fails harder). Not re-tuned to force a pass — the brief asked to reuse the
recipe's colour values, not invent past them, and the digit text itself
(the functional half of the pattern) clears 3:1 on all four hues regardless
of which sky sits behind the balloon. Logged honestly in brand.md §5 rather
than silently dropped, matching this file's own habit for a known,
narrow, out-of-scope gap.

**Entrance, one per screen, both reusing existing vocabulary:** tree's
balloon bounces in on the *same* `pop()` squash-stretch the bare digit used
before — now targeting the whole balloon wrapper (body + knot + string +
digit move as one unit, since `transform` on the wrapper carries every
absolutely-positioned child with it), same hold-chain trigger, same
re-entrancy discipline, nothing else changed. Count's balloon instead
floats gently up into place — a new `kq-balloonfloat` keyframe
(`translateY(14px)→0`, `.4→1` opacity, no scale, no squash-stretch) on the
same remove/reflow/add re-trigger helper count already had, replacing the
old `kq-countpulse` scale-pulse (retired, not left dead) rather than
stacking a second animation on top of it. Both keyframes' `100%` state
matches the wrapper's own unanimated rest state exactly
(`transform:none`, `opacity:1`) — the same discipline `pop()` itself
already held — so reduced motion's blanket crush to `.001ms` never leaves
a balloon stuck mid-bounce or mid-float; confirmed live (below), not just
reasoned about.

**Knot & string.** Knot: a small solid triangle in the same hue's own 100%
(deepest) recipe stop — the shape's own shadow colour, not a new one.
String: a short, slightly-tilted 1.5px thread in `var(--ink-soft)`, one
neutral colour across all four hues (real balloon string doesn't recolour
with the balloon) and deliberately short, per the brief ("a short string")
— no balloon trail: the trail stays plain text exactly as before, since a
balloon there would be clutter, not a count aid.

**Sharing judgment call** (asked for explicitly): the balloon SHAPE and
hue-cycling are one shared implementation — `.kq-digitballoon` +
`.kq-balloon-body/-knot/-string`, the four `hue-*` classes, and
`setBalloonHue()` — used identically by both screens, no copy-paste. The
*entrance* stays two separate, screen-scoped CSS rules
(`#screen-tree .kq-digitballoon.tapped` → `pop()`;
`#screen-count .kq-digitballoon.pulse` → `kq-balloonfloat`) rather than one
shared "balloon entrance" abstraction: the two screens already used two
different triggering helpers before this session for reasons specific to
each one's own timing structure (`pop()`'s hardcoded two-class shape vs
count's own small re-trigger helper), and forcing a shared entrance
function would have meant either widening `pop()` past that established
shape or losing the bounce-vs-float distinction the brief asked for by
name. Judged: not worth it for two three-line CSS rules that already read
clearly on their own.

**Verified**, same hidden-tab-honest discipline items 43/44 established
(this session's tab was a real, visible Chrome window — not automation's
usual hidden tab — but the same instrumentation was used anyway rather
than trusting a screenshot mid-flight):
- `node --check` clean on `kidq-desktop-app.js` (and the other three
  prototype JS files, untouched, checked anyway).
- **Contrast**, all eight digit-ink combinations and both balloon-vs-sky
  checks (bright + dimmed), computed directly (not eyeballed) — table
  above; full working in `scratchpad/balloon-*.js`, this session.
- **Balloon + digit computed styles per tick**, both screens, driven
  through a real `data-break` click with `window.setTimeout` never
  overridden (a visible tab, so real timers): tree's hue/digit sequence
  read back exactly `5:teal → 4:gold → 3:coral → 2:dusk → 1:teal` on BOTH
  legs (resets to teal each leg, matching `setTreeCount(0)`'s own hue
  reset); count's read back `1:teal → 2:gold → … → 9:teal → 10:gold` —
  both exactly `i % 4` against `BALLOON_HUES`, no drift, no off-by-one.
  Digit `color` sampled via `getComputedStyle` at all ten count ticks:
  `rgb(250,244,232)` (cream) on teal/coral/dusk, `rgb(46,42,36)` (ink) on
  gold — matches the table exactly, not just the class name.
- **8-width sweep** (390/600/601/900/1099/1100/1440/1920), both screens,
  worst-case content forced (tree: any digit; count: big="10" — the one
  two-character value — with the full nine-number trail): zero overflow,
  zero collision with the stage/sun/side-trees/trail at any width, via raw
  `getBoundingClientRect()` overlap checks, not a visual skim. "10"'s own
  text width measured against its balloon's width directly (a Range
  bounding box, not the flex box) — clears with 6.7–10px margin on each
  side across all three size tiers, comfortably inside the oval, never
  touching its edge.
- **Reduced-motion runs**, both screens, full hands-off: `animation-
  duration` reads `1e-6s` (the global crush) on both `.tapped` and
  `.pulse`, and both settle to `transform:none; opacity:1` — the wrapper's
  own rest state — confirmed by computed style, not inferred. A full
  reduced-motion tree run (real timers, real wall clock) reproduced the
  identical hue/digit sequence and landed within a few hundred ms of the
  normal-motion run's own ~26.6s total, confirming (as tree's own item 43
  already established for `pop()`) that reduced motion changes nothing
  about the `hold()`-driven schedule — this file has no
  `animationend`/`transitionend` listener anywhere (grepped), so it
  structurally can't.
- **Re-entrancy**: the tree break re-triggered a second time, same tab,
  same session, straight from the first run's celebration exit — balloon
  came back at `hue-teal`, digit `5`, trail `4 · 3 · 2 · 1`, no stale
  `hue-gold`/`hue-dusk`/`tapped`/`celebrate` residue carried over.
- **Console clean** across every run above (normal, reduced-motion,
  re-entrancy) — checked with `read_console_messages`, not assumed from a
  quiet screenshot.
- Served on an uncommon local port for every check above, `python -m
  http.server` on the prototype directory; killed after.

**Human check still needed, not simulated here:** whether the glossy
highlight and the bounce-vs-float distinction actually read as intended in
motion, and whether the balloon reads as clearly "balloon" rather than
"badge" at the smallest (390px) size — this environment confirmed geometry,
computed styles and timing, not the felt motion or the shape's silhouette
recognisability, in a real but unattended browser tab.

---

## Screen-by-screen design review (2026-09-15), in progress

A fresh pass through every child-mode screen, applying impeccable's
critique rubric (Nielsen heuristics, cognitive-load checklist, personas) by
hand — the native `impeccable detect` binary is still blocked on this
machine (`impeccable-exe-flagged-malware`), so this is a manual/degraded
run, not the automated dual-agent pipeline. Reviewed against the current
working tree (`design/balloon-rose-hue`, 2 commits ahead of main —
un-pushed WIP: muted digit-balloon hues + splash backdrop balloons).
Findings land here as each screen is reviewed; screens with nothing new to
report are noted as reviewed-clean rather than skipped silently.

### [ ] 46. `screen-login`'s star/cloud sky decoration is hand-duplicated from the splash screen
**Screen: "Who's watching today?" (profile picker).** `index.html:58-85`
(the predawn sky's stars + two cloud SVGs) is near-byte-identical to the
splash screen's own sky decoration at `index.html:40-47` — copy-pasted
rather than shared. Zero user-visible effect (both screens render
correctly); flagged as a P3 code-hygiene note, not a design defect. Worth
factoring into one reusable partial/template only if a third screen ever
needs the same predawn sky, not on its own.

**Screen 1 ("Who's watching") otherwise reviewed clean:** cognitive load
0/8 violations (single decision, 2 options), `:focus-visible` ring present
on `.kq-who`, `aria-label`s already use "touch" per the tap-to-touch sweep,
per-child colour-as-identity avatars reuse the app's own face-SVG grammar
rather than inventing a new one. No P0-P2 issues found. This screen has
already been through two prior manual impeccable audits (17/20, 18/20)
plus ADHD/Fable passes; nothing new surfaced here.

### [ ] 47. The choice-screen and high-five auto-advance timers give no visible signal that they're counting down
Run via `adhd-design-expert`, focused on items 25/38/40 rather than
re-relitigating whether the timers should exist (user-directed, already
decided). `CHOICE_AUTO_MS`/`HIFIVE_AUTO_MS` (`kidq-desktop-app.js:1305,
1376,1415,1463`) are plain silent timers — nothing on screen animates while
either 4-second window runs. Checked for an existing affordance that might
already cover this: `.kq-sun.kq-sunpick .halo{animation:kq-halopulse 3s
ease-in-out infinite}` (`css:229`) is the "this is the recommended pick"
marker, a constant loop that runs continuously before, during and after the
auto-advance window — confirmed it is not a countdown cue, just checked
against being mistaken for one.

**Why it matters:** a child with time blindness or impulsivity gets no
signal that something is about to happen in the next few seconds — the
auto-advance either surprises them or, over repeated sessions, trains them
to stop watching the screen during a wait. This is the same category of
concern items 25/38/40 already raised for the *indefinite*-wait version of
these screens; a silent bounded countdown is a smaller version of the same
gap.

**Tension, not resolved here:** the textbook ADHD-design fix (a visible
countdown ring, a shrinking halo, a ticking indicator) adds a widget to two
screens this brand deliberately keeps quiet — the same trade-off prior
ADHD passes on this project have weighed before and often declined (see
the rejected streaks/XP/confetti recommendations logged elsewhere in this
project's history). Flagged for a decision, not fixed unilaterally.

### [ ] 48. Splash-backdrop balloons share hue *names* with the hero letters but not their finish, and skip one hue with no stated reason
Run via `critique-color` against the WIP branch `design/balloon-rose-hue`.
The 3 new splash-backdrop balloons (`index.html:48-50`, `.kq-splashdrift`)
use `hue-teal`/`hue-coral`/`hue-dusk` — 3 of the digit-balloon system's 4
hues, skipping rose, with no reasoning recorded anywhere for which 3 were
picked. Measured independently (canvas-reconstructed CSS gradient, sampled
at the digit's actual rendered centre — not eyeballed) that the digit-text
contrast on all 4 flattened hues clears the 3:1 large-text floor with real
margin (teal 3.97:1, rose 3.99:1, coral 3.60:1, dusk 4.26:1 vs. cream text)
— so this item is a palette-coherence question, not a contrast defect.

The splash's hero KidQ letters (K/i/d/Q = teal/gold/coral/dusk) keep their
original glossy 5-stop recipe untouched (per the balloon-rose-hue commit's
own note), while the backdrop balloons use the new flat/muted recipe — so
the same screen now renders the same hue names two different ways at once.
That may well be the right call (flatter recedes behind the hero, which is
the stated intent of `.kq-splashdrift`'s reduced opacity), but it isn't
documented as a deliberate reason — it reads as a side effect of reusing
whichever component was nearest in the code. Worth confirming intent
before this goes into `brand.md` as a documented pattern rather than an
accident that happened to look fine.

### [x] 49. `#sleeping-sun`'s accessible name implies an action; tapping it gives no non-visual feedback
**Screen: "The sun is still asleep!" (no-session state).** `#sleeping-sun`
and `#waiting-moon` (`index.html:537,553`) are both real `<button>`s with
accessible names, but their click handlers (`kidq-desktop-app.js:1479-1483`)
only toggle a CSS wiggle/pop class — no text change, no ARIA live region,
no other state change. A screen-reader user who activates
`#sleeping-sun` (announced as "The sun is still sleeping — no videos
picked yet") gets no confirmation anything happened.

Low real-world priority for this product's typical audience (a 0-6 year
old is not a screen-reader user), flagged because WCAG 2.1 AA is this
project's pinned accessibility standard and the gap is real, not because
it blocks anything today. The design intent behind these two buttons is
sound and deliberately honest — a harmless fidget rather than a fake fix
for "no videos" — this item is about the buttons' accessible surface, not
their existence.

**Fixed (2026-09-15).** Both handlers now also update a new visually-hidden
`#no-session-announce` (`aria-live="polite"`), gentle-voice copy matching
the screen's own tone — "The sun is still sleeping. Shh!" /
"The moon is keeping watch. Shh!" — alongside the existing wiggle/pop.
Verified live: the region's text updates on each tap, no console errors.

**Repeat-tap gap caught in review, fixed same day.** An `aria-live` region
only announces on a genuine text change — touching the same button twice in
a row (the whole point of this screen's fidget) set identical text twice
and went silent on the second touch, reproducing the exact gap this item
closed. Fix: a shared `announceNoSession()` helper alternates a trailing
NBSP on a repeated identical set, used by both handlers so they can't
drift. Copy strings unchanged. Verified live: three consecutive taps on
`#sleeping-sun` produced three different `textContent` values in a row.

### [ ] 50. The session-strip cards' spring entrance still violates brand.md §4 — a previously self-identified violation that was never logged
Run via `improve-animations` against the watching screen. `.kq-pickwrap`'s
entrance (`kq-cardin`, `css:819-820`) uses a spring/overshoot easing
(`cubic-bezier(.34,1.56,.64,1)`, 600ms) for cards simply arriving on
screen — not one of brand.md §4's "earned" moments ("Default 400-600ms
ease-out. No bounces or pops by default — springy moments are earned:
sun tap, high five, break celebration"). The same shared class renders on
three screens: the watching session strip, the after-break choice screen,
and the all-done what's-next cards.

**Not new** — an earlier impeccable audit in this project caught the exact
same thing on the choice-screen cards and explicitly declined to fix it at
the time ("Same violation pre-exists on `.kq-pickwrap` (choice cards) from
an earlier round — precedent in the code, not in the brand. Don't treat
that as licence."), but it was never turned into a tracked item — confirmed
absent from this file before now. Logging it here closes that gap.

**Fix:** swap `kq-cardin`'s easing to the documented default (400-600ms
ease-out, no overshoot) everywhere `.kq-pickwrap` is used.

### [ ] 51. The sun's arc position and day-bar knob snap per tick instead of easing, unlike the sky veils driven by the same timer
Run via `improve-animations` against the watching screen. `positionSun()`
(`js:408-427`) and the day-bar's knob/veil width are written via direct
`el.style.left`/`top`/`width` on every `timeupdate`, with no CSS
transition — layout-triggering, not compositor-only. The dawn/ember sky
veils on the *same* screen, driven by the *same* timeupdate cadence,
correctly use `transition:opacity .9s linear`/`.4s` (`css:70-74`) — good
technique, confirmed not a "chasing a moving target" bug: a CSS transition
correctly reroutes toward a continuously-changing value, which is exactly
why the sky colour already reads as smooth despite discrete sampling. The
sun and knob don't get the same treatment, so they snap on each tick
instead of reading as continuous.

**Why it's low-medium, not high:** ticks are likely frequent/small enough
that the snapping isn't visible on typical hardware today. Flagged anyway
because it's a real inconsistency inside the same file, and a
`transform: translate()`-based position (instead of `left`/`top`) would be
both smoother and cheaper on more constrained hardware — this product's
own research names budget Android tablets as a real target device.

**Fix:** add an easing transition to `.kq-sun`'s position and `.knob`'s
position (matching the veils' pattern), or move both to a
`transform`-based position update. Cheap to do alongside item 50 since
both touch the same screen's motion code.

### Missed opportunity, not logged as an item: instant pause/play and expand/shrink icon swaps
Both use a hard `display:none`/`block` cut (`css:258-267`) rather than a
crossfade — functional and common, not broken. Noted only because the
`improve-animations` audit surfaces missed opportunities separately from
defects; not recommending a fix by default given this brand's explicit
stance against adding motion that isn't already there.

### [x] 52. The all-done screen's completion moment has no `aria-live` coverage, unlike every break screen
**Screen: All-done (high-five + what's-next).** The "Bye bye, Aarav!"
headline swap and the "Give me five!" → "What a day!" text swap
(`css:880-882,950-953`) both happen purely via `display:none`/`block`
class toggles on `.hifived` — no `aria-live` region anywhere on this
screen. This is the one place the pattern breaks: every break screen's
phase-change headline (`find-headline`, `follow-headline`, `tree-headline`,
`count-headline`, `breath-headline`) correctly uses `aria-live="polite"`,
confirmed while reviewing those screens. A screen-reader user tapping (or
being auto-advanced into, per item 38) the high-five gets the chime — audio
feedback with no content — and nothing that actually announces what
happened, at what is arguably the single highest-stakes moment in the
session (the celebratory close).

**Fix:** add `aria-live="polite"` to the container holding `#done-gn` and
`.hf-say`, or a dedicated visually-hidden live region announcing something
like "High five! Bye bye, Aarav!" on `.hifived`.

**Fixed (2026-09-15).** Went with the dedicated region, not the container —
`#done-gn`/`.hf-say` both swap via `.hifived` display toggles already, and
piling `aria-live` on top of them risked either a double announcement or a
race between the two text nodes. New visually-hidden `#done-announce`
(`aria-live="polite"`) is set once, in `fiveUp()` itself, whether the tap
landed or the auto-advance fired: "High five! What a day! Bye bye,
{name}!". Verified live via a direct `#high-five` click: the region's text
updates correctly (profile name interpolated), a second click is a no-op
per the existing `hifived` guard, no console errors.

**Repeat-completion gap caught in review, fixed same day.** A same-page
restart reaching all-done twice would set the identical string on the
second `fiveUp()`, going silent the same way item 49's repeat-tap did.
Smallest fix: `startAllDone()` now clears `#done-announce` to `""`
alongside its existing `.hifived` reset, so the next `fiveUp()` set is
always a real change from empty. Verified the mechanism live (clear, then
set the same string twice, confirming a genuine `textContent` transition
each time) — driving a full second real session to all-done in one page
load was attempted but hit an unrelated automation-environment stall
(the `setTimeout` compression used to fast-forward the session froze the
tab), so this is confirmed at the code/mechanism level per the reviewer's
own stated fallback, not via two full live completions.

### [x] 53. The cast screen's pause button and status pill are silent on state change, unlike the identical pattern on the watching screen
**Screen: Cast (visual mock).** `#cast-pause` (`index.html:668`,
`js:1504`) is visually identical to `#watch-pause` (same icon-swap
pattern) but its `aria-label` is hardcoded to "Pause the video on the TV"
and never updates. Compare `#watch-pause`, which correctly flips between
"Pause"/"Resume" on every click (`js:654`) and also syncs on the browser's
own pause/play events (item 39) — same component, two screens, one has
the accessibility fix and the other doesn't, most likely lost when the
cast screen's markup was adapted from the watching screen's.

Same root cause, second location on the same screen: `.kq-castpill`'s
"Playing on Living Room TV" / "Paused on TV" swap (`css:329-331`) is a
plain class-toggled `display:none`/`inline`, no `aria-live`, same silent-
status-swap shape as item 52.

**Fix:** update `#cast-pause`'s `aria-label` on click, matching
`#watch-pause`'s exact pattern; add `aria-live="polite"` to `.kq-castpill`
(or fold the two spans into one live-updated text node).

**Fixed (2026-09-15).** `#cast-pause`'s click handler now computes `pausing`
and sets the `aria-label` from it, same shape as `#watch-pause`'s own
handler — "Pause the video on the TV" / "Resume the video on the TV" (kept
the screen's existing longer copy rather than shortening to bare "Pause"/
"Resume", since cast has no player chrome around it for context the way
watching does). Took the smaller pill option: `aria-live="polite"` straight
on `.kq-castpill`, no restructuring of its two spans. Verified live:
clicking toggles the label both directions and the `.paused` class in sync;
the pill's visible span (`display:none`/`block`) swaps under the live
region with no console errors.

**Also confirmed while reviewing these screens (not an issue, stated for
the record):** the letterboxed dark area visible in every screenshot this
session is not a real layout bug — `getBoundingClientRect()` on `#app`
confirms it fills the full 1920×997 viewport with no `max-width` cap. It's
a display-scale artifact of this session's browser-automation tooling, not
something a real user would see.

### [x] 54. The splash screen's KidQ balloon letters aren't hidden from assistive tech, unlike every other decorative element in this app
**Screen: Splash (KidQ balloon-letter intro).** The four letter spans
(`<span class="balloon b1">K</span>` etc., `index.html:52`) have no
`aria-hidden="true"` — inconsistent with the pattern everywhere else in
this app: every decorative SVG (sun/moon rays, stars, clouds) carries
`aria-hidden="true"`, and the tree/count break screens hide their entire
digit-balloon container the same way (`index.html:344,382`). The section
already carries `aria-label="KidQ is opening"` as its accessible name
(`index.html:20`), so the four letters are redundant, unhidden content a
screen reader could read out separately ("K", "i", "d", "Q") when
navigating into the section.

Confirmed the new splash-backdrop balloons (item 48) don't share this
problem — their markup contains no text nodes at all, just empty
body/knot/string spans, so there's nothing for a screen reader to read out.

**Fix:** add `aria-hidden="true"` to each `.balloon-slot` (or one
`aria-hidden` wrapper around all four).

**Fixed (2026-09-15).** Added `aria-hidden="true"` to each of the four
`.balloon-slot` spans directly (`index.html`) rather than a wrapper, since
they're four sibling spans on one line with no existing container to hang
it on. Verified live: all four read `aria-hidden="true"` in the DOM,
zero visual change.

**Also confirmed while reviewing this screen (not issues, stated for the
record):** reduced-motion handling here is deliberate and already correct
— a documented override (`css:1262-1263`) zeroes the letters' stagger
delay under reduced motion so all four still visibly land before the
screen advances, and the screen's own `later()`-driven auto-advance
collapsing to ~200ms under reduced motion is appropriate here (unlike
breathing's item 31) since this screen carries no information the child
needs to perceive. Visually confirmed (forced render, screenshot) that the
WIP splash-backdrop balloons from item 48 read as calm background accents
behind the hero letters, not competing with them — achieves their stated
design goal.
