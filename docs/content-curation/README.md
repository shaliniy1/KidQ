# KidQ Content Curation System

This document is the source of truth for discovering, ingesting, evaluating, storing, reviewing, and publishing KidQ content for children from birth to six years old. Use it when implementing source connectors, transcript retrieval, database integration, automated assessment, or curator tooling.

## Mission

KidQ is a small, trusted library of low-stimulation, age-appropriate, educational, creative, interactive, and developmentally meaningful content. Library quality and child safety take priority over catalogue size, popularity, views, likes, subscribers, or trending status.

KidQ does not reproduce YouTube, copy third-party media libraries, or automatically approve content based on metadata, creator reputation, or a platform's “Made for Kids” designation.

## Audience and taxonomy

Every item must target children aged 0–6. Items store a minimum and maximum age, from which these bands — the same ones parents pick in onboarding ([parent onboarding](../recommendation/parent-onboarding.md)) — are derived:

- 0–2 years
- 2–3 years
- 3–4 years
- 4–5 years
- 5–6 years

Every item must have exactly one primary content type:

- `VIDEO`: externally hosted video content
- `ACTIVITY`: a physical, creative, observational, verbal, or mental activity
- `STORYBOOK`: a narrated, illustrated, read-aloud, or digital story
- `INTERACTIVE_CONTENT`: a simple age-appropriate game, puzzle, matching exercise, or learning interaction

Categories are the parent onboarding categories (architecture doc §9), so parents choose from exactly what admins tag:

- Animation
- Stories (story videos, animated or told)
- Storybooks (picture books read in the KidQ reader)
- Crafts
- Painting
- Science
- Maths
- Yoga
- Activities
- Educational
- Music / Rhymes
- Knowledge / General Learning

Earlier categories were folded in: Animals / Nature → Knowledge / General Learning; Baby Learning and Trusted Educators → Educational; Games / Play-Along → Activities.

### Discovery topics

Connectors and query planners should cover the following topic vocabulary. This list is a discovery aid, not an approval signal:

- educational animation and calm animation
- alphabet learning, letters, phonics, vocabulary, and first words
- numbers, counting, simple maths, shapes, colors, patterns, sorting, and matching
- animal sounds, animals, fish, guppies, plants, nature, weather, and space
- body parts, emotions, manners, social skills, empathy, and kindness
- general knowledge and simple science concepts or experiments
- drawing, painting, coloring, crafts, DIY projects, and clay activities
- yoga, stretching, movement, dance, and breathing
- interactive, narrated, animated, and read-aloud stories
- guessing, imitation, observation, educational, and play-along games
- imaginative play and parent-child activities

Trusted educators such as Ms Rachel or Khan Academy Kids may be prioritized during discovery, but trust applies only to discovery order. Every individual item must pass the same KidQ rubric.

### Source priority

Process sources in this order unless a specific ingestion run says otherwise:

1. YouTube through the official YouTube Data API.
2. Whitelisted official educational YouTube channels.
3. StoryWeaver and other appropriately licensed children's story resources.
4. NASA educational and children's science or nature resources.
5. Other sources whose item-level embedding, storage, and reuse rights can be established.
6. KidQ-created activities, activity cards, and owned animations.

## Domain model

KidQ keeps external facts, KidQ judgments, and publication decisions separate:

- A **Source System** is an external platform or collection such as YouTube or NASA.
- An **Ingestion Run** is one traceable discovery or refresh attempt.
- A **Source Record** is the metadata observed for one external item.
- A **Content Item** is KidQ's canonical record.
- A **Rights Assertion** records item-level permission evidence.
- A **Transcript** is permitted text with its origin and storage rights.
- An **Assessment** is a versioned rule, model, or human evaluation.
- A **Publication Decision** is the human-controlled approval outcome.

See [`CONTEXT.md`](../../CONTEXT.md) for canonical terminology.

## Content lifecycle

```text
DISCOVERED
    ↓
METADATA_EXTRACTED
    ↓
RIGHTS_CHECKED
    ↓
TRANSCRIPT_FETCHED or TRANSCRIPT_UNAVAILABLE
    ↓
RULES_EVALUATED
    ↓
AI_ANALYSED
    ↓
MANUAL_REVIEW_REQUIRED
    ↓
APPROVED or REJECTED
```

Only `APPROVED` items may appear in the child-facing product. An AI assessment may recommend a status, but it cannot create the publication decision.

## Source collection

The machine-readable source inventory is [`config/content-sources.json`](../../config/content-sources.json). Connectors must use that catalog rather than inventing endpoints.

### Source matrix

