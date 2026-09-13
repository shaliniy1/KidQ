# KidQ API — integration guide for UI teams

Both the admin app and the parent/child app integrate against one API. The contract is generated from the code, so it can't drift.

- **Contract**: `GET /openapi.json` (committed as [`api/openapi.json`](../../api/openapi.json)); interactive docs at `GET /docs`.
- **Typed client**: `npx openapi-typescript <api-url>/openapi.json -o src/lib/api-types.ts`, then use `openapi-fetch`.
- **Base URLs**: local `http://localhost:4000`; QA is the `kidq-api` Render service URL.
- CI fails if a PR changes the API without updating `api/openapi.json` (`npm run openapi:write -w api`).

## Auth

- Sign in with Supabase (`@supabase/supabase-js`). Send `Authorization: Bearer <session.access_token>` on every call.
- **Roles** come from Supabase `app_metadata.role`:
  - `admin` — set in the Supabase dashboard for staff
  - everyone else is a `parent`
- **Local development without Supabase**: run the API with `AUTH_MODE=dev` and send `Bearer dev:<admin|parent>:<any-uuid>[:<email>]`, e.g. `Bearer dev:parent:22222222-2222-4222-8222-222222222222`. This is refused in production.
- Parents only ever see their own children. Another family's child returns 404.

## Errors

Every error has the same shape: `{ "error": { "code": "NOT_READY", "message": "…", "details": { "blockers": ["MISSING_AGE"] } } }`.

| Status | Meaning |
|---|---|
| 400 | Validation or unknown taxonomy key |
| 401 | Not signed in |
| 403 | Wrong role |
| 404 | Missing, or not yours |
| 422 | Business rule, e.g. publish checks |
| 429 | Rate or submission limit |

## The content card

Every list returns the same `ContentCard`. Render it; don't recompute anything in it.

- `content_score` — how calm and safe KidQ found the item: `score` (0–100 or null), `confidence`, the `breakdown` (label, score, weight, AI/ADMIN source, evidence, mm:ss timestamps, `capped_by`), `reason`, `missing`, `safety_flags`, `evaluated_by`, `reviewed_at`.
  - The breakdown has four parts for videos and three for picture books (no audio). Render whatever parts arrive, with their labels.
  - `capped_by` names the failed check that capped a part, e.g. `rapid_visual_cuts`.
  - **Parents** see the score, the bars, the reason and "reviewed by KidQ".
  - **Admins** also see the evidence and timestamps.
- `learning` — what the child can learn or do, apart from the score: `value` (0–100 or null) and `areas` ("Thinking", "Language", "Feelings & friends", "Doing").
- `category` is the primary category; `categories` lists every category the item fits (at most three), primary first.
- `player` — how to play the item:
  - `{ provider: "youtube", video_id, embed_url, params }` or `{ provider: "html5", media_url, mime_type }`
  - `{ provider: "story", page_count }` — a picture book: load its pages with `GET /content-items/:id/story` and show them in `KidQStoryReader`
  - `null` means **not playable**, e.g. a parent submission still awaiting review
- `attribution` — show `text` on screen whenever `required` is true (CC BY and similar).
- `thumbnails` — every size, so TVs load large images and phones small ones.
- `age.groups` — derived groups, one or more of `0_2`, `2_3`, `3_4`, `4_5`, `5_6`.

## Content statuses

Admin screens show `studio_state`, one of five. Show one tile or filter per state, so a tile's count always matches its list.

| `studio_state` | Label | What the admin does |
|---|---|---|
| `PENDING_ANALYSIS` | Draft | Nothing yet: rule checks and the AI review are queued or running |
| `READY_TO_APPROVE` | Ready to publish | Publish (single or bulk) |
| `NEEDS_ATTENTION` | Needs changes | Fix what `publish_blockers` lists, or publish over KidQ's checks with a reason |
| `APPROVED` | Published | Unpublish if needed |
| `REJECTED` | Rejected | Restore if KidQ checks got it wrong |

## Admin app flows

