# Parent onboarding (P2 revision)

How KidQ implements the revised **P2 · Child Profile & Preferences** spec, which is reproduced at the end as given. The screens belong to the parent app (`web/`); this page is the contract they build on.

## Status — 2026-09-12

- **Built**: the API and one vocabulary shared by onboarding and admin tagging. The parent-app screens come next (teammate).
- **To review before treating as authoritative**: the development-goal defaults per age band (Block C) and the session-length defaults (Block E). Both are product defaults, not clinical claims; the spec asks for the same expert review content gets.

## One vocabulary

Onboarding chips and admin tags use the same keys, served by `GET /taxonomy`. The architecture doc (§9) asks for content "categorized using onboarding-compatible attributes".

- **Age bands**: 0–2, 2–3, 3–4, 4–5, 5–6 (`age_group`). Content keeps its exact minimum and maximum age; the bands are derived from them.
- **Categories** (Block B): the twelve chips — Animation, Stories, Storybooks, Crafts, Painting, Science, Maths, Yoga, Activities, Educational, Music / Rhymes, Knowledge / General Learning.
  - **Stories**: story videos, animated or told. **Storybooks**: picture books read in the KidQ reader (StoryWeaver).
  - Categories from before this change were retired and their content moved: Animals / Nature → Knowledge / General Learning; Baby Learning and Trusted Educators → Educational; Games / Play-Along → Activities; Creativity → Crafts. Creativity remains a development goal.
- **Interests** (Block A): the 19 interests in `GET /taxonomy` are the list. This closes the spec's open item.
- **Development goals** (Block C): the eight goals from the architecture doc. Parents never see them.
- **Regulation goals** (Block D): the six engine tags. Parents see the wording in `meta.parent_label` ("Help them calm down", …).
- **Languages**: `en`, `hi`, `es`.

## Screens and blocks → API

| Spec | API | Default / rule |
|---|---|---|
| P1 consent | — (unchanged) | |
| Screen 1 | `POST /onboarding` `{ parent_name, language, children: [{ nickname, age_band }] }`, 1–6 children | One transaction. A nickname only, never a legal name; no birth date is collected. |
| — | `GET /me`, `PATCH /me` | `GET /me` answers `404 NOT_ONBOARDED` until Screen 1 is done. `PATCH /me` changes the name or language. |
| Screen 2 "Start using KidQ" | nothing to send | Every child already has age-based defaults. |
| Screen 2 "Customize for {child}" | `PATCH /children/:id` | Only the fields sent change. |
| Language | `language` (parent), `languages` (child) | The parent's pick. The app pre-selects the device language when KidQ has it, otherwise English. Children start with the parent's language. |
| Block A | `interests` | `[]` — broadens the feed, never narrows it. |
| Block B | `content_mix` + `preferred_categories` | `SURPRISE` (default): an age-appropriate mix. `CHOSEN`: only those categories, at least one (`400 CATEGORIES_REQUIRED`). Sending categories alone means CHOSEN. |
| Block C | `development_goals` (read) | Never asked. Filled from the age band (table below); `development_goals_source` says `AGE_DEFAULT` or `PARENT`, for a future advanced toggle. |
| Block D | `regulation_goals` | `[]` means all, with no restriction; sending all six is stored as `[]`. |
| Block E | `session_minutes` (15 / 30 / 45 / 60 / 90), `break_type` (`MOVEMENT`, `QUIET`, `ALTERNATE`) | 15 minutes under age 3, 30 from 3; `ALTERNATE`. The response's `break_plan` has one break per 15 minutes, and the last is always the wind-down. |
| — | `POST /children` | Adds a child later; 6 per family at most (`422 TOO_MANY_CHILDREN`). |

Block C defaults:

| Age band | Development goals |
|---|---|
| 0–2 | Motor skills, Communication, Emotional |
| 2–3 | Communication, Emotional, Social |
| 3–4 | Social, Emotional, Creativity |
| 4–5 | Cognitive, Creativity, Problem solving |
| 5–6 | Cognitive, Problem solving, Learning |