| Source | Access method | What KidQ stores | Media handling | Status |
|---|---|---|---|---|
| YouTube | Official YouTube Data API | Video ID, metadata, caption availability, official embed URL | Stream with official embedded player | Recommended |
| NASA Image and Video Library | Official search and asset APIs | Metadata, source URLs, rights evidence | Reference or reuse only under applicable guidelines | Recommended |
| Wikimedia Commons | MediaWiki Action API | Metadata, creator, license, attribution, media URLs | Item-level license controls reuse | Recommended |
| Openverse | Official API | Aggregated open-media metadata and source landing URL | Verify the original item license | Conditional |
| Internet Archive | Official search and metadata APIs | Metadata, file inventory, item license | Require explicit item-level reuse rights | Conditional |
| StoryWeaver | Public web API (books-search, story reader); undocumented, so confirm with StoryWeaver before prod | Metadata, attribution, story text per page, illustration URLs | Only books whose story and every illustration are CC BY, CC BY-SA or CC0; illustrations stay at the source | Enabled for QA ([details](./storyweaver.md)) |
| KidQ | Internal authoring | Original activities and owned media | Store as KidQ-owned content | Recommended |

### Universal connector rules

1. Prefer an official API, feed, export, or documented integration.
2. Use generic page fetching only for explicitly allowlisted domains.
3. Respect terms of service, `robots.txt`, rate limits, and attribution requirements.
4. Record the source URL, external ID, connector version, fetch timestamp, and metadata hash.
5. Preserve the original API response in `raw_metadata` for audit and reprocessing.
6. Upsert by `(source_system_id, external_id)` so repeated runs are idempotent.
7. Verify rights at item level; source-level assumptions are insufficient.
8. Keep successful records when part of a batch fails and mark the ingestion run `PARTIAL`.
9. Never infer permission from public accessibility alone.
10. Never expose API keys in the browser, logs, content records, or GitHub.

### Connector result contract

Every connector returns a batch result even when no candidates are found:

```json
{
  "ingestion_run_id": "uuid",
  "source_system_id": "youtube",
  "connector_version": "1",
  "query": {},
  "started_at": "ISO-8601 timestamp",
  "finished_at": "ISO-8601 timestamp",
  "status": "SUCCEEDED | PARTIAL | FAILED",
  "records_seen": 0,
  "records_created": 0,
  "records_updated": 0,
  "records_unchanged": 0,
  "records_rejected_before_ai": 0,
  "errors": []
}
```

One malformed source item must not fail the entire batch. Store item-level errors with a redacted message, external ID when known, retryability, and timestamp.

### Fetch and retry policy

- Apply a descriptive user agent where the source permits generic HTTP clients.
- Set connection and response timeouts.
- Retry network timeouts, `429`, and transient `5xx` responses with bounded exponential backoff and jitter.
- Honor `Retry-After` when returned.
- Do not retry authentication, authorization, malformed-request, or license failures without a configuration change.
- Limit concurrency separately for each source.
- Persist pagination cursors in the ingestion run so interrupted jobs can resume.
- Redact credentials, authorization headers, cookies, signed URLs, and personal data from logs and stored errors.

## YouTube connector

YouTube discovery must use the official YouTube Data API. Do not scrape YouTube pages, download videos, cache video/audio files, or use unofficial transcript endpoints.

Use `search.list` with:

```text
part=snippet
type=video
safeSearch=strict
videoEmbeddable=true
regionCode=<target region>
relevanceLanguage=<target language>
```

Where useful, add:

```text
videoCaption=closedCaption
videoDuration=short
```

Retrieve full candidate metadata with `videos.list` using:

```text
part=snippet,contentDetails,status,topicDetails
```

Verify and store:

- public availability
- video ID and canonical source URL
- official embed URL
- title and description
- channel or creator
- thumbnails
- duration
- default language or audio language
- caption availability
- embeddable status
- Made for Kids status when returned
- license when returned
- tags or topics when returned

Use this playback URL:

```text
https://www.youtube.com/embed/{video_id}
```

“Made for Kids” is evidence, not approval. Every candidate still requires KidQ assessment and human publication review.

Official documentation: <https://developers.google.com/youtube/v3/docs>

### YouTube request sequence

1. Call `search.list` to discover candidate video IDs.
2. Deduplicate IDs within the response and against existing `source_records`.
3. Call `videos.list` in batches for full metadata.
4. Drop unavailable, private, deleted, or non-embeddable items before paid analysis.
5. Store the source record and rights assertion.
6. Record caption availability; attempt transcript work only through an authorized mechanism.
7. Run deterministic rejection checks.
8. Queue remaining candidates for moderation, classification, and human review.

The query must not rank primarily by views, likes, subscriber count, or trending status. Query planning and candidate ordering should prefer developmental fit, calmness signals, clarity, learning value, interaction, positive messaging, and offline activity potential.

