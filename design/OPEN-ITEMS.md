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

Deepening went with it. Measured against the day sky's three stops, blue
`#6FA8DC` ran 1.98–2.38:1 and green `#5FA88A` 2.20–2.66:1, while red `#C2543F`
already sat at 3.54–4.28:1 — one dark swatch and two pale ones, not a set. Blue
is now `#3A75B0` (3.77–4.55:1) and green `#3F7F52` (3.76–4.54:1), which puts all
three in one band above 3:1 on every stop. The graphical-object exception still
means 3:1 is not *required* here; the argument for clearing it anyway is that a
child with low vision has to see the swatch to play at all. Green was chosen as
a true green rather than a deeper teal, so game content never reads as the UI
accent.

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
Designed but not built: stand like a tree, count to 10 with eyes closed, follow
me with your eyes. The cadence and rotation already support more entries with no
other change.

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
