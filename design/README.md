# Child mode — design

The designed child-facing experience for `web/`, as a runnable prototype plus the
design system behind it. Nothing here is production code. It exists so the child
half of `web/` can be built without re-deciding what it should look like or how
it should behave.

`web/src/components` and `web/src/features` are still empty. This is what goes
in them.

## Start here

```bash
cd design/prototype && python -m http.server 8080   # then open localhost:8080
```

Or read it live: **https://shreena27.github.io/kidq-prototype/**

The demo bar in the bottom-right is a review aid, not part of the product. Use it
to restart the flow or jump to any screen.

## What the child sees

A parent picks a handful of videos. The child gets exactly those, in a session
that visibly ends. No algorithm, no autoplay into an endless feed, no infinite
scroll.

Time is a **sky**. The sun crosses an arc from sunrise to sunset across the
session, driven by real playback progress, so a child who can't read a clock can
still see how much of the day is left. When the sun sets, the session is over.
Between videos the sun comes down to play — short activity breaks that break up
screen time rather than extend it.

| Screen | What it is |
|---|---|
| Splash | Balloon letters, ~2.4s |
| Who's watching | Child picker, pre-dawn sky |
| Sunrise | One tap on the sun starts the session |
| Watching | Player, sun on the arc, day bar, full session strip |
| Playtime | Seam into a break |
| Break: breathe | Three slow breaths with the sun |
| Break: find 3 | Find three things of one colour in the room |
| After-break choice | Tap the sun for next, or pick any remaining video |
| Sunset → All done | High five, then what's next |
| No session | "The sun is still asleep" — deliberately no child CTA |
| Night light | After the session, a warm glow. No way back to videos. |
| Cast | Visual mock only |

Behaviour worth knowing before porting:

- **Breaks land on time, not on video count** — at the 1/3 and 2/3 marks of the
  session's minutes, each snapping to the nearest video boundary so a break never
  interrupts a video. Two videos gets one break, one video gets none.
- **The sun tracks allotted time, not videos finished.** Switching videos never
  rewinds it; rewatching something finished never pushes it forward.
- **Autoplay runs between videos, but never out of a break.** A break exists to
  interrupt screen time, so coming back from one always takes a tap.

## The seam: `KidQData`

`prototype/kidq-desktop-app.js` opens with a `KidQData` object. Everything else
only reads from it. It is a **stand-in for the API**, written before this
repo's API existed, so treat its shape as a statement of *what the child UI
needs*, not as a proposed contract.

```js
profiles:  [{ id, name, color, face }]
sessions:  { [profileId]: { totalMinutes, videos: [...] } | null }   // null = no session today
yesterdays:{ [profileId]: { totalMinutes, replay: true, videos: [...] } }
whatsNext: [{ label, scene, picked, pickedBy }]
// video: { id, title, minutes, pickedBy, src, poster }
```

## How this maps onto the real API

Read against `docs/api/README.md`. Some of this lines up; some of it does not
exist yet, and a little of it conflicts. Listed honestly so it can be settled
before anyone ports a component.

**Already supported**

| Prototype | API |
|---|---|
| `profiles` | `children` — `nickname`, `age_band` |
| Session length | `session_minutes` on `PATCH /children/:id` |
| Which break to serve | `break_type` on `PATCH /children/:id` |
| The pool a session draws from | `GET /children/:id/library` |
| Video poster | `card.thumbnails` |

**Not in the API yet — and on the roadmap**

`docs/status.md` lists "the session queue with break slots, and the Orange Break
Agent with its activity library" as a next slice. That is exactly this design's
core, so these are offered as input to that work rather than as gaps to paper
over:

- **A session** — an ordered, finite, parent-chosen list for *today*, distinct
  from the library. The child UI needs the order, since autoplay picks the next
  video with no child input.
- **Per-video duration.** The sun's position, "N min left" and break placement
  are all computed from real minutes. Estimates would visibly drift.
- **Break slots** in the session, and which activity fills each one.
- **Yesterday's session**, for the replay path on the no-session screen.
- **"What's next"** cards — currently invented.

**Confirmed requirement: parent attribution**

Showing who picked a video — "Picked by Mumma", "Picked by Papa", "Mumma & Papa
picked 4 videos" — is wanted, and stays in the design. It carries real weight
here: the heart icon and the picker's name are how the child feels a parent's
presence in the session, which is the emotional core of the whole product.

There is nothing to render it from today. Onboarding takes a single
`parent_name` on one account per family, so this needs a data answer. One
question decides how big that answer is:

- If attribution is **per item** — different videos credited to different
  parents, as the prototype shows — then a library entry needs to record who
  added it, and the family needs a notion of more than one parent figure.