## Other source connectors

### NASA Image and Video Library

Use the official search endpoint to find age-relevant science, nature, Earth, weather, planet, Moon, and space material. Store NASA ID, title, description, keywords, media type, creation date, preview/source URLs, and any credit or rights statements. NASA origin does not remove the need to inspect item-level third-party credits and age suitability.

Official documentation: <https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf>

### Wikimedia Commons

Use the MediaWiki Action API for discovery and `imageinfo` with URL, MIME, dimensions, and extended metadata. Store the creator, license name, license URL, attribution, source description page, media URL, and thumbnail URL. Preserve share-alike or attribution obligations in the rights assertion.

Official documentation: <https://www.mediawiki.org/wiki/API:Imageinfo>

### Openverse

Use Openverse for discovery of openly licensed images and audio that can support activities, story context, nature learning, or KidQ-owned presentations. Openverse aggregates upstream records, so approval requires verification against the original source landing page. Store both the Openverse record ID and upstream source details.

Official documentation: <https://api.openverse.org/v1/>

### Internet Archive

Use official search and metadata APIs. Store identifier, title, creator, description, language, media type, file inventory, and displayed license URL. Presence in the archive does not prove public-domain or reuse status. Ingest files or full text only when the item carries explicit rights that cover KidQ's intended use.

Official documentation: <https://archive.org/services/docs/api/>

### Allowlisted web sources

A generic web connector may run only for a configured domain with documented terms and extraction selectors. Its configuration must state:

```text
domain
allowed_paths
disallowed_paths
robots_policy
rate_limit
title_selector
creator_selector
description_selector
transcript_or_story_selector
license_selector
canonical_url_selector
embed_selector
connector_owner
last_terms_reviewed_at
```

Do not infer a transcript by stripping all page text. Extract only content explicitly identified as a transcript, story body, captions, or equivalent permitted source field.

## StoryWeaver connector

StoryWeaver is a required KidQ source for picture books. Its license review is recorded in [`storyweaver.md`](./storyweaver.md) (2026-09-12), and on that basis the connector is **enabled for QA**:

- It stores a book only when the book's attribution page releases the story and every illustration under CC BY, CC BY-SA or CC0, and records that as the rights assertion.
- It stores each page's text and the book's full attribution. Illustrations stay on StoryWeaver's servers; KidQ downloads no PDFs, ePubs, audio or video.
- ReadAlong audio and StoryWeaver videos stay out (often CC BY-NC-ND).

Two checklist answers are still open and must be closed before prod: StoryWeaver's confirmation that KidQ may use its undocumented API, and a review of its Terms of Use.

KidQ must not copy story text, illustrations, downloadable files, or generated transcripts merely because a story is publicly readable. Every storage or reuse operation needs a rights assertion that permits it.

### StoryWeaver license-review checklist

Before enabling automated StoryWeaver ingestion, record answers and evidence for:

- Is there a current official API, export, feed, or partner integration?
- Is automated retrieval allowed by the current terms and `robots.txt`?
- Which metadata fields may be stored indefinitely?
- What license applies to each story, translation, narration, and illustration?
- Does the license permit commercial use, if KidQ requires it?
- Does the license permit adaptation, translation, excerpting, and transcript storage?
- What attribution text, links, logos, or notices are required?
- May KidQ embed or deep-link to the reading experience?
- May downloadable files be cached, or must they stay at the source?
- Are there territorial, language, age, account, or redistribution restrictions?
- How must withdrawn or relicensed stories be handled?
- What rate limits and contact details govern the integration?

The answers and evidence are in [`storyweaver.md`](./storyweaver.md). Until its open items are closed, StoryWeaver runs in QA only, and like all content every book starts in `MANUAL_REVIEW_REQUIRED`.

## Transcript retrieval

Transcript retrieval should start automatically after metadata ingestion, but it must be permission-aware and asynchronous so transcript failure does not block discovery.

```text
Metadata saved
     ↓
Check caption/transcript availability and rights
     ↓
Permitted transcript exists → fetch and store
Owned/licensed audio exists  → authorized transcription
No permitted text exists     → record unavailable and require review
```

### YouTube transcripts

The Data API can report caption availability, but downloading a caption track requires authorization and permission to edit the video. For third-party videos, store `caption_available` and leave transcript text empty unless KidQ has an authorized source.

Official documentation: <https://developers.google.com/youtube/v3/docs/captions/download>

### Open-source and owned transcripts

- Fetch source-provided text only when its license permits storage.
- Transcribe only KidQ-owned or explicitly licensed audio/video.
- Store transcript origin, language, source URL, hash, permission status, confidence, and retrieval result.
- When full-text storage is not permitted, store availability, source URL, hash when possible, and an original short summary permitted by policy.
- Never treat a transcript as proof of visual or audio safety.

