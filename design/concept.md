# KidQ — Product Concept

**One line:** Screen time that ends well.
**Sub-line:** Parent-picked. Finite. Made for India.

KidQ is a parent-curated, session-based kids' video app (PWA, phone-first,
casts to TV). The parent picks the videos and a session length; the child
gets a finite queue with no autoplay, no search, a visible timer, and a
calm, predictable ending. Status: concept + validated design mocks;
no code yet. Working prototype being built in Figma.

## The problem (research-grounded)

- 60-response survey (55 parents): the #1 frustration is **watching longer
  than intended** (27/60). The recurring pattern: child starts one
  acceptable video → recommendations decide what comes next → session runs
  long → parent has to intervene.
- Top feature demand: curated content (29), screen-time limits (27), no
  autoplay (21), interest recommendations (21), parent queue (18).
- Parents are not asking for *less* screen time — they want it **safer,
  calmer, purposeful, and easier to end**. The product job: "Help me give
  my child useful, age-appropriate screen time without constantly
  searching, supervising, or fighting to stop."
- India scale: LocalCircles (70K+ urban parents) — 47% of children 9–17
  spend 3+ hrs/day on video/social/gaming; 66% of parents report video
  addiction. YouTube Kids usage in India is negligible; Family Link sits
  at 1.6★. Children experience parental-control tools as surveillance
  (parent reviews 54% positive vs child reviews 5%).
- Smart TV is now the dominant device (30/60) → **casting is MVP scope**:
  parent phone → child TV is the natural flow.

## The product loop

**Curate → Queue → Watch → Stop.**

1. **Curate** — parent approves trusted, low-stimulation, age-appropriate
   videos (parent side not yet designed; AI-guided curation onboarding is
   a differentiator concept on file).
2. **Queue** — parent picks today's videos + total time ("Mumma picked
   3 videos · 25 min").
3. **Watch** — child gets autonomy *inside* the boundary: one tap starts
   the day; the queue advances itself; the ending is always visible.
4. **Stop** — no autoplay, ever. The session ends the way a day ends:
   sun sets, moon rises, "All done for today!", high five, and the
   parent-set next step ("Now: blocks with Dadi 🧱").

**Between videos: Playtime** (activity breaks). The sun hops off its arc
and leads a short off-screen activity — breathing (Stanford-evidenced),
eye exercise, yoga pose; library also includes find-3-red-things and
count-to-10. Then it returns to its arc and waits: "Tap the sun for your
next video." Nothing plays without the tap.

## Child-mode principles (locked)

- **One action per screen.** The sun is the only tappable hero. No nav,
  no search, no thumbnails to browse, no settings in child mode.
- **The sky is the timer.** Time is visible and finite without numbers:
  the sun travels an arc; the sky shifts cream → dusk → indigo. A small
  "12 min left" label serves parents.
- **The ending is never a surprise.** "The End 🌙" is a card in the queue
  from the first frame — the most important object on the screen.
- **Reopening the app does not reopen the tap.** After the session ends,
  the child gets a goodnight (moon night-light), not a path back in.
- **No session = the world is asleep.** If the parent hasn't picked
  videos, the sun is asleep; no child CTA, no nagging.
- **Affirmations, not rewards.** "You did it! ✨" — no points, badges, or
  streaks (expert guidance: avoid addictive reward loops).
- **Gentle transitions, no hard cut-offs.** Fades and sunsets, never
  alarms (expert guidance + design system motion rules).
- **Anti-overstimulation is the aesthetic.** Calm-playful hybrid on warm
  cream; the design itself makes the pitch: *this app is designed to end.*

## What KidQ must avoid claiming (expert guardrails)

No developmental "fixes" or milestone promises; not a substitute for
real-world interaction; quality content is not a license for longer
sessions; a supportive tool for parents, not a replacement.

## Platform & compliance constraints (on file, P0s not started)

- **YouTube dependency is the critical platform risk**: must use the
  official embedded player; `rel=0` doesn't fully remove related videos,
  so the strict-whitelist promise needs escape-path testing; no overlays
  on the player; derived-metrics policy limits custom scoring.
- **DPDP (India)**: under-18 regime → verifiable parental consent, no
  behavioural tracking of children, minimal child data; ~May 2027
  compliance horizon. Privacy-first is a strategic tailwind.

## Scope status

- **Child mode: designed + mocked** (9 screens, see
  `figma-prototype-spec.md`). Two playtime variants (eyes, yoga) are
  designed in spec but not yet mocked.
- **Casting: in MVP** (Google Cast / Remote Playback; TV plays the video,
  phone becomes the session clock and remote).
- **Parent mode: not designed yet** (assigned to another team member).
- **Delivery: PWA** (same shape as Ticklist), phone-first.

## Key documents

- `brand.md` — design system: palette, type, motion, components, voice.
- `figma-prototype-spec.md` — every frame + the prototype wiring.
- `docs/superpowers/specs/` — per-round approved design specs.
- `KidQ_India_Combined_Problem_Space_Analysis.docx` — north-star research.
- `Suvery Questions for the Kids app.xlsx` — combined research workbook
  (survey, competitor teardown, YouTube/DPDP risk sheets, wind-down
  evidence review).
- `KidQ_Survey_Insights_Deck_Updated(New).pptx` — survey findings deck.
- `KidQ_Expert_Discussion_Screen_Time.docx` — expert Q&A + guardrails.
- Mockups artifact: https://claude.ai/code/artifact/252278f8-220d-4c64-bda3-46645a1b356c
- Proposal artifact (pitch + moonrise ending): https://claude.ai/code/artifact/b2de792c-ce6f-4854-9db6-c9d6f0ac4bc8
- Design references (Mobbin picks): https://claude.ai/code/artifact/e8f561cd-80a7-4f58-bae8-cfbb884b596f
