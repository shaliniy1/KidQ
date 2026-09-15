# Parent app ↔ Kid prototype: contradictions

Cross-check of the KidQ Parent prototype (claude.ai/artifact/D37uySKQGAymiN81HyCufp,
reviewed 2026-09-15) against the child-mode prototype (`design/prototype/`).
Each item is a place where the two interfaces currently promise different things.
Break-game completion (tree pose etc.) is tracked separately and excluded here.

---

## 1. Autoplay: parent toggle vs. always-on

- **Parent app:** Settings has an **Autoplay** on/off toggle ("Play the next
  video automatically within a session").
- **Kid prototype:** autoplay between videos is unconditional (`autoAdvance()`),
  and the after-break choice screen (item 25) and high-five (item 38) also
  auto-advance with no off switch.
- **Clash:** a parent who turns Autoplay off still gets an auto-advancing child
  session.
- **Needs:** an autoplay-off mode on the kid side. Natural fallback: the
  item-25 touch-gated choice screen becomes the between-video state when off.

## 2. Break schedule: parent-configured vs. hardcoded 2 breaks

- **Parent app:** session length 15/30/45/60/90 min × break interval every
  10/15/20 min ("30 min → 1 break"). Implies **0 breaks** (15 min session) up
  to **8 breaks** (90 min / every 10 min).
- **Kid prototype:** exactly 2 breaks, hardcoded — first is always "find",
  second rotates.
- **Clash:** every session config except "30–45 min at default interval"
  renders wrong on the kid side.
- **Needs:** break count/positions derived from session config; sun-arc math
  already works on progress fractions, but break scheduling and the
  first-break-is-always-find rule must generalise.

## 3. Break type: parent choice vs. fixed rotation

- **Parent app:** Break type = **Movement / Quiet–calm / Let KidQ alternate**.
- **Kid prototype:** rotation is hardcoded; breaks have no category tags.
- **Clash:** "Quiet–calm only" parent still gets movement breaks.
- **Needs:** tag each break (breathe, find = quiet-calm; follow, tree pose =
  movement) and make the picker respect the setting. Also means each category
  needs at least ~2 finished games for "alternate" to feel alive.

## 4. Attribution: "Mumma & Papa picked" vs. four content sources

- **Parent app:** library groups content as **Picked by parent / KidQ
  recommended / Community suggestion / Family Uploads**; its own analytics mock
  shows only **20% "Picked by you"** vs 72% KidQ-reviewed.
- **Kid prototype:** every screen credits the parents — "Mumma & Papa picked
  3 videos", "Picked by Mumma & Papa", "Mumma & Papa's picks", the beating
  heart as parent-presence.
- **Clash:** the kid mode's core emotional story is factually wrong for most
  of the queue under the parent app's model.
- **RESOLVED (2026-09-15): approved = picked.** "Add to Library" is the
  parent's pick; the child-side claim is "Mumma stands behind this," not
  "Mumma found this herself" — and that stays true across all four sources.
  No kid-side changes. **Contract note for the parent-side owner:** this
  only holds if sessions contain nothing the parent hasn't actively accepted
  into the library. The "Made for Aarav" flow's 6-pre-checked-cards bulk-add
  weakens "actively" — a parent who touches "Looks good" without unchecking has
  still made a choice, but the flow should never grow an auto-add path that
  skips the parent entirely, or the kid-side framing becomes a lie.

## 5. "skipped" status vs. no skip control

- **Parent app:** Insight Log shows per-video **skipped** (alongside completed
  / exited early).
- **Kid prototype:** deliberately has **no skip**. It can produce "completed"
  and "exited early" (child switched via a queue card), never "skipped".
- **Clash:** the parent spec implies a child-side control that the child mode
  has explicitly rejected (no-skip is a thesis decision).
- **RESOLVED (2026-09-15): status vocabulary mapped, no new child control.**
  Proposed contract for parent + backend owners: **completed** = video ended
  naturally · **exited early** = child switched away mid-video (queue-card
  touch) · **skipped** = queued but never started before the session ended.
  All three are derivable from what the child side already does
  (`watched`/progress vs. the queue); their Insight Log UI keeps its three
  labels unchanged. Explicitly rejected: a child-facing skip button — no-skip
  is a thesis decision, same family as no-search and no-feed.

## 6. Session start: parent's "Start session" button vs. child's touch of the sun

- **Parent app:** the flow ends on a big **Start session** button.
- **Kid prototype:** the session starts when the **child touches the sleepy sun**
  (one action per screen; the start belongs to the child).
- **Clash:** if the parent button force-starts playback on the child device,
  the sunrise screen and the child's start moment are dead.
- **RESOLVED (2026-09-15): arm, don't start.** The parent's button arms
  today's session: the child device flips from the no-session screen to the
  sunrise screen, and nothing plays until the child touches the sun. Zero
  kid-side changes — the no-session → sunrise transition is already the
  model; the parent's button is what causes the flip. Suggestions for the
  parent-side owner: (1) rename the button toward the arm framing their own
  headline already uses ("Ready when Aarav is") — e.g. "Set up Aarav's day"
  instead of "Start session"; (2) after arming, show "Waiting for Aarav to
  touch the sun 🌅" so the handoff is taught, not mysterious.

## 7. Sensory-friendly mode vs. reduced motion

- **Parent app:** "Sensory-friendly mode — softer sounds, calmer visuals,
  fewer transitions" as a cross-children setting.
- **Kid prototype:** only a reduced-motion toggle (visual only; jingle/chime
  volumes untouched).
- **Clash:** parent toggles a mode the kid side only half-implements.
- **RESOLVED (2026-09-15): one kid-side flag = reduce-motion forced on +
  all audio at ~40% volume.** Reduce-motion already delivers "calmer
  visuals, fewer transitions"; the only real gap was sound. Softer, never
  silent — the audio cues carry meaning (the autoplay-off nudge chime is how
  a pre-reader knows it's their move). Arrives as a session-config field
  like the others (their setting is family-wide; fine for us). Small build,
  queued after the config-driven-breaks round.

---

### Aligned, for the record (no contradiction)

- Analytics (screen time, completion %, "wind-down finished", source mix) is
  parent/backend territory — the kid side produces none of it. Whatever events
  feed those numbers are a backend contract, not kid-side UI.

- Autoplay scope "within a session" — matches the kid thesis (never past the
  last video).
- Analytics "factual patterns only, no mood or behaviour scores" — matches
  anti-gamification.
- Community content "only after admin approval" — matches the admin gate.
- Multiple children with per-child colour (Aarav/Meera) — kid side already
  models profiles and profile colour.
- Family Uploads playing in sessions — player/asset concern only, no kid UI
  change.