### Transcript state machine

Track transcript processing separately from content approval:

```text
NOT_REQUESTED
    ↓
QUEUED
    ↓
FETCHING
    ├── AVAILABLE
    ├── UNAVAILABLE
    ├── NOT_AUTHORIZED
    ├── STORAGE_NOT_PERMITTED
    ├── TRANSCRIPTION_REQUIRED
    └── FAILED_RETRYABLE / FAILED_FINAL
```

Store `retrieval_status`, `retrieval_error_code`, `attempt_count`, `last_attempted_at`, and `next_retry_at`. Never convert transcript failure into an empty transcript that appears successfully inspected.

## Required content record

Every normalized candidate must emit all fields. Use `null` for unavailable scalar values and `[]` for unavailable lists; do not omit required keys.

```text
content_id
content_type
title
source
source_url
embed_url
source_video_id
channel_or_creator
thumbnail_url
duration_seconds
language
caption_available
transcript
transcript_source
description
made_for_kids
embeddable
license_if_known
category
subcategory
age_min
age_max
age_band
learning_objective
skills_developed
topics
keywords
activity_supported
activity_title
activity_instruction
activity_duration_seconds
activity_type
filter_out
filter_in
filter_out_fail_count
filter_in_pass_count
content_status
rejection_reason
manual_review_reason
kidq_summary
fetched_at
provenance
```

Provenance must identify the connector/method, inspected fields, source timestamps, and whether audiovisual content was actually inspected.

### Canonical JSON example

The following shape is mandatory. Individual rubric keys are expanded in the next section.

```json
{
  "content_id": "youtube:VIDEO_ID",
  "content_type": "VIDEO",
  "title": "Example title",
  "source": "youtube",
  "source_url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "embed_url": "https://www.youtube.com/embed/VIDEO_ID",
  "source_video_id": "VIDEO_ID",
  "channel_or_creator": "Example creator",
  "thumbnail_url": "https://example.invalid/thumbnail.jpg",
  "duration_seconds": 180,
  "language": "en",
  "caption_available": true,
  "transcript": null,
  "transcript_source": null,
  "description": "Source-provided description",
  "made_for_kids": null,
  "embeddable": true,
  "license_if_known": "youtube",
  "category": "Baby Learning",
  "subcategory": "Counting",
  "age_min": 2,
  "age_max": 4,
  "age_band": ["2–4 years"],
  "learning_objective": "Recognize and count quantities from one to five.",
  "skills_developed": ["counting", "number recognition"],
  "topics": ["numbers", "counting"],
  "keywords": ["calm", "count to five"],
  "activity_supported": true,
  "activity_title": "Show Five Fingers",
  "activity_instruction": "Show me five fingers.",
  "activity_duration_seconds": 5,
  "activity_type": "IMITATION",
  "filter_out": {
    "rapid_visual_cuts": { "result": "UNKNOWN", "evidence": "Audiovisual content was not inspected." }
  },
  "filter_in": {
    "clear_learning_objective": { "result": "PASS", "evidence": "The title and description explicitly teach counting to five." }
  },
  "filter_out_fail_count": 0,
  "filter_in_pass_count": 1,
  "content_status": "MANUAL_REVIEW_REQUIRED",
  "rejection_reason": null,
  "manual_review_reason": "Audiovisual stimulation and age suitability require review.",
  "kidq_summary": "The candidate has a clear counting objective. It requires audiovisual and human review before publication.",
  "fetched_at": "ISO-8601 timestamp",
  "provenance": {
    "method": "youtube_data_api",
    "connector_version": "1",
    "inspected_fields": ["snippet", "contentDetails", "status"],
    "audiovisual_inspected": false
  }
}
```

`kidq_summary` must be at most two sentences. Evidence must identify what was actually observed rather than repeat the result label.

## Curation rubric

Every criterion returns `PASS`, `FAIL`, or `UNKNOWN` with one short evidence statement. Missing evidence produces `UNKNOWN`, not a guessed pass.

### Filter-out criteria

Assess every criterion separately:

