# KidQ Recommendation System

How KidQ turns content into a scored, admin-approved library and recommends it to a child. This page is the implementation spec; it combines:

- [`architecture-process.md`](./architecture-process.md) — the scoring and architecture doc, kept verbatim except for a corrected sample score.
- [`../content-curation/README.md`](../content-curation/README.md) — sources, rights, rubric, lifecycle and "no automated approval".

Where the two disagree, the reconciliation table at the end records the decision.

## Pipeline

```text
Admin or parent adds content (URLs or discovery queries)
  → ingestion run: official source API → pre-screen (discovered items only) → one transaction per
    item (source record, content item, rights, transcript status, outbox job)
  → worker: rule pre-checks → AI scoring agent (Gemini) → KidQ content score → KidQ checks → suggested tags
  → Admin Content Studio: "Ready to approve", "Needs attention", or rejected by KidQ checks
  → admin reviews, edits, approves (single or bulk)        ← the only way anything becomes visible
  → recommendations for each child profile → parent adds to library → child player
```

## Admin gate

- Automation never publishes. The database enforces it:
  - `assessments_no_automated_approval`: only a HUMAN assessment may carry `APPROVED`.
  - `publication_decisions_admin_approval`: the system may take content down, never put it up.
- `content_items.current_status` changes only through `publication_decisions`.
- **Studio states** (`content_records_v.studio_state`):

  | State | Admin label | Meaning |
  |---|---|---|
  | `PENDING_ANALYSIS` | Draft | Waiting for, or in, the rule checks and AI review |
  | `READY_TO_APPROVE` | Ready to publish | Every check passed; one click publishes |
  | `NEEDS_ATTENTION` | Needs changes | An admin must act: `publish_blockers` says what to fix, and `analysis_status` shows when the AI couldn't review the item (`ANALYSIS_INCOMPLETE`) or the pipeline failed (`FAILED`) |
  | `APPROVED` | Published | Live for parents |
  | `REJECTED` | Rejected | Rejected by an admin, or by KidQ checks (`decision_source = SYSTEM`); an admin can restore it |

  `analysis_status` (QUEUED, ANALYSING, ASSESSED, ANALYSIS_INCOMPLETE, FAILED) and `current_status` (APPROVED, REJECTED, MANUAL_REVIEW_REQUIRED) are internal; screens show only the studio state. Five states since 2026-09-13: the dropped three are one-to-one parts of these.

- **Unpublish**: a decision of `MANUAL_REVIEW_REQUIRED`. The item leaves recommendations and libraries immediately.

## Publish policy

Confidence says how sure KidQ is; the score says how good the item is. **Nothing below 60% confidence is published without an admin's check.**

| Result | When | What happens |
|---|---|---|
| Dropped at the door | A discovered item fails the pre-screen: an unsuitable term (trailer, horror, exposé, slaughter), agency news, a briefing, promo or b-roll, an off-topic match (butterfly stroke), or a video under 15 seconds or over 15 minutes | Never stored. Counted in `records_rejected_before_ai` with a `REJECTED_*` code. Links an admin or a parent adds skip the pre-screen. |
| Rejected by KidQ checks | After an AI review: a safety flag or exclusion that the AI or an admin confirmed, or a score under 60 | A SYSTEM `REJECTED` decision naming the reason; an item that was live is unpublished instead. Any admin can restore it, and KidQ doesn't repeat the rejection on an item an admin kept in review. |
| Needs attention | A score of 60–69, confidence under 60%, a text-rule suspicion the AI hasn't cleared, or missing tags or scores | The admin checks the flagged parts |
| Ready to approve | A score of 70 or more, confidence of 60% or more, no flags, tags complete, playable | One click. Automation never publishes |

- **Publish blockers** (`publish_blockers`):
  - KidQ's judgements: `CRITICAL_FLAG`, `EXCLUDED`, `LOW_SCORE` (under 60), `BORDERLINE_SCORE` (60–69), `LOW_AI_CONFIDENCE` (item confidence under `min_ai_confidence`, 0.6).
  - Things to fix: `MISSING_COMPONENTS`, `MISSING_AGE`, `MISSING_CATEGORY`, `MISSING_GOAL`, `NOT_PLAYABLE`.
