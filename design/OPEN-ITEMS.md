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

### [ ] 17. Three more activity breaks
**"Follow me with your eyes" is done — shipped as follow the sun**, built on
`design/follow-the-ball-break` (Tasks 1–10 plus the closing verification
sweep) per `docs/superpowers/specs/2026-09-14-kidq-follow-the-ball-break-design.md`.
Still designed but not built: stand like a tree, count to 10 with eyes closed.
The cadence and rotation already support more entries with no other change.

Building it surfaced follow-ups that were logged in the spec (sections 11 and
13.7) but not yet tracked anywhere in this file — now items 26–35 below.

### [ ] 18. Decide: resume or restart a half-watched video
Returning to a partly watched video currently restarts it at 0:00. Resuming
where the child left off is the alternative. Deferred once already.

### [ ] 19. Confirm the session strip with the group
The strip lets a child switch video mid-session, which supersedes the group's
earlier "no switching before completion". Already flagged, and easy to revert.

### [ ] 20. Sync the phone mockups
`kidq-mockups-v1.html` still shows the pre-round-3 design — "The End" card, "Up
next" instead of the session strip, the old arc colour. Only worth doing if
those frames are still referenced.

### [~] 25. Can a small child actually get out of a break?
A break ends on "Tap the sun for your next video", and nothing continues until
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