| Key | Reject or flag when | Required evidence |
|---|---|---|
| `rapid_visual_cuts` | Cuts or scene changes are too fast for a young child to process | Direct visual inspection or measured scene-change evidence |
| `flashing_or_excessive_contrast` | Flashing lights or intense contrasting colors may overstimulate | Direct visual inspection or measured flashing evidence |
| `loud_or_jarring_audio` | Sudden loud effects, aggressive music, or constant chaotic noise appears | Direct audio inspection or measured loudness-change evidence |
| `cluttered_visuals` | Too many competing objects or movements obscure the learning focus | Direct visual inspection |
| `physical_violence` | Hitting, fighting, weapons, injury, or physical aggression appears | Transcript, source evidence, or audiovisual inspection |
| `verbal_or_emotional_aggression` | Threatening, bullying, humiliation, yelling, or emotional aggression appears | Transcript or audiovisual inspection |
| `frightening_imagery` | Monsters, darkness, threat, peril, or imagery likely to induce fear appears | Direct visual and contextual inspection |
| `mature_themes` | Adult relationships, complex social issues, substance use, or other unsuitable themes appear | Transcript and contextual inspection |
| `discrimination_or_stereotypes` | Prejudice or harmful stereotypes involving gender, race, religion, culture, disability, or identity appear | Transcript and visual/contextual inspection |
| `direct_advertising` | Commercials, explicit promotions, calls to purchase, or sponsor segments appear | Transcript, description, links, or audiovisual inspection |
| `product_placement` | Products or brands are promoted as part of the content | Metadata, transcript, or visual inspection |
| `unboxing_or_toy_review` | The primary purpose is unboxing or reviewing consumer products | Title, description, transcript, or visual inspection |
| `franchise_led_promotion` | Educational value is secondary to promoting a toy or commercial franchise | Contextual and visual inspection |
| `endless_or_open_loop` | Content is designed to continue indefinitely without a natural conclusion | Playback and product-flow inspection |
| `clickbait_title_or_thumbnail` | Sensational wording or imagery exaggerates the actual content | Compare title/thumbnail with inspected content |
| `repetitive_without_objective` | Repetition lacks a clear educational, creative, social, or motor objective | Transcript and content inspection |
| `passive_viewing_only` | The item provides no invitation to think, speak, move, predict, create, or interact | Transcript and content inspection |
| `developmental_mismatch` | Language, theme, motor demand, or complexity is substantially outside the assigned age band | Developmental review with specific examples |

### Filter-in criteria

Assess every criterion separately:

| Key | Pass when | Required evidence |
|---|---|---|
| `clear_learning_objective` | The item teaches a specific concept or skill | State the objective and where it appears |
| `vocabulary_in_context` | New words are introduced clearly with meaningful context | Identify example words and context |
| `problem_solving_narrative` | A simple challenge is recognized and constructively resolved | Summarize the problem and resolution |
| `fine_motor_prompt` | Tracing, matching, drawing, manipulating, or similar fine-motor action is encouraged | Identify the prompt |
| `gross_motor_prompt` | Movement, balance, stretching, jumping, or imitation is encouraged | Identify the prompt |
| `slow_deliberate_pacing` | Visual changes leave adequate processing time | Direct visual inspection or measured pacing evidence |
| `gentle_soothing_audio` | Narration, music, and effects remain calm without disruptive peaks | Direct audio inspection or measured evidence |
| `simple_uncluttered_visuals` | The main object or character is clear and backgrounds are minimally distracting | Direct visual inspection |
| `predictable_structure` | The item has a comprehensible beginning, middle, and end or repeated learning pattern | Describe the structure |
| `empathy_and_kindness` | Helping, sharing, caring, or perspective-taking is modeled | Identify the scene or transcript evidence |
| `emotional_literacy` | Emotions are named or expressed constructively | Identify the emotion and teaching moment |
| `diversity_and_inclusion` | People, cultures, families, or abilities are represented respectfully | Identify the representation without inferring identity |
| `constructive_conflict_resolution` | Disagreement is resolved gently and safely | Summarize the resolution |
| `participation_prompts` | Children are asked to answer, sing, imitate, point, count, or move | Quote or summarize the prompt |
| `meaningful_touch_interaction` | Touch interaction is simple, age-appropriate, and serves learning | Describe the interaction and objective |
| `open_ended_questions` | Questions invite thought or parent-child discussion rather than one fixed response | Identify the question |
| `craft_or_diy_extension` | A safe, practical creative activity can follow | Describe materials and supervision needs |
| `nature_exploration_extension` | The item encourages observation of the natural world | Describe the observation prompt |
| `imaginative_play_extension` | The item can lead to role-play or open-ended imagination | Describe the play prompt |
| `age_band_fit` | Theme, language, pace, and expected actions fit one or more KidQ bands | State the selected band and evidence |

Calculate `filter_out_fail_count` from individual filter-out results and `filter_in_pass_count` from individual filter-in results. Group-level summaries do not replace individual criteria.

### Evidence boundary

Metadata and transcript analysis cannot verify pacing, flashing, visual clutter, audio intensity, or frightening imagery. If audiovisual content was not inspected, these criteria remain `UNKNOWN` and the item remains `MANUAL_REVIEW_REQUIRED`.

