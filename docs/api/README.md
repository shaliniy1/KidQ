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

- `content_score` — how KidQ evaluated the item: `score` (0–100 or null), `confidence`, the four-part `breakdown` (label, score, weight, AI/ADMIN source, evidence, mm:ss timestamps), `reason`, `missing`, `safety_flags`, `evaluated_by`, `reviewed_at`.
  - **Parents** see the score, four bars, the reason and "reviewed by KidQ".
  - **Admins** also see the evidence and timestamps.
- `player` — how to play the item:
  - `{ provider: "youtube", video_id, embed_url, params }` or `{ provider: "html5", media_url, mime_type }`
  - `null` means **not playable**, e.g. a parent submission still awaiting review
- `attribution` — show `text` on screen whenever `required` is true (CC BY and similar).
- `thumbnails` — every size, so TVs load large images and phones small ones.
- `age.groups` — derived groups, one or more of `0_2`, `2_4`, `4_6`.

## Admin app flows

| Screen | Calls |
|---|---|
| Dashboard | `GET /dashboard` |
| Content Library | `GET /content-items?state=&age_group=&category=&source=&flagged=&min_score=&q=&sort=&limit=&offset=` |
| Review queue | `GET /review-queue` (parent requests first) |
| Add content | `POST /ingestion-runs` (`mode: "urls"` or `"search"`) → poll `GET /ingestion-runs/:id` |
| Content detail | `GET /content-items/:id`: card, README canonical `record`, assessments with criteria, decisions, edits, expert reviews |
| Edit text | `PATCH /content-items/:id` |
| Sliders / rubric | `POST /content-items/:id/assessments` (HUMAN — outranks the AI) |
| Tags | `PATCH /content-items/:id/classification`, `POST /content-items/bulk-classification` |
| Publish | `POST /content-items/:id/publication-decisions` (`APPROVED`, `REJECTED`, or `MANUAL_REVIEW_REQUIRED` to unpublish); `POST /publication-decisions/bulk` |
| Expert review | `POST /content-items/:id/expert-reviews` (show "per public sources" unless `verified`) |
| Re-run AI | `POST /content-items/:id/reanalyze` |
| Preview for a child | `POST /recommendations/preview` |
| Configuration | `GET/PUT /config/scoring`, `GET/PUT /config/ranking`, `POST /taxonomy` |

## Parent / child app flows

1. **Onboarding**: `GET /taxonomy` for the options, then `POST /children` (age via birth year and month, languages, interests, content types, preferred categories, development and regulation goals, daily minutes).
2. **Recommendations**: `GET /children/:id/recommendations?limit=20&offset=0`. Each item has `why` (plain-language reasons) and `card`.
3. **Add / Not now**: `POST /children/:id/library` with `{ content_item_id, state: "ADDED" | "DISMISSED" }`. Remove with `DELETE /children/:id/library/:contentItemId`.
4. **Child library**: `GET /children/:id/library`. Play only entries where `awaiting_review` is false and `card.player` is non-null.
5. **Parent-added links**: `POST /children/:id/submissions` with `{ url }`, then poll `GET /children/:id/submissions`. `assessment` moves PENDING → SCORED → APPROVED. "Keep" is `POST /children/:id/library`, which makes the entry REQUESTED until an admin approves it.

## KidQ Player rules

Use `packages/kidq-player` when it lands; until then, follow these rules exactly.

- **YouTube**: IFrame Player API on `youtube-nocookie.com` with the returned `params` (`controls=0`, `disablekb=1`, `fs=0`, `iv_load_policy=3`, `rel=0`, `playsinline=1`, no autoplay).
  - Draw KidQ's own play, pause and volume controls.
  - Cover the frame with a transparent overlay so the YouTube title and logo can't be clicked.
  - Show a KidQ card on pause and at the end, over YouTube's suggestions.
- **HTML5** (NASA, Wikimedia): a plain `<video>` with the same KidQ controls. Show the attribution line.
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
npm run seed:discover -w api -- --drain   # needs YOUTUBE_DATA_API_KEY (+ GEMINI_API_KEY for AI scores)
```
