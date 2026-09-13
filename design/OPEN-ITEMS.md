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

### [ ] 3. Confirm what parent attribution means
"Picked by Mumma / Papa / Mumma & Papa" stays in the design. Which was meant?

- **Per item** — different videos credited to different parents, as the
  prototype shows. Needs a "who added this" field on the library entry, and a
  family to have more than one parent figure.
- **One family label** for the session — closer to display copy, far cheaper.

Onboarding currently takes a single `parent_name` on one account per family, so
either way something has to change.

---

## Needs both — design input into the session-queue slice

`docs/status.md` lists "the session queue with break slots, and the Orange Break
Agent with its activity library" as a next slice. This design is that surface,
so these are offered as input rather than raised as gaps.

### [ ] 4. A session, distinct from the library
An ordered, finite, parent-chosen list for *today*. The child UI needs the
order, because autoplay picks the next video with no child input.

### [ ] 5. Per-video duration
The sun's position, "N min left" and break placement all compute from real
minutes. Estimates would visibly drift across a 30-minute session.

### [ ] 6. Break slots on the session
Which slots exist and which activity fills each. Current design: exactly two,
at the 1/3 and 2/3 marks of the session's minutes, each snapping to the nearest
video boundary so a break never interrupts a video.

### [ ] 7. Yesterday's session
Powers the replay path on the no-session screen.

### [ ] 8. "What's next" cards
Shown after the session ends. Currently invented, with no source.

### [ ] 9. Reconcile casting
This design assumed Google Cast in the MVP, with the child's device as sender.
`docs/api/README.md` ships a thin hosted wrapper per TV platform instead, and
notes YouTube embeds need a real web origin. The prototype's cast screen is a
visual mock, so nothing is blocked yet — but the two directions disagree and
only one can be built.

---

## Ours — design and porting

### [ ] 10. TV remote focus states
The integration guide requires every control focusable and arrow-key operable,
with no hover-only UI. The prototype is pointer-and-hover first. Partly solved
already: the player handles TV Back keys (Tizen `10009`, webOS `461`).

### [ ] 11. Port the prototype into `web/`
Vanilla HTML/CSS/JS with one closure-scoped state machine → React components
under the App Router. Layout is driven by container queries on `#app` at three
tiers, with one element inventory at every size.

### [ ] 12. Three more activity breaks
Designed but not built: stand like a tree, count to 10 with eyes closed, follow
me with your eyes. The cadence and rotation already support more entries with no
other change.

### [ ] 13. Decide: resume or restart a half-watched video
Returning to a partly watched video currently restarts it at 0:00. Resuming
where the child left off is the alternative. Deferred once already.

### [ ] 14. Confirm the session strip with the group
The strip lets a child switch video mid-session, which supersedes the group's
earlier "no switching before completion". Already flagged, and easy to revert.

### [ ] 15. Sync the phone mockups
`kidq-mockups-v1.html` still shows the pre-round-3 design — "The End" card, "Up
next" instead of the session strip, the old arc colour. Only worth doing if
those frames are still referenced.