- **Overrides**:
  - A single approval may publish over KidQ's judgements with a written reason of 15 characters or more (`override_critical_flag: true`). Overruled safety and exclusion checks are stored as a human rubric result, and the decision is flagged.
  - Missing tags, missing scores and playback problems are always fixed first.
  - Bulk approval never overrides; it skips blocked items and reports why.
  - The error code is `CRITICAL_FLAG` when a safety flag is involved, `KIDQ_CHECKS` otherwise.

## KidQ content score (`KIDQ_SCORE_V2`)

The score measures how calm and safe an item is. What a child can learn is measured separately as learning value.

| Component | Weight | Higher is better when… |
|---|---|---|
| Content & language | 0.40 | themes, language and behaviour are safe and age-appropriate (suitability only, not educational value) |
| Pacing | 0.25 | cuts are few and shots long, with time to process |
| Visual comfort | 0.20 | soft, natural colours, steady light, no flashing, uncluttered |
| Audio comfort | 0.15 | loudness is even, with no sudden peaks or jarring sounds |

- **Hard safety check first.** Any unresolved critical criterion FAIL withholds the score. Critical criteria: `physical_violence`, `verbal_or_emotional_aggression`, `frightening_imagery`, `mature_themes`, `discrimination_or_stereotypes`, `dangerous_behaviour`.
- **Formula**: `score = Σ(wᵢ·vᵢ) / Σwᵢ` over the measured components (0–100, one decimal).
- **Evidence caps**: a failed check caps the part of the score it's about, unless an admin set that part:

  | Failed check | Caps |
  |---|---|
  | `rapid_visual_cuts` | Pacing at 50 |
  | `flashing_or_excessive_contrast` | Visual comfort at 40 |
  | `cluttered_visuals` | Visual comfort at 65 |
  | `loud_or_jarring_audio` | Audio comfort at 50 |
  | `direct_advertising`, `product_placement`, `unboxing_or_toy_review`, `franchise_led_promotion` | Content & language at 60 |

  The breakdown shows `capped_by`, and the reason says "Capped: pacing at 50 (rapid visual cuts)". An admin who clears the check lifts the cap.
- **Confidence**: `Σ(wᵢ × reliability(source) × certaintyᵢ) / Σwᵢ` over the applicable components.
  - Reliability: HUMAN 1.0 · MODEL 0.8 · RULE 0.5.
  - An admin's certainty is 1.
  - The AI's certainty is its self-confidence, lowered by up to 30% when it left sight-and-sound checks UNKNOWN, and by 15% on a component whose score needed a big cap. A full, sure AI review lands near 72%.
- **Missing**: components nobody could measure are listed, e.g. "Visual comfort analysis unavailable".
- **Precedence**:
  - For each component and criterion, HUMAN beats MODEL beats RULE, and the newest wins within a type.
  - A definite PASS or FAIL beats an UNKNOWN from a higher assessor, so "couldn't judge" never hides evidence.
- **Storage and versions**: raw component values are stored per assessment (`assessment_scores`), so weights can change later. Saving new weights creates the next version and rescores everything.
- The API is the only place the score is computed. UIs display the `content_score` object and never recompute it.
- Worked example: 96 / 78 / 89 / 87 gives **88.8**. The architecture doc's sample said 91; it's corrected there.
- **Picture books** (StoryWeaver) have no soundtrack. They're scored on Content & language, **Reading pace** (words per page, sentence length, vocabulary) and **Illustrations**, with the same weights renormalised over those three. Audio is neither weighted nor listed as missing, and confidence is measured against the three components' weight.

### Learning value