| Screen | Calls |
|---|---|
| Dashboard | `GET /dashboard` |
| Content Library | `GET /content-items?state=&age_group=&category=&source=&flagged=&min_score=&q=&sort=&limit=&offset=` (`category` matches any of an item's categories) |
| Content pool | `GET /content-pool`: published items that can reach parents, per age band and category (fewer than 3 is flagged thin), and published items that can't be recommended, with the reason |
| Review queue | `GET /review-queue` (parent requests first) |
| Add content | `POST /ingestion-runs` (`mode: "urls"` or `"search"`) → poll `GET /ingestion-runs/:id` |
| Content detail | `GET /content-items/:id`: card, README canonical `record`, assessments with criteria, decisions, edits, and `story` (pages and credits) for picture books |
| Edit text | `PATCH /content-items/:id` |
| Sliders / rubric | `POST /content-items/:id/assessments` (HUMAN — outranks the AI) |
| Tags | `PATCH /content-items/:id/classification`, `POST /content-items/bulk-classification` |
| Publish | `POST /content-items/:id/publication-decisions` (`APPROVED`, `REJECTED`, or `MANUAL_REVIEW_REQUIRED` to unpublish); `POST /publication-decisions/bulk`. Publishing over KidQ's checks needs `override_critical_flag: true` and a reason of 15+ characters; the 422 error code is `CRITICAL_FLAG` or `KIDQ_CHECKS` |
| Re-run AI | `POST /content-items/:id/reanalyze` |
| Score everything the AI hasn't reviewed | `POST /content-items/bulk-reanalyze` with `{ "scope": "UNSCORED" }`; progress in `GET /dashboard` → `ai` |
| Preview for a child | `POST /recommendations/preview` |
| Configuration | `GET/PUT /config/scoring`, `GET/PUT /config/ranking`, `POST /taxonomy` |

## Parent / child app flows

1. **Onboarding** ([fields and defaults](../recommendation/parent-onboarding.md)):
   - `GET /me` → `404 NOT_ONBOARDED` means show onboarding.
   - Screen 1: `POST /onboarding` with `{ parent_name, language, children: [{ nickname, age_band }] }` (1–6 children). `language` is the parent's pick; pre-select the device language when KidQ has it (`GET /taxonomy` → `language`), otherwise `en`.
   - "Customize for {child}": `PATCH /children/:id` with any of `interests`, `content_mix` + `preferred_categories`, `regulation_goals`, `session_minutes`, `break_type`, `languages`. Everything left out keeps its age-based default; development goals are never asked.
   - Every chip's options come from `GET /taxonomy` — the keys admins tag content with. Regulation goals carry the parent wording in `meta.parent_label`.
   - `POST /children` adds a child later.
2. **Recommendations**: `GET /children/:id/recommendations?limit=20&offset=0`. Each item has `why` (plain-language reasons) and `card`.
3. **Add / Not now**: `POST /children/:id/library` with `{ content_item_id, state: "ADDED" | "DISMISSED" }`. Remove with `DELETE /children/:id/library/:contentItemId`.
4. **Child library**: `GET /children/:id/library`. Play only entries where `awaiting_review` is false and `card.player` is non-null. For a picture book (`provider: "story"`), load `GET /content-items/:id/story` — it returns 404 until the book is published.
5. **Parent-added links**: `POST /children/:id/submissions` with `{ url }`, then poll `GET /children/:id/submissions`. `assessment` moves PENDING → SCORED → APPROVED. "Keep" is `POST /children/:id/library`, which makes the entry REQUESTED until an admin approves it.
6. **Start a Session** ([spec §2–5](../recommendation/parent-experience.md)):
   - `POST /children/:id/sessions` with `{ minutes }` (15, 30, 45, 60 or 90; other lengths snap to 30-minute blocks) returns the session, already started. Its `slots` are ~15 minutes of whole videos from the child's library, each with its `break_after` (`MOVEMENT`, `QUIET`, or `WIND_DOWN` for the last). A preset is saved as the child's next default.
   - `short_by_minutes` > 0 means the library couldn't fill the time; tell the parent afterwards and suggest adding videos.
   - After each video: `PATCH /sessions/:id/items/:itemId` with `{ outcome: "COMPLETED" | "SKIPPED" | "EXITED", watched_seconds }`.
   - `POST /sessions/:id/end` with `{ outcome: "COMPLETED" | "EXITED" }`. There's no resume; a new session starts fresh.
   - Handoff log: `GET /children/:id/sessions` (the last 20, newest first).

## KidQ Player rules

Use `packages/kidq-player` (`KidQPlayer` for video, `KidQStoryReader` for picture books); it follows these rules.

- **YouTube**: IFrame Player API on `youtube-nocookie.com` with the returned `params` (`controls=0`, `disablekb=1`, `fs=0`, `iv_load_policy=3`, `rel=0`, `playsinline=1`, no autoplay).
  - Draw KidQ's own play, pause and volume controls.
  - Cover the frame with a transparent overlay so the YouTube title and logo can't be clicked.
  - Show a KidQ card on pause and at the end, over YouTube's suggestions.
- **HTML5** (NASA, Wikimedia): a plain `<video>` with the same KidQ controls. Show the attribution line.
- **Picture books**: one page at a time with big page buttons (arrow keys and TV Back turn pages), illustrations loaded from the source, and the book's full credits after the last page — their license requires it.
- **Visual Comfort Mode**: pass `comfort="warm"` or `"warmer"` to `KidQPlayer` or `KidQStoryReader` for a warm, softer picture, for example in the evening. It works on every source, YouTube included, because it's an amber layer drawn over the picture on the device. Call it "Visual Comfort Mode"; don't make blue-light health claims (architecture doc §21).
- **Never show** YouTube descriptions or links to children. Show the KidQ title and `kidq_summary` instead.
- **Playback errors**: on YouTube error 100 / 101 / 150 / 153, call `POST /content-items/:id/playback-errors` with `{ code }`. The API re-checks with YouTube before hiding anything.
- **Known limits**: YouTube can't be fully white-labelled. Ads chosen by the video owner may still play, and "Made for Kids" videos get non-personalised ads only.

## PWA and smart TV

- **One web app** for phone, tablet, laptop and TV. On TVs, ship a thin **hosted** wrapper per platform (Android/Google TV, Samsung Tizen, LG webOS, Fire TV) that loads the live HTTPS URL. YouTube embeds need a real web origin, so packaged `file://` apps can fail to play.
- **Remote control**: every control must be focusable and work with arrow keys, Enter and Back (Tizen `10009`, webOS `461`). Use big focus rings and no hover-only UI.
- **Caching**: `GET /taxonomy` sends `public, max-age=300`; library and recommendations send `private` with ETags; admin responses are `no-store`. Cache the app shell and lists in the service worker, never videos.
- **Add the wrapper's origin** to the API's `CORS_ORIGINS`.
- **TV sign-in** via a pairing code (TV shows a code, parent approves on their phone) comes after QA.

## Run it locally

```bash
npm install
cp api/.env.example api/.env          # AUTH_MODE=dev, local Postgres
createdb kidq && npm run db:migrate -w api
npm run dev                            # web :3000, admin :3001, api :4000 (worker in-process)
npm run seed:discover -w api -- --drain   # YouTube needs YOUTUBE_DATA_API_KEY; GEMINI_API_KEY adds AI scores
```
