# StoryWeaver — picture books for KidQ

StoryWeaver (Pratham Books) is KidQ's source of openly licensed picture books for ages 0–6. This page records how KidQ ingests them, the license review the [content curation README](./README.md#storyweaver-connector) requires, and the original proposal.

## Status — 2026-09-12

- **Enabled for QA**: books whose attribution page releases the story and every illustration under CC BY, CC BY-SA or CC0.
- **Before prod**: close the open items below — StoryWeaver's confirmation that KidQ may use its API, and a review of its Terms of Use.
- **Excluded**: ReadAlong audio and StoryWeaver videos (often CC BY-NC-ND), downloadable PDFs and ePubs, and any book with an NC or ND license.

## How KidQ ingests a book

1. **Discovery**: `GET https://storyweaver.org.in/api/v1/books-search?query=…&languages[]=English&levels[]=1&levels[]=2`. Reading levels 1–2 ("easy words, word repetition" and "simple words") suit reading aloud to ages 2–6.
2. **Pages**: `GET /api/v1/stories/{slug}/read` returns every page as HTML. KidQ keeps each story page's visible text and two illustration renditions, plus the book's attribution page as `credits`.
3. **Rights gate**: every "Released under … license" statement on the attribution page — the story's and each illustration's — must be CC BY, CC BY-SA or CC0. Otherwise the book is dropped before storage (`REJECTED_LICENSE_NOT_OPEN`). The rights assertion records the license, its URL, the credit line and the attribution text as evidence.
4. **Storage**: `source_records.story` holds `{ pages: [{ page, text, image_url, image_small_url }], credits }`, and `raw_metadata` the API responses. Illustrations are never copied: the reader loads them from StoryWeaver's storage.
5. **Scoring**: the Gemini scoring agent reads every page and sees each illustration (the small rendition, sent inline and not kept). A book has no soundtrack, so it's scored on three components — Content & language, **Reading pace** and **Illustrations** — with the usual weights renormalised ([recommendation README](../recommendation/README.md)).
6. **Admin gate**: a book reaches families only after an admin publishes it. Admins read it in the KidQ story reader on the detail page.
7. **Reading**: the card's `player` is `{ provider: "story", page_count }`. Apps fetch the pages from `GET /content-items/:id/story` (parents: published books only) and render them with `KidQStoryReader` from `packages/kidq-player`, which shows the full credits after the last page.

- **Duration**: `duration_seconds` is the read-aloud time, estimated at 100 words a minute plus 5 seconds per page.
- **Popularity**: reads and likes in the API response stay in the raw record and are never used for ranking.

### The proposal's scoring parameters in KidQ

| Proposal parameter | Where KidQ measures it |
|---|---|
| Age suitability | Age tags (AI suggests, admin confirms); `age_band_fit`, `developmental_mismatch` |
| Language complexity, attention demand | **Reading pace** component; `vocabulary_in_context`, `predictable_structure` |
| Educational value, learning objective | `clear_learning_objective`, `problem_solving_narrative`; the item's learning objective |
| Emotional tone, positive behaviour | Content & language component; `empathy_and_kindness`, `emotional_literacy`, `constructive_conflict_resolution` |
| Violence / scary content | Safety criteria `physical_violence`, `frightening_imagery` — a FAIL withholds the score |
| Commercial content | `direct_advertising`, `product_placement`, `franchise_led_promotion` |
| Visual stimulation | **Illustrations** component; `simple_uncluttered_visuals`, `cluttered_visuals` |
| Creativity, parent involvement, activity potential | `imaginative_play_extension`, `open_ended_questions`, `participation_prompts`, `craft_or_diy_extension`, `nature_exploration_extension` |

## License review

Answers to the README's StoryWeaver checklist, as of 2026-09-12.