- If it is **one family label** for the whole session, it is close to display
  copy and needs far less.

The prototype currently does the per-item version, since that is what was
designed. Worth confirming which was meant before building either.

**Conflicts to resolve**

1. **Playback through `KidQPlayer`.** Checked against
   `packages/kidq-player/src/index.tsx`. The sky-as-clock survives the port, but
   needs two small additive changes to the player. Neither breaks `admin/`.

   **a. Progress is tracked but not exposed.** The player already keeps `time`
   and `duration` in state, normalised across both providers — YouTube polled
   every 500ms (`getCurrentTime`/`getDuration`), HTML5 via native `onTimeUpdate`
   — and renders them in its own seek bar. But `KidQPlayerProps` only exposes
   `onEnded` and `onError`, and `KidQPlayerHandle` only `play`/`pause`/`seekTo`,
   so a parent component can neither receive nor poll position.

   500ms is ample for a sun crossing a 30-minute arc. The ask is just to surface
   what is already computed:

   ```ts
   onProgress?: (time: number, duration: number) => void;
   ```

   fired wherever `setTime` / `setDuration` already run. `onEnded` covers the
   rest of what the session needs.

   **b. The built-in control bar has to be suppressible in child mode.** The
   player always renders play/pause, **a clickable seek bar**, a
   **`0:12 / 3:45` time readout** and mute, with no prop to restrict them.

   **Decided: child mode is play/pause only.** That is a product decision, not a
   styling preference, and it rules out two of those:

   - **The seek bar.** No skipping and no scrubbing. A child should not be able
     to jump around inside a video their parent chose.
   - **The numeric clock.** The sun exists precisely because a child aged 0–6
     can't read one. `0:12 / 3:45` is the thing it replaces, so showing both
     undercuts the entire metaphor. This one is a display rather than a control,
     but it goes for the same reason.

   Child mode also draws one large brand-styled pause control on the player
   itself, not a control strip beneath it.

   The ask: a prop to suppress the default chrome — `chrome={false}` or
   `controls="none"` — with admin keeping today's behaviour by default. Child
   mode then draws its own control and drives playback through the existing
   handle, which already has `play()` and `pause()`.

   *Fallback if that prop is unwelcome:* child mode could hide the bar with CSS
   from a wrapper. It would work, but the bar is styled inline and would stay
   focusable for TV remotes unless separately handled, so it is fragile and
   worse for accessibility. The prop is the better answer.

   **Already aligned, worth noting:** `endCard` is annotated "later: the break
   activity", which is exactly this design's break seam; and TV Back keys
   (Tizen `10009`, webOS `461`) are handled in the player already.
2. **Casting.** This design assumed Google Cast in the MVP, with the child's
   device as sender. `docs/api/README.md` instead ships a thin hosted wrapper per
   TV platform and notes YouTube embeds need a real web origin. The cast screen
   in the prototype is a visual mock only, so nothing is blocked — but the two
   directions should be reconciled before that screen is built for real.
3. **TV remote focus.** The integration guide requires every control to be
   focusable and arrow-key operable with no hover-only UI. The prototype uses
   hover affordances and assumes pointer or touch. Focus states need adding
   during the port.

## Porting notes

The prototype is deliberately plain: one HTML file, one stylesheet, one closure
with a small state machine. It is not structured as React, because it was built
to settle design questions, not architecture.

- Layout is driven by **container queries** on `#app`, not media queries, at
  three tiers. One element inventory at every size; only arrangement and scale
  change. There is no separate phone layout.
- All colour, type, spacing and motion tokens are in `brand.md`. The stylesheet
  uses them directly, so it should map onto whatever styling approach `web/`
  adopts.
- Two animations are Lottie bundles recoloured to brand
  (`kidq-hifive-anim.js`, `kidq-breathe-anim.js`), each with a hand-built SVG
  fallback that shows if Lottie can't load.
- Reduced motion is honoured throughout.
- Media under `prototype/proposal-src/` is demo footage only and should not ship.

## Files

| Path | What |
|---|---|
| `concept.md` | Product concept, principles, guardrails |
| `brand.md` | Design system — tokens, type scale, motion tiers, geometry |
| `prototype/` | The runnable prototype |
| `mockups/kidq-desktop-mockups-v1.html` | Static frames at phone, tablet and laptop widths |

## Credits

Demo footage: *Big Buck Bunny* © Blender Foundation, CC-BY 3.0. Breathing
animation: *"Sunrise – Breathe in Breathe out"* by Palak Jain and high five:
*"Hand clap 2"* by Nicolas Binaghi, both LottieFiles, recoloured to brand.
Typefaces: Baloo 2 and Mukta by Ek Type.