- A 0–100 measure of what the child can learn or do, kept apart from the score.
- It gets 25 points for each learning area where the AI or an admin found at least one filter-in criterion (rubric v3 tags each one):

  | Area | Filter-in criteria |
  |---|---|
  | Thinking | `clear_learning_objective`, `problem_solving_narrative`, `open_ended_questions` |
  | Language | `vocabulary_in_context`, `predictable_structure` |
  | Feelings & friends | `empathy_and_kindness`, `emotional_literacy`, `diversity_and_inclusion`, `constructive_conflict_resolution` |
  | Doing | `fine_motor_prompt`, `gross_motor_prompt`, `participation_prompts`, `meaningful_touch_interaction`, `craft_or_diy_extension`, `nature_exploration_extension`, `imaginative_play_extension` |

- It's null until someone has judged a filter-in criterion. Ranking uses it, and parents see its areas on the card.

## AI scoring agent (Gemini)

- **What it sees**
  - YouTube: the public video URL is passed straight to Gemini (frames at 1 fps plus audio). KidQ downloads nothing.
  - NASA and Wikimedia: the file is streamed to the Gemini Files API only when the item's rights allow a copy (NASA public domain, Wikimedia CC/PD). It's capped at 100 MB / 20 min and deleted right after scoring. Videos up to 5 minutes are sampled at 3 frames a second, so fast cuts and flashes are visible at all; YouTube stays at 1 fps until that's verified with a key.
  - StoryWeaver books: every page's text plus each illustration (a small rendition, sent inline and not kept).
  - Only the item, its public metadata and the rubric are sent — never any parent or child data.
- **Prompt v2** (`PROMPT_VERSION` in `api/src/ai/scoring-agent.ts`; bump it whenever the prompt or schema changes):
  - **KidQ's standard, stated up front**: slow, gentle, soft or natural colours, calm sound, kind. Bright, neon or harsh colours, flashing, fast cuts, loud sound and anything made for adults fall short.
  - **Score strictly**: most good children's content scores 70–85; 90+ needs clear evidence.
  - **Answer order**: the answer is written in this order (Gemini `propertyOrdering`): observations → every rubric criterion → component scores → tags. Inside each score and check, the evidence comes before the number or verdict.
  - **Observations** (video): cuts per minute, motion, palette (`SOFT_NATURAL`, `BRIGHT`, `HARSH`), flashing moments, loudness, sudden loud moments, speech pace, music, on-screen text, clutter, and intended audience (young children, older children, general, adults). Books report palette, clutter and audience.
  - **Score bands**: each component has bands, e.g. Pacing 90–100 at 6 cuts a minute or fewer, down to under 40 when frantic.
  - **Categories**: each of the twelve has a one-line definition (`taxonomy_terms.meta.definition`). The AI picks a primary category and up to two more.
  - **Ages**: the five age bands.
- **Evidence rules** (`api/src/domain/scoring/evidence.ts`): what the AI observed bounds its own scores, and overrides a contradicting answer. The raw answer stays in `assessments.output`.

  | Observed | Effect |
  |---|---|
  | More than 20 cuts a minute (30) | Pacing at most 55 (40) |
  | Constant fast motion | Pacing at most 70 |
  | Any flashing moment | Visual comfort at most 35, and `flashing_or_excessive_contrast` fails |
  | Harsh, neon or high-contrast palette | Visual comfort at most 45, and `flashing_or_excessive_contrast` fails |
  | Bright, saturated palette | Visual comfort at most 75 |
  | Busy, cluttered scenes | Visual comfort at most 65 |
  | Loud or spiky sound / intense music | Audio comfort at most 55 / 60 |
  | Made for adults | `developmental_mismatch` fails |
  | A picture book with more than 50 (80) words a page | Reading pace at most 80 (65), and the youngest age at least 4 (5) |

  KidQ measures the words per page, sentence length and long-word share from the stored pages itself. A bound that pulls a score down by more than 15 points lowers that component's self-confidence.