## Activity connection

Every approved video or story should be considered for a separate follow-up activity. Activities encourage movement, thinking, observation, speech, imitation, imagination, creativity, counting, breathing, stretching, or parent interaction.

Examples:

| Content | Follow-up activity |
|---|---|
| Learn Colors | Find something red around you. |
| Animal Story | Can you make the animal's sound? |
| Counting to Five | Show me five fingers. |
| Yoga | Stand like a tree for five seconds. |
| Story about emotions | Show me your happy face. |

Micro-activities may last 2–10 seconds. Store activities separately from the video or story so KidQ can reuse, sequence, and own them independently.

### Activity catalogue

Micro-activity examples include:

- Clap three times.
- Jump twice.
- Touch your nose.
- Find something red.
- Find something round.
- Count five fingers.
- Make a lion sound.
- Make a happy face.
- Copy this movement.
- Stretch your arms.
- Balance like a tree.
- Take three slow breaths.
- Name this animal.
- Guess this color.
- Point to the bigger object.
- Repeat this word.
- Finish the pattern.
- Say what happens next.

Longer sessions may include yoga, drawing, painting, crafts, simple science experiments, matching, sorting, imaginative play, and parent-child activities.

Do not depend on YouTube for micro-activities. KidQ should create and store original activity cards and KidQ-owned activity animations. Each activity must include duration, supervision needs, materials, developmental skills, age bands, accessibility considerations, and safety notes when applicable.

## Decision rules

Each candidate receives exactly one status:

- `APPROVED`
- `REJECTED`
- `MANUAL_REVIEW_REQUIRED`

Apply these rules:

```text
Explicit exclusion criterion fails → REJECTED
Required evidence is missing       → MANUAL_REVIEW_REQUIRED
Audiovisual safety is unchecked    → MANUAL_REVIEW_REQUIRED
Model output is uncertain          → MANUAL_REVIEW_REQUIRED
Automated checks pass              → still requires human publication review
```

Popularity is never an approval or ranking signal.

## Low-cost automated analysis

Use automation as a cost-controlled cascade:

```text
Deterministic validation and exclusion rules
                ↓
OpenAI moderation on permitted text and thumbnail
                ↓
Low-cost structured classification
                ↓
Uncertain or high-risk result → stronger model or human review
```

### Model roles

- `omni-moderation-latest`: early harmful-content signal for text and images. OpenAI currently describes its moderation models as free. It is not a child-suitability classifier.
- `gpt-5-nano`: primary structured extraction and classification model for content type, age-band candidates, objectives, topics, transcript signals, and activity potential.
- Configurable stronger mini-tier model: escalation only for ambiguous, contradictory, multilingual, or high-risk results.

Official documentation:

- <https://developers.openai.com/api/docs/models/omni-moderation-latest>
- <https://developers.openai.com/api/docs/models/gpt-5-nano>

### Video scoring agent

Metadata and transcripts cannot verify pacing, flashing, visual clutter or audio intensity (see *Evidence boundary*). KidQ therefore scores video with a Gemini model that watches the video itself:

- **YouTube**: the model watches the public YouTube URL directly. KidQ still downloads nothing.
- **NASA and Wikimedia**: for items whose rights assertion permits a copy, the file goes to a temporary Files API upload that is deleted right after scoring.
- **StoryWeaver picture books**: the model reads each page's text and sees each illustration (a small rendition, sent inline and not kept). A book has no soundtrack, so it's scored on three components.

Its output is a MODEL assessment with `audiovisual_inspected=true`. It can recommend rejection but never approval. Component scores, weights, the free-tier guard and the admin gate are specified in [`docs/recommendation/README.md`](../recommendation/README.md). OpenAI moderation remains an optional second safety opinion.

### Token controls

1. Run source, duration, embeddability, license, deduplication, and blocked-term checks without an LLM.
2. Send only relevant source facts and permitted text, not the complete API response.
3. Require compact Structured Outputs matching the KidQ schema.
4. Use stable criterion keys and keep full rubric definitions in application code.
5. Cache by `content_hash + rubric_version + model_snapshot`.
6. Skip unchanged content.
7. Chunk long transcripts once and aggregate only criterion evidence.
8. Limit evidence to one factual sentence per criterion.
9. Record input and output tokens for every model assessment.
10. Evaluate model changes against a human-labelled KidQ test set before production use.

Prefer false manual-review referrals over false approvals.

### Model assessment record

Store enough detail to reproduce and price every model decision:

```text
content_item_id
assessor_type
model_name
model_snapshot
prompt_version
rubric_version
input_hash
input_tokens
cached_input_tokens
output_tokens
estimated_cost
result
criterion_results
summary
audiovisual_inspected
created_at
```