- **As the child grows**: `age_years` is the band's midpoint plus the time since the parent set it, and `age_band` follows. A child entered as 3–4 shows as 4–5 a year later. Setting a new band resets the clock.
- **Recommendations** filter by age (against each item's age range), language, and the chosen categories when the mix is CHOSEN. They rank by interests, development goals, regulation goals, the KidQ score, and whether an item fits in one session ([recommendation README](./README.md)).
- **Not built yet**: the session and break runtime — timer, break screens, wind-down. The settings and the derived plan are stored now.

---

## The spec, as given

Headings are shifted down one level to fit this page.

### KidQ Parent Onboarding — Field Spec (P2 revision)

Revises **P2 · Child Profile & Preferences** in `KidQ_Screens_and_Logic.docx` / `KidQ_System_Map.docx`. P1 (DPDP consent gate) and P3–P5 (onboarding path, AI suggestions, recommendation screen) are unchanged and sit before/after this, respectively.

Design principle: only two fields per child are ever mandatory. Everything else defaults from age and is reachable through one "Customize" expansion — same "skippable" philosophy already in the docs, tightened from a 6-field mandatory screen down to 2.

#### Screen 1 — Mandatory (cannot skip)

```
Parent name
Number of children          [stepper, 1-6, default 1]

Per child (repeat for count above):
  Child's nickname            [free text — nickname only, never legal name, per DPDP minimization already in P1]
  Child's age                 [single picker: 0-2 / 2-3 / 3-4 / 4-5 / 5-6 — same bands Admin uses to tag content, so vocab matches exactly]
```

Tapping Continue with just this produces a working, age-appropriate library. Nothing else below is required.

#### Screen 2 — Default confirmation

**Copy:** "We've set up [Child]'s KidQ using just their age. Start right away, or fine-tune it below."

**Actions:** `[ Start using KidQ ]` (primary) → skips straight to P3 (existing three-door path) · `[ Customize for {child} ]` (secondary) → expands Blocks A, B, D, E below.

#### Optional Block A — Interests

Multi-select chips, no minimum, default = none selected (empty = broadens the library, doesn't narrow it).

**Open item:** the docs don't fix an Interests tag list the way they fix Content Category — this needs a finalized vocabulary from the content/Admin side before it ships, since P2's rule is that parent-facing vocabulary must match Admin's classification tags exactly.

#### Optional Block B — Content mix

Two-choice "lockdown," not a category checklist, per your instruction:

```
( ) Surprise us — a good age-appropriate mix        [default]
( ) Let me choose categories  →  reveals existing Content Category
    chips from KidQ_Architecture_Process.md §9:
    Animation · Stories · Storybooks · Crafts · Painting · Science ·
    Maths · Yoga · Activities · Educational · Music/Rhymes ·
    Knowledge/General Learning
```

#### Optional Block C — Development goal (never shown to parent)

Per your instruction — parents won't know these, so don't ask. Age band sets a default weighting instead, using the existing tag set from `KidQ_Architecture_Process.md` §9:

| Age band | Default Development Goals |
|---|---|
| 0–2 | Motor Skills, Communication, Emotional |
| 2–3 | Communication, Emotional, Social |
| 3–4 | Social, Emotional, Creativity |
| 4–5 | Cognitive, Creativity, Problem Solving |
| 5–6 | Cognitive, Problem Solving, Learning |

**Flag:** this table is a product-sequencing default for MVP, not a clinical claim — worth a quick pass from whoever KidQ already consults for content expert review (§7 of the architecture doc has a separate expert-review field for content; this table deserves the same scrutiny before it's treated as authoritative). If the team ever wants parents to see/adjust it, expose it as an advanced toggle under Customize — hidden by default per your instruction.

#### Optional Block D — Regulation goal

Parent-facing plain language, multi-select, default = all (no restriction). Maps to the existing engine tags in `KidQ_Architecture_Process.md` §9:

| Parent sees | Engine tag |
|---|---|
| Help them calm down | Calm |
| Manage big feelings | Emotional Regulation |
| Build focus | Focus |
| Burn off energy | Movement |
| Wind down before bed | Relaxation |
| Play nicely with others | Social Regulation |

#### Optional Block E — Screen time & breaks (one combined control)

Single duration picker, extending the session-length pills already shipped (15 / 30 / 45 min) with two more steps: **15 / 30 / 45 / 60 / 90 min.**

Break count is derived, not asked — one break per 15 minutes, shown live as the parent moves the picker:

| Session length | Total breaks | Mid-session breaks | Final break |
|---|---|---|---|
| 15 min | 1 | 0 | Wind-down only |
| 30 min | 2 | 1 | + Wind-down |
| 45 min | 3 | 2 | + Wind-down |
| 60 min | 4 | 3 | + Wind-down |
| 90 min | 6 | 5 | + Wind-down |

**Rule:** the last break is always the mandatory wind-down — the existing Sunset Indicator + moon-mascot closing sequence (design doc §5.3). It's never optional and never counted as a movement/quiet break.

Break type (optional, default = alternate):
```
( ) Movement (stretch, dance, get up)
( ) Quiet / calm (breathing, look away from screen)
(•) Let KidQ alternate            [default]
```

#### Open item — Preferred Language

Not mentioned in your list, but it's a required P2 field in the existing architecture doc (§10) and a recommendation-engine filter dimension (§11) — dropping it silently breaks language-based filtering. Recommend defaulting it to the parent's device/app language automatically (no screen shown) rather than removing the field outright, so the filter still has a value. Flagging for your call rather than deciding unilaterally.

#### Flow summary

```
P1 DPDP consent (unchanged)
  → Screen 1: parent name + per-child nickname + age   [mandatory]
  → Screen 2: confirmation
      → "Start using KidQ"     → P3 (unchanged)
      → "Customize"            → Blocks A, B, D, E → P3 (unchanged)
  (Block C runs silently in the background either way)
P3 Onboarding path / P4 AI suggestions / P5 Recommendation screen — unchanged
```