- **What it can't do**: approve anything. A confirmed safety or exclusion FAIL leads to a KidQ-checks rejection (see the publish policy); a critical FAIL also withholds the score.
- **Text rules no longer hold items back**: a keyword like "fight" goes to the AI with the item, and the AI confirms or clears it.
- **Failures**
  - Invalid output gets one retry, then `ANALYSIS_INCOMPLETE`.
  - A private, unlisted or blocked video means the admin rates it.
  - Transient errors retry with backoff.
- **Free-tier guard**
  - At most 7.5 hours of YouTube video per day (`AI_DAILY_VIDEO_SECONDS_CAP`), against Google's 8-hour free limit.
  - When Gemini reports a model's daily request quota used up, KidQ records it (`ai_usage_daily.quota_exhausted_at`) and moves to the next model. Once every model is used up, AI calls and uploads pause until midnight Pacific. Paused items wait in *Pending analysis* and resume on their own; a quota never fails an item.
  - Per-minute limits wait out Gemini's `RetryInfo` delay, then retry.
  - **Model chain**:
    - `AI_SCORING_MODEL` (3.8 Flash) goes first, then `AI_FALLBACK_MODELS` (3.7, then 3.6 Flash) when a model's daily quota runs out or it's overloaded.
    - On the free tier that's about 60 items a day (20 per model).
    - One family keeps scores comparable. On KidQ items, the three scored within about 5 points of each other, while Flash-Lite models scored calm clips about 25 points higher and one raised false safety flags (test of 2026-09-12).
    - Each score records its model. If every model is busy, the item waits a few minutes without using up a retry.
  - Parent requests are scored first.
  - **Schedule**: on QA, the daily `drain-jobs` GitHub workflow processes queued work at 08:15 UTC (13:45 IST), just after the quota resets.
- **Scoring the backlog**: items the AI hasn't reviewed with the current prompt go to the AI in bulk from the dashboard ("Score N items with AI", `POST /content-items/bulk-reanalyze`), shortest first. Rejected items are skipped: a rejected item never uses AI quota unless an admin re-analyses it (`POST /content-items/:id/reanalyze`).
- **Cache**: no new call when content hash, rubric version, prompt version and model are all unchanged.
- **Audit**: every call records model, snapshot, prompt and rubric versions, tokens and estimated cost (README "Model assessment record").

### Calibration

`npm run eval:scoring -w api` compares the AI with admins on items both have judged. It reads stored assessments only; there are no Gemini calls.
- **Components**: the average gap and bias per component.
- **Checks**: agreement on each check an admin answered, including false flags and misses.
- **Categories**: agreement with categories an admin set.
- **Slip-throughs**: items an admin rejected that the AI alone would have sent to Ready to approve.

Targets before "Ready to approve" is trusted without a second look:
- an average gap of 10 points or less;
- no slip-throughs;
- 85%+ category agreement;
- measured over 30 or more labelled items. Every admin score adjustment is a label.

### Re-curating the library