The model receives only evidence KidQ is permitted to process. Model output must conform to a strict JSON schema, and schema failure must route the item to retry or manual review rather than silently dropping fields.

## Database design

PostgreSQL is the production system of record. The initial schema is [`api/db/migrations/001_content_catalog.sql`](../../api/db/migrations/001_content_catalog.sql).

### Tables

| Table | Responsibility |
|---|---|
| `source_systems` | Connector identity and version |
| `ingestion_runs` | Query, status, counts, timing, and errors for each run |
| `content_items` | Canonical KidQ content metadata and current status projection |
| `source_records` | External IDs, URLs, raw metadata, hashes, and provenance |
| `rights_assertions` | License and permission evidence |
| `transcripts` | Permitted transcript text, origin, hash, and confidence |
| `assessments` | Versioned rule, model, and human assessment summaries |
| `assessment_criteria` | Per-criterion `PASS` / `FAIL` / `UNKNOWN` evidence |
| `activities` | KidQ-owned or linked offline activities |
| `publication_decisions` | Human approval and rejection history |

### Field ownership

| Field family | Authoritative owner |
|---|---|
| External title, description, duration, creator, thumbnail, availability | Latest verified source record |
| Source URL, external ID, embed URL | Source connector |
| License, attribution, storage and adaptation permissions | Rights assertion with evidence |
| Transcript text and origin | Transcript job and rights assertion |
| Age bands, learning objective, categories, topics, rubric results | Versioned assessments |
| Current child-facing title or summary | Approved KidQ editorial revision |
| Published status | Latest authorized publication decision |

Do not update `content_items.current_status` independently of a publication decision. Treat it as a transactionally maintained projection for fast reads.

### Rights model

Rights must be nullable rather than assumed. Record each permission separately:

```text
allows_embedding
allows_metadata_storage
allows_thumbnail_storage
allows_transcript_storage
allows_media_storage
allows_adaptation
allows_commercial_use
attribution_required
license_name
license_url
evidence_url
evidence_text
checked_at
```

Unknown permission means the related operation is disabled. A new rights assertion supersedes earlier evidence without deleting history.

### Database write transaction

For each normalized item, one transaction should:

1. Lock or upsert the unique source record.
2. Create or link the canonical content item.
3. Write immutable raw metadata and its hash.
4. Write the current rights assertion.
5. Queue transcript and assessment jobs through a durable outbox record.
6. Commit before acknowledging the source item.

This prevents a saved content row from losing its provenance or follow-up jobs when a process crashes.

### Storage boundaries

PostgreSQL stores metadata, rights evidence, permitted text, assessment history, and decisions. Third-party video/audio remains at the source and is referenced by canonical or embed URL. Object storage is reserved for KidQ-owned assets and third-party material with explicit storage rights.

### Upsert and refresh

- Uniqueness key: `(source_system_id, external_id)`
- Change detector: normalized metadata hash
- Preserve assessment and publication history; never overwrite prior decisions
- Reassess only when source content, transcript, rubric, prompt, or model version changes
- Periodically verify availability, embeddability, license, and source URL
- Unpublish approved items that become unavailable or lose required rights pending review

## Supabase and Render

Recommended environments:

```text
Local development
├── KidQ web and API
└── Local PostgreSQL

Shared testing / early production
├── Render: API and scheduled ingestion workers
└── Supabase: managed PostgreSQL
```

Use Supabase for the persistent PostgreSQL database and Render for the API and scheduled ingestion workers. Configure secrets in each platform's environment settings; never commit them.

Apply the schema:

```bash
psql "$DATABASE_URL" -f api/db/migrations/001_content_catalog.sql
```

## Configuration

```env
PORT=4000
DATABASE_URL=postgresql://...

YOUTUBE_DATA_API_KEY=
OPENVERSE_CLIENT_ID=
OPENVERSE_CLIENT_SECRET=

OPENAI_API_KEY=
OPENAI_MODERATION_MODEL=omni-moderation-latest
OPENAI_CLASSIFICATION_MODEL=gpt-5-nano
OPENAI_ESCALATION_MODEL=

KIDQ_RUBRIC_VERSION=1
KIDQ_PROMPT_VERSION=1
KIDQ_MAX_TRANSCRIPT_CHARS=24000
```

Use server-side environment variables locally and deployment secret managers in hosted environments.

### Secret ownership

| Secret | Used by | Storage location |
|---|---|---|
| `DATABASE_URL` | API and ingestion workers | Local `.env`, Supabase/Render secret settings |
| `YOUTUBE_DATA_API_KEY` | YouTube connector worker | Server-side secret settings |
| `OPENVERSE_CLIENT_ID` / `OPENVERSE_CLIENT_SECRET` | Openverse connector worker | Server-side secret settings |
| `OPENAI_API_KEY` | Moderation and classifier worker | Server-side secret settings |

