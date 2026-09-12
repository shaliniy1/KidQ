# KidQ Recommendation System

How KidQ turns content into a scored, admin-approved library and recommends it to a child. This page is the implementation spec; it combines:

- [`architecture-process.md`](./architecture-process.md) — the scoring and architecture doc, kept verbatim except for a corrected sample score.
- [`../content-curation/README.md`](../content-curation/README.md) — sources, rights, rubric, lifecycle and "no automated approval".

Where the two disagree, the reconciliation table at the end records the decision.

## Pipeline

```text
Admin or parent adds content (URLs or discovery queries)
  → ingestion run: official source API → one transaction per item (source record, content item,
    rights, transcript status, outbox job)
  → worker: rule pre-checks → AI scoring agent (Gemini) → KidQ content score → suggested tags
  → Admin Content Studio: "Ready to approve" or "Needs attention"
  → admin reviews, edits, approves (single or bulk)        ← the only way anything becomes visible
  → recommendations for each child profile → parent adds to library → child player
```

## Admin gate

- Automation never publishes. The database enforces it:
  - `assessments_no_automated_approval`: only a HUMAN assessment may carry `APPROVED`.
  - `publication_decisions_admin_approval`: the system may take content down, never put it up.
- `content_items.current_status` changes only through `publication_decisions`.
- **Studio states** (`content_records_v.studio_state`):

  | State | Meaning |
  |---|---|
  | `PENDING_ANALYSIS`, `ANALYSING` | Waiting for, or in, the rule checks and AI scoring |
  | `READY_TO_APPROVE` | Every publish check passes |
  | `NEEDS_ATTENTION` | Safety flag, missing tags or scores, or low AI confidence |
  | `ANALYSIS_INCOMPLETE` | The AI couldn't score it; an admin rates it |
  | `FAILED` | A pipeline step failed after its retries |
  | `APPROVED`, `REJECTED` | Admin decision |

- **Publish checks** (`publish_blockers`): tags present (age, category, at least one goal), all four components scored, no unresolved critical flag, playable.
  - Bulk approval skips blocked items and reports why.
  - Single approval may override a critical flag with a written reason of 15 characters or more. The override is stored as a human rubric result plus a flagged decision.
- **Unpublish**: an admin decision of `MANUAL_REVIEW_REQUIRED`. The item leaves recommendations and libraries immediately.

## KidQ content score (`KIDQ_SCORE_V1`)

| Component | Weight | Higher is better when… |
|---|---|---|
| Content & language | 0.40 | themes, language and behaviour are safe and age-appropriate |
| Pacing | 0.25 | cuts are few and shots long, with time to process |
| Visual comfort | 0.20 | brightness is steady, saturation restrained, no flashing, uncluttered |
| Audio comfort | 0.15 | loudness is even, with no sudden peaks or jarring sounds |

- **Hard safety check first.** Any unresolved critical criterion FAIL withholds the score. Critical criteria: `physical_violence`, `verbal_or_emotional_aggression`, `frightening_imagery`, `mature_themes`, `discrimination_or_stereotypes`, `dangerous_behaviour`.
- **Formula**: `score = Σ(wᵢ·vᵢ) / Σwᵢ` over the measured components (0–100, one decimal).
- **Confidence**: `Σ(wᵢ × reliability(source))`, with HUMAN 1.0 · MODEL 0.8 · RULE 0.5.
- **Missing**: components nobody could measure are listed, e.g. "Visual comfort analysis unavailable".
- **Precedence**: for each component and criterion, HUMAN beats MODEL beats RULE, and the newest wins within a type.
- Raw component values are stored per assessment (`assessment_scores`), so weights can change later. Saving new weights creates `KIDQ_SCORE_V2` and rescores everything.
- The API is the only place the score is computed. UIs display the `content_score` object and never recompute it.
- Worked example: 96 / 78 / 89 / 87 gives **88.8**. The architecture doc's sample said 91; it's corrected there.
- **Picture books** (StoryWeaver) have no soundtrack. They're scored on Content & language, **Reading pace** (words per page, sentence length, vocabulary) and **Illustrations**, with the same weights renormalised over those three. Audio is neither weighted nor listed as missing, and confidence is measured against the three components' weight.

## AI scoring agent (Gemini)

- **What it sees**
  - YouTube: the public video URL is passed straight to Gemini (frames at 1 fps plus audio). KidQ downloads nothing.
  - NASA and Wikimedia: the file is streamed to the Gemini Files API only when the item's rights allow a copy (NASA public domain, Wikimedia CC/PD). It's capped at 100 MB / 20 min and deleted right after scoring.
  - StoryWeaver books: every page's text plus each illustration (a small rendition, sent inline and not kept).
  - Only the item, its public metadata and the rubric are sent — never any parent or child data.