`npm run recurate -w api` (add `-- --apply` to make the changes; by default it's a dry run that prints a before → after table):
- re-runs the pre-screen on every discovered item;
- redoes rule-guessed categories, and puts Storybooks first on every picture book;
- rescores everything under the active version;
- queues everything not yet reviewed with the current prompt, published items first.

Run it once after deploying a new prompt or rubric version.

## Recommendation engine (`RANK_V3`)

1. **Eligible**: approved, playable, no unresolved safety flag, scored, and tagged with age, category and at least one goal.
2. **Hard filters**:
   - the child's age (from their age band) is within `[age_min, age_max]`;
   - the language matches;
   - with "Let me choose categories", **any** of the item's categories is one the parent chose;
   - the item isn't already in the library or recently dismissed.
3. **Relevance** (0–1): overlap of interests (0.4), development goals (0.3), regulation goals (0.2) and preferred categories (0.1), counting only the dimensions the parent filled in. For a child with only an age, the age band's default development goals count.
4. **Rank** = 0.45·relevance + 0.30·(score/100) + 0.15·(learning value/100) + 0.10·fit.
   - **Fit**: the average of age fit and session fit. Age fit is 1 when the child's age sits in the middle of the item's range and 0.5 at its edges. Session fit is 1 when the item fits one session.
   - An item nobody judged for learning ranks as if its learning value were 50.
   - The weights are versioned and configurable (`/config/ranking`).
5. **Variety**:
   - no two items of the same primary category side by side while another category is left, so books and videos interleave;
   - at most three items per creator in the top 20.
6. **Cold start and the default feed**: when nothing overlaps, the best-scored age-appropriate items fill the feed, labelled as such, with the same variety. A child whose parent gave only an age gets this mixed feed.

Views, likes, subscribers and trending are never inputs.

Every result carries the full content card and a `why`: plain-language reasons.
- Matched interests and goals.
- The favourite category.
- "Calm and gentle" for a score of 85 or more.
- The learning areas.

## Taxonomy and age groups

- One admin-editable vocabulary: `GET /taxonomy`, stored in `taxonomy_terms`. Admin tagging, AI suggestions and parent onboarding all use the same keys; unknown keys are rejected.
- It is the onboarding vocabulary ([parent onboarding](./parent-onboarding.md)), as the architecture doc's §9 requires:
  - Age groups: **0–2, 2–3, 3–4, 4–5, 5–6**. Items store `age_min` / `age_max`, and groups are derived from them.
  - Categories: the twelve onboarding chips, from Animation to Knowledge / General Learning, each with a one-line definition.
    - An item fits up to three (`categories`, primary first; `category` is the primary). A counting picture book is Storybooks + Maths.
    - Stories are story videos; Storybooks are picture books, always listed first on a book and never used for a video.
  - Interests, development goals and regulation goals: the seeded lists. Regulation goals also carry the parent wording (`meta.parent_label`).

## Parent-submitted links

1. A parent adds a public YouTube link.
2. KidQ saves it and the AI scores it (priority queue). The parent sees the score and breakdown.
3. "Keep" makes a `REQUESTED` library entry, which is first in the admin review queue.
4. On approval the entry becomes `ADDED` and the child can watch it. Until then it isn't playable (`player: null`).

## Reconciliation decisions

| Topic | Content-curation README | Architecture doc | Implemented |
|---|---|---|---|
| Status | Human-only `APPROVED / REJECTED / MANUAL_REVIEW_REQUIRED` | Pending → Approved / Rejected / Failed | `analysis_status` for the pipeline + `current_status` for publication; studio state derived from both |
| Safety | Exclusion FAIL → REJECTED | Critical → Needs admin review | A safety or exclusion FAIL the AI or an admin confirmed → a SYSTEM rejection an admin can reverse; a text-rule suspicion → the AI checks it and it waits in Needs attention. The score stays withheld on a critical FAIL. Decided with Shalini, 2026-09-13 |
| Score | "Assessment", not a score | KidQ Score 0–100 | Score is a versioned projection of assessments; learning value is separate |
| Pacing / visual / audio | No downloads | Analyse media | Gemini watches the public video; its observations bound its scores; admins adjust |
| Age | 0–2 / 2–4 / 4–6 | One-year bands | 0–2, 2–3, 3–4, 4–5, 5–6 — the onboarding bands — stored as min/max |
| Filters vs ranking | — | Interests and goals as filters | Hard filters: age, language, and the categories a parent chose. Interests and goals rank (hard AND-filters empty a 300-item catalogue) |
| Expert review | — | Expert reviews shown to parents and used in ranking (§7, §11) | Removed (decided with Shalini, 2026-09-13): no expert line for parents and no expert signal in ranking |
| Parent URLs | Only APPROVED reaches children | Parent keeps or removes | AI score shown to the parent; admin approval before the child sees it |

## Not built yet

- Activities and break rules, and the session queue with break slots for the Orange Break Agent (architecture doc §14–20).
- Session timer, child player sessions and TV pairing.
- Openverse and Internet Archive connectors.
- StoryWeaver still awaits its license review.
- Scoring:
  - the hand-labelled calibration set (the report is built; the labels aren't there yet);
  - 3-fps sampling for YouTube;
  - learning from parent behaviour.
