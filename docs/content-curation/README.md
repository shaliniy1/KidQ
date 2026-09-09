# KidQ Content Curation System

This document is the source of truth for discovering, ingesting, evaluating, storing, reviewing, and publishing KidQ content for children from birth to six years old. Use it when implementing source connectors, transcript retrieval, database integration, automated assessment, or curator tooling.

## Mission

KidQ is a small, trusted library of low-stimulation, age-appropriate, educational, creative, interactive, and developmentally meaningful content. Library quality and child safety take priority over catalogue size, popularity, views, likes, subscribers, or trending status.

KidQ does not reproduce YouTube, copy third-party media libraries, or automatically approve content based on metadata, creator reputation, or a platform's “Made for Kids” designation.

## Audience and taxonomy

Every item must target children aged 0–6 and use one or more of these age bands:

- 0–2 years
- 2–4 years
- 4–6 years

Every item must have exactly one primary content type:

- `VIDEO`: externally hosted video content
- `ACTIVITY`: a physical, creative, observational, verbal, or mental activity
- `STORYBOOK`: a narrated, illustrated, read-aloud, or digital story
- `INTERACTIVE_CONTENT`: a simple age-appropriate game, puzzle, matching exercise, or learning interaction

Supported categories include:

- Animated Videos
- Storybooks / Read-Alouds
- Creative Crafts
- Drawing & Painting
- Science
- Maths
- Baby Learning
- General Knowledge
- Games / Play-Along
- Yoga & Movement
- Animals / Nature / Guppy Videos
- Trusted Educators
- Activities

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
| StoryWeaver | Confirmed official method to be determined | Metadata and source URL initially | No copied story text or media until rights are confirmed | `PENDING_LICENSE_REVIEW` |
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

## StoryWeaver connector

StoryWeaver is a required KidQ source, but its connector remains `PENDING_LICENSE_REVIEW` until the current official access method, rate limits, license fields, attribution obligations, and text/media reuse rights are confirmed.

Until that review is complete, KidQ may store only:

- external story ID when available
- title
- author and illustrator
- language
- reading level
- source URL
- displayed license and attribution metadata
- fetch timestamp and provenance

KidQ must not copy story text, illustrations, downloadable files, or generated transcripts merely because a story is publicly readable. Enable richer ingestion only after recording a rights assertion that permits each storage or reuse operation.

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

## Curation rubric

Every criterion returns `PASS`, `FAIL`, or `UNKNOWN` with one short evidence statement. Missing evidence produces `UNKNOWN`, not a guessed pass.

### Filter out

Reject or flag:

- rapid cuts, flashing, excessive brightness, loud or jarring sound, constant noise, or cluttered visuals
- violence, aggression, frightening imagery, mature themes, discrimination, or harmful stereotypes
- advertisements, sponsorships, product placement, unboxing, toy reviews, or franchise-led promotion
- endless loops, sensational titles, or clickbait thumbnails
- repetitive passive viewing without a clear developmental objective
- content substantially above or below the target developmental stage

### Filter in

Prioritize:

- clear learning objectives and vocabulary development
- problem-solving narratives and motor-skill prompts
- calm pacing, gentle audio, simple visuals, and predictable structure
- empathy, kindness, emotional literacy, inclusion, and constructive conflict resolution
- participation prompts, imitation, questions, and parent co-viewing opportunities
- crafts, drawing, movement, nature exploration, and other offline extensions
- explicit developmental fit for at least one KidQ age band

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

## Current API

The current backend exposes:

```text
GET  /health
GET  /content/discover
POST /content/discover
```

YouTube discovery example:

```bash
curl -X POST http://localhost:4000/content/discover \
  -H 'content-type: application/json' \
  -d '{
    "source": "youtube",
    "query": "calm counting for toddlers",
    "max_results": 5,
    "language": "en",
    "region_code": "IN"
  }'
```

Allowlisted open-page example:

```bash
curl -X POST http://localhost:4000/content/discover \
  -H 'content-type: application/json' \
  -d '{
    "source": "open_web",
    "query": "story",
    "open_urls": ["https://example.org/story"]
  }'
```

The current implementation writes JSONL as a prototype. The PostgreSQL migration exists, but the API storage adapter has not yet been connected to PostgreSQL. Do not describe content as persisted in Supabase or Render until that integration is implemented and verified.

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