- **What it returns** (one structured call, validated with zod):
  - the four component scores, each with evidence, mm:ss timestamps and a self-confidence
  - every rubric criterion as PASS / FAIL / UNKNOWN
  - suggested tags drawn only from the taxonomy
  - a two-sentence `kidq_summary`
- **What it can't do**: approve anything. A critical FAIL makes its assessment `REJECTED` (a recommendation) and withholds the score. Self-confidence below 0.5 sends the item to Needs attention.
- **Failures**
  - Invalid output gets one retry, then `ANALYSIS_INCOMPLETE`.
  - A private, unlisted or blocked video means the admin rates it.
  - Transient errors retry with backoff.
- **Free-tier guard**
  - At most 7.5 hours of YouTube video per day (`AI_DAILY_VIDEO_SECONDS_CAP`), against Google's 8-hour free limit.
  - When Gemini reports a model's daily request quota used up, KidQ records it (`ai_usage_daily.quota_exhausted_at`) and moves to the next model. Once every model is used up, AI calls and uploads pause until midnight Pacific. Paused items wait in *Pending analysis* and resume on their own; a quota never fails an item.
  - Per-minute limits wait out Gemini's `RetryInfo` delay, then retry.
  - **Model chain**: `AI_SCORING_MODEL` (3.8 Flash) first, then `AI_FALLBACK_MODELS` (3.7, then 3.6 Flash) when a model's daily quota runs out or it's overloaded. On the free tier that's about 60 items a day (20 per model). One family keeps scores comparable: on KidQ items, the three scored within about 5 points of each other, while Flash-Lite models scored calm clips about 25 points higher and one raised false safety flags (test of 2026-09-12). Each score records its model. If every model is busy, the item waits a few minutes without using up a retry.
  - Parent requests are scored first.
- **Scoring the backlog**: items saved while AI scoring was off, or never reviewed, go to the AI in bulk from the dashboard ("Score N items with AI", `POST /content-items/bulk-reanalyze`), shortest first. Rejected items are skipped.
- **Cache**: no new call when content hash, rubric version, prompt version and model are all unchanged.
- **Audit**: every call records model, snapshot, prompt and rubric versions, tokens and estimated cost (README "Model assessment record").

## Recommendation engine (`RANK_V1`)

1. **Eligible**: approved, playable, no unresolved safety flag, scored, and tagged with age, category and at least one goal.
2. **Hard filters**: the child's age (from their age band) is within `[age_min, age_max]`, the language matches, the category is one the parent chose when they picked "Let me choose categories", and the item isn't already in the library or recently dismissed.
3. **Relevance** (0–1): overlap of interests (0.4), development goals (0.3), regulation goals (0.2) and preferred categories (0.1), counting only the dimensions the parent filled in.
4. **Rank** = 0.45·relevance + 0.35·(score/100) + 0.10·expert (0.5 when there are no reviews) + 0.10·preference (the item fits in one session).
5. **Diversity**: at most three items per creator in the top 20.
6. **Cold start**: when nothing overlaps, the best-scored age-appropriate items fill the feed, labelled as such.

Views, likes, subscribers and trending are never inputs. Every result carries `why` (matched tags, in plain words) and the full content card.

## Taxonomy and age groups

- One admin-editable vocabulary: `GET /taxonomy`, stored in `taxonomy_terms`. Admin tagging, AI suggestions and parent onboarding all use the same keys; unknown keys are rejected.
- It is the onboarding vocabulary ([parent onboarding](./parent-onboarding.md)), as the architecture doc's §9 requires:
  - Age groups: **0–2, 2–3, 3–4, 4–5, 5–6**. Items store `age_min` / `age_max`, and groups are derived from them.
  - Categories: the twelve onboarding chips, from Animation to Knowledge / General Learning. Stories are story videos; Storybooks are picture books.
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
| Safety | Exclusion FAIL → REJECTED | Critical → Needs admin review | Automated "reject recommended" + score withheld; only an admin decides |
| Score | "Assessment", not a score | KidQ Score 0–100 | Score is a versioned projection of assessments |
| Pacing / visual / audio | No downloads | Analyse media | Gemini watches the public video; admins adjust |
| Age | 0–2 / 2–4 / 4–6 | One-year bands | 0–2, 2–3, 3–4, 4–5, 5–6 — the onboarding bands — stored as min/max |
| Filters vs ranking | — | Interests and goals as filters | Hard filters: age, language, and the categories a parent chose. Interests and goals rank (hard AND-filters empty a 300-item catalogue) |
| Parent URLs | Only APPROVED reaches children | Parent keeps or removes | AI score shown to the parent; admin approval before the child sees it |

## Not built yet

Activities and break rules, session timer, child player sessions, TV pairing, Openverse and Internet Archive connectors, StoryWeaver (pending license review), and AI calibration against a hand-labelled set.