| Question | Answer | Evidence |
|---|---|---|
| Official API, export, feed or partner integration? | A public web API that powers StoryWeaver's own reader and is used by open-source importers. It isn't formally documented. | `api/v1/books-search`, `api/v1/stories/{slug}/read`; [Learning Equality importer](https://github.com/learningequality/sushi-chef-pratham-books-storyweaver) |
| Automated retrieval allowed by terms and robots.txt? | robots.txt doesn't disallow `/api/`. The Terms of Use aren't reviewed yet: the site refuses automated fetches of that page. | robots.txt, fetched 2026-09-12 — **open item** |
| Which metadata may be stored indefinitely? | Title, authors, illustrators, publisher, language, level, description, cover URLs, source URL. | Factual metadata of openly licensed works |
| License of each story, translation, narration and illustration | Stated per book on its attribution page: one statement for the story and one per illustration. Narration (ReadAlong) is out of scope. | "Released under CC BY 4.0 license" on the book's back inner cover |
| Commercial use | Allowed by CC BY, CC BY-SA and CC0. Books with NC licenses are rejected. | License terms |
| Adaptation, translation, excerpting, text storage | Allowed with attribution and an indication of changes. KidQ stores the text unmodified; the AI summary is KidQ's own description. | CC BY 4.0 |
| Required attribution | Title, author, illustrator, translator, publisher, StoryWeaver, and the license with a link. Every card carries a credit line, and the reader shows the full attribution page after the last page. | The book's attribution page |
| Embed or deep-link? | KidQ shows the book in its own reader (proposal option B) and keeps the source URL. | — |
| Downloadable files cached? | No. KidQ downloads no PDFs or ePubs, and illustrations stay at StoryWeaver. | — |
| Territorial, language, age or account restrictions | None found in the API responses. | — |
| Withdrawn or relicensed stories | A re-run updates the record and re-scores it; a book that is no longer openly licensed isn't re-imported. A periodic re-check of stored books isn't built yet. | **open item** |
| Rate limits and contact | None published. KidQ sends one request per book, in sequence, with a descriptive User-Agent. | **open item** |

## Open items before prod

1. Ask StoryWeaver (Pratham Books) to confirm KidQ may retrieve books through its API, and agree on rate limits.
2. Review StoryWeaver's Terms of Use.
3. Re-check stored books' licenses periodically, and unpublish any that change.

---

## Original proposal

The proposal this integration is based on, as written.

### Goal

Use StoryWeaver as a source of children's stories for KidQ, especially for the 0–6 age group, while preserving licensing and attribution requirements.

### Recommended flow

```text
StoryWeaver
     ↓
Story Search / Discovery
     ↓
Fetch story metadata
     ↓
Download story/PDF
     ↓
Extract
  ├── Title
  ├── Story text
  ├── Images
  ├── Language
  ├── Reading level
  ├── Categories
  ├── Author
  ├── Illustrator
  ├── Publisher
  └── License / attribution
     ↓
KidQ Content Database
     ↓
KidQ Content Scoring Engine
     ↓
Age suitability + stimulation + educational value
     ↓
Admin Review
     ↓
KidQ Story Library
```

### 1. Story discovery

StoryWeaver has endpoints that have been used by open-source importers, including:

```text
https://storyweaver.org.in/api/v1/books/filters
https://storyweaver.org.in/api/v1/books-search
```

Possible parameters include `page`, `per_page` and `categories[]`. Potential filters for KidQ: language, reading level, category, publisher, age suitability.

> These endpoints do not appear to have stable public API documentation, so KidQ should not permanently depend on them without confirming with StoryWeaver.

### 2. Metadata to store in KidQ

```json
{
  "source": "storyweaver",
  "source_story_id": "...",
  "title": "Example Story",
  "language": "English",
  "reading_level": 2,
  "category": ["Science"],
  "author": "...",
  "illustrator": "...",
  "translator": null,
  "publisher": "Pratham Books",
  "donor": "...",
  "source_url": "...",
  "license": "CC BY 4.0",
  "pdf_url": "...",
  "content_type": "story",
  "kidq_age_band": "4-6",
  "kidq_score": null,
  "review_status": "pending"
}
```

### 3. KidQ content scoring

Every imported story can go through the KidQ scoring engine. Suggested parameters: age suitability, language complexity, educational value, emotional tone, violence / scary content, commercial content, attention demand, visual stimulation, positive behaviour, creativity, learning objective, parent involvement potential, activity potential.

### 4. Processing the story

Downloaded stories can be processed page by page (text and illustration per page), which allows KidQ to build its own distraction-free reader: no external recommendations, no autoplay, a reading timer, parent controls, age filtering, activity breaks, read-aloud, progress tracking and content scoring.

### 5. Attribution requirements

StoryWeaver stories and illustrations are generally available under **CC BY 4.0**. KidQ should preserve the story title, author, illustrator, translator (if applicable), publisher, donor / funder (if required), StoryWeaver attribution and the CC BY 4.0 license. Example display:

```text
Source: StoryWeaver by Pratham Books
Written by: <Author>
Illustrated by: <Illustrator>
Licensed under CC BY 4.0
```

A separate **Credits** section can contain the complete attribution.

### 6. Videos / read-along content

Treat StoryWeaver videos separately: stories and illustrations are CC BY 4.0, while ReadAlong and some video content is CC BY-NC-ND 4.0. For the MVP, prioritise story text, story illustrations, PDFs and metadata; review ReadAlong videos and StoryWeaver YouTube videos separately because their license can be more restrictive.

### 7. Embed vs import

- **Option A — embed the StoryWeaver reader**: simple, less processing, but less control over the child experience, and harder to integrate KidQ scoring, reading progress, activities and parental controls.
- **Option B — import and build a KidQ reader** (recommended): full control over the UX, no external recommendations, content scoring, parent controls, activity insertion, progress tracking and read-aloud support.

### 8. Recommended MVP architecture

```text
             STORYWEAVER
                  │
        Search / Metadata API
                  │
                  ▼
        KidQ Content Importer
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
     Metadata    PDF      Images
        │         │         │
        └─────────┼─────────┘
                  ▼
          Content Processor
                  │
                  ▼
        KidQ Scoring Engine
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
    Reject              Candidate
                              │
                              ▼
                        Admin Review
                              │
                              ▼
                         KidQ Library
```

### 9. MVP recommendation

1. Fetch only potentially relevant stories for children aged 0–6.
2. Store StoryWeaver metadata and attribution.
3. Download/process text and illustrations.
4. Run each story through the KidQ content scoring engine.
5. Reject unsuitable content automatically.
6. Send good candidates to the Content/Activity Admin.
7. Admin reviews and publishes approved stories.
8. Show approved stories inside the KidQ distraction-free reader.

### References

- StoryWeaver Open Content: https://storyweaver.org.in/en/open-content
- StoryWeaver Open Platform: https://open.storyweaver.org.in/
- StoryWeaver Attribution Guidance: https://storyweaver.org.in/en/attributions
- Example open-source importer: https://github.com/learningequality/sushi-chef-pratham-books-storyweaver