Commit only empty examples. Rotate any credential that appears in source control or logs.

## Current API

The backend implements the ingestion API below, plus the admin, recommendation and parent endpoints described in [`docs/api/README.md`](../api/README.md). The live contract is `GET /openapi.json`.

The `GET/POST /content/discover` prototype and its JSONL store have been retired. So has the generic open-web fetcher: it will return only with a per-domain allowlist configuration, as the connector rules require.

Content is persisted in PostgreSQL through the migrations in `api/db/migrations/`. This has been verified against local PostgreSQL 16. Do not describe it as running on Supabase or Render until the QA deployment has been verified.

### Desired ingestion API

The PostgreSQL-backed version should expose asynchronous jobs:

```text
POST /ingestion-runs
GET  /ingestion-runs/:id
GET  /content-items
GET  /content-items/:id
GET  /review-queue
POST /content-items/:id/assessments
POST /content-items/:id/publication-decisions
```

Creating an ingestion run should return `202 Accepted` with the run ID. Fetching its status should return counts, pagination progress, retry state, and redacted errors. Do not keep a browser request open while an entire source collection is processed.

## Claude implementation contract

When Claude or another coding agent changes content ingestion, it must:

1. Read this README, `CONTEXT.md`, `config/content-sources.json`, and the active database migrations.
2. Identify the source connector, rights boundary, and data fields affected before editing code.
3. Preserve all required output keys and explicit `null` / `[]` behavior.
4. Keep external metadata, KidQ assessments, and publication decisions in their respective models.
5. Add or update tests for normalization, idempotency, pagination, retry handling, rights gates, transcript states, and manual-review fallback.
6. Use source fixtures in tests; tests must not spend API quota or call paid models.
7. Redact all credentials and signed URLs from fixtures, logs, errors, and snapshots.
8. Record connector, prompt, rubric, and model versions when behavior changes.
9. Run type checking, tests, build, migration validation, and secret scanning.
10. Report current limitations honestly; designed or documented integrations are not “working” until exercised against the real service and database.

### Required connector tests

Every connector must prove:

- an empty result succeeds with zero counts
- pagination collects all requested pages within configured limits
- duplicate source records are updated rather than inserted twice
- unchanged hashes skip paid reassessment
- `429` and transient `5xx` responses retry within bounds
- permanent `4xx` responses fail without retry storms
- one malformed item produces a partial run rather than total data loss
- missing rights disable transcript/media storage
- missing transcript produces the correct status without invented text
- absent audiovisual evidence keeps relevant rubric criteria `UNKNOWN`
- no automated path creates an `APPROVED` publication decision
- logs and persisted errors contain no secrets

### Definition of done

A content-source integration is complete only when:

- official access and rights are documented with evidence
- normalized records include every required field
- repeated ingestion is idempotent
- pagination, rate limiting, retries, and partial failure are tested
- source records and content items are persisted in PostgreSQL
- transcript handling follows the rights and state models
- every rubric criterion has an evidence-bearing result
- paid analysis is cached and token usage is recorded
- all candidates enter the human review workflow
- unavailable or relicensed content can be withdrawn
- deployed behavior has been verified in the target environment

## Connector implementation sequence

For each connector:

1. Confirm official API, authentication, terms, rate limits, and item-level rights fields.
2. Add the connector configuration to `config/content-sources.json`.
3. Create an ingestion run before calling the source.
4. Fetch and normalize complete metadata.
5. Upsert the source record and canonical content item.
6. Record rights evidence.
7. Attempt permitted transcript retrieval asynchronously.
8. Run deterministic checks, moderation, and structured classification.
9. Write versioned assessments and criterion evidence.
10. Place candidates in manual review.
11. Publish only after an authorized human decision.
12. Verify idempotency, partial failure, rate-limit handling, secret redaction, and database rollback behavior.

An integration is complete only when repeated runs do not duplicate content, failures are traceable, rights are explicit, all required fields are emitted, and no unreviewed item can appear to children.

## Implementation roadmap

1. Connect the API storage layer to PostgreSQL using `DATABASE_URL`.
2. Implement ingestion-run and idempotent-upsert repositories.
3. Complete the YouTube connector and persistence path.
4. Add rights-aware transcript jobs.
5. Add NASA and Wikimedia connectors.
6. Add Openverse and Internet Archive with item-level license gates.
7. Complete StoryWeaver access and license review, then implement the permitted connector scope.
8. Add low-cost model assessment and token accounting.
9. Build the curator review interface.
10. Deploy the API and scheduled workers to Render with Supabase PostgreSQL.
