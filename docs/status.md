# Status — 2026-09-13

When something below changes, update it; delete any line that is no longer true.

## Built — [PR #1](https://github.com/shaliniy1/KidQ/pull/1)

- **API**
  - ingestion from YouTube, NASA, Wikimedia and StoryWeaver (picture books). A pull-time pre-screen drops unsuitable, off-topic, too-short and too-long discovered items before they're stored.
  - rule pre-checks and the Gemini scoring agent. Prompt v2: observations first, score bands, and category definitions; what the AI observed bounds its own scores.
  - KidQ content score (`KIDQ_SCORE_V2`): evidence caps, and a confidence that reflects how sure the AI was. Learning value is measured apart from the score. Books are scored on three components (no audio).
  - publish policy:
    - KidQ checks reject confirmed problems and scores under 60, as SYSTEM decisions an admin can reverse;
    - a score of 60–69, or confidence under 60%, needs an admin;
    - 70+ is ready to approve, and automation never publishes.
  - AI backlog scoring: the dashboard's "Score N items with AI" (`POST /content-items/bulk-reanalyze`). Scoring pauses when Gemini's daily quota runs out and resumes after midnight Pacific, so no item fails for quota.
  - parent onboarding (P2 revision): `POST /onboarding`, `GET`/`PATCH /me`, and child profiles with an age band, age-based defaults and the Customize blocks
  - one vocabulary for onboarding and admin tagging: 5 age bands and the 12 onboarding categories, each with a definition. An item fits up to three categories, and picture books always have Storybooks first.
  - recommendations (`RANK_V3`; expert reviews removed 2026-09-13):
    - ranking inputs: relevance, KidQ score, learning value, and fit (age and session length);
    - category variety, which also makes the default feed for a child whose parent gave only an age;
    - plus the parent library and parent URL submissions.
  - parent spec v5 (API): the seven parent categories over the admin ones (Animation dropped), break interval, time-of-day session mode with AI session-mode tags (prompt v3, tagged once), "today, lean toward…", the KidQ check badge on cards, and the Add-a-Video preview.
  - parent analytics (API): viewing events, deduplicated and with screen time capped by the server; a per-play rollup; `GET /children/:id/analytics` for every section of the page.
  - sessions (spec §2–5): Start a Session builds ~15-minute slots of whole videos from the child's library only, with breaks and a calm last slot; each video's outcome and the handoff log are recorded.
  - calibration report (`npm run eval:scoring -w api`) and the re-curation script (`npm run recurate -w api`)
  - OpenAPI contract at `/openapi.json` and `/docs`
- **Admin Content Studio** (`admin/`; Shalini is rebuilding its screens) and the shared **KidQ Player** and **story reader** (`packages/kidq-player`), both with Visual Comfort Mode.
- **Deploy**:
  - `render.yaml` (QA on free tiers)
  - CI for api, web and admin
  - daily job-drain workflow (`.github/workflows/drain-jobs.yml`, 08:15 UTC)

## Verified

- All API tests pass: unit, plus integration tests on Postgres using fixtures.
- **Re-curation of the local library** (2026-09-13):
  - 38 items taken down by the pre-screen: agency news and briefings, 4 streams over 15 minutes, 15 clips under 15 seconds, the "The Birds" trailer, an animal-rights exposé, and two swimming clips;
  - 42 items re-categorised, e.g. the NASA "blood samples" clip moved from Painting to Science;
  - 88 items queued for AI prompt v2;
  - the 5 fake-ID demo videos deleted.
- **Prompt v2 on Gemini** (Flash-Lite, 2026-09-13): the response schema is accepted, the answer arrives in the requested order, and it validates. Sampling a short uploaded video at 3 fps is accepted and cheap (a 15-second clip: about 3,350 input tokens).
- Live pulls into local Postgres: 49 NASA and 30 Wikimedia videos, and 45 openly licensed StoryWeaver books.
- Through the admin UI: an item was published; a Wikimedia video played in the KidQ Player with its license credit; a StoryWeaver book reads page by page with illustrations and credits.
- **Not yet run against real services**:
  - YouTube import, which needs the YouTube key;
  - prompt v2 scores on the Flash models, which starts when their quota resets (12:35 IST on 2026-09-13).

## Before the QA deploy

Owner: Shalini. Step-by-step instructions are in `docs/deployment.md`.

1. Create the Supabase QA project, and give admin users `app_metadata.role = "admin"`.
2. Create the Render Blueprint from `render.yaml` and enter its secrets. Render deploys from `main`, so merge PR #1 first.
3. Get a YouTube Data API key. Add the GitHub secrets the drain workflow needs: `QA_DATABASE_URL`, `YOUTUBE_DATA_API_KEY`, `GEMINI_API_KEY`.
4. Seed QA: `npm run seed:discover -w api -- --drain`, with `DATABASE_URL` pointing at QA.
5. Once after deploying: `npm run recurate -w api -- --apply` against QA.

## Known issues and follow-ups

- **Calibrate prompt v2**: label about 30 items in the admin (adjust scores, set categories), then run `npm run eval:scoring -w api`. Until it meets its targets, look over "Ready to approve" items before publishing them in bulk.
- **Bright, fast YouTube content** is the main risk the new checks target, and it's untested until the YouTube key is set: the local library has no real YouTube items.
- **YouTube sampling**: uploaded videos up to 5 minutes are sampled at 3 fps. YouTube stays at 1 fps, which can miss cuts and flashes shorter than a second, until 3 fps is verified on a YouTube URL.
- **Scores from prompt v1** stay until the AI re-reviews each item, at about 60 items a day.
- **Gemini free tier**: `gemini-3.8-flash` allows only 20 requests a day per project (measured from Gemini's own error). Each model has its own quota.
  - Decision (2026-09-12): stay free and rotate 3.8 → 3.7 → 3.6 Flash, about 60 items a day. Billing (about 2¢ an item) would score everything at once.
- **Model comparison on KidQ items** (same items, nothing saved):
  - 3.6 and 3.7 Flash score like 3.8 Flash, within about 5 points.
  - 3.5 Flash-Lite marked every safety problem as present on a flamingo clip, which would block harmless videos.
  - 3.1 Flash-Lite is cheapest and catches clearly unsuitable videos, but it rates simple clips 90+ and leaves most rubric checks unknown.
  - Flash and Flash-Lite differ by about 25 points on calm clips, so score the whole catalogue with one model family.
- **Pulls aren't scheduled**: the daily workflow processes queued work (mostly AI scoring). New content is pulled only when someone starts a pull. The admin isn't told what a pull brought in yet.
- **Onboarding defaults to review**: development goals and session length per age band are product defaults, not clinical claims. They need an expert pass (`docs/recommendation/parent-onboarding.md`).
- **StoryWeaver before prod**: confirm API use with StoryWeaver, review its Terms of Use, and re-check stored books' licenses periodically. Details: `docs/content-curation/storyweaver.md`.
- **Some NASA videos can't be AI-reviewed**: those crediting people outside NASA have unknown rights. Admins rate or reject them.
- **Express 5 upgrade**: clears the `qs` advisory, which the simple query parser already mitigates. A separate session is working on this.
- **Wikimedia playback**: videos stream as WebM (VP9), which older iPhones may not play. Prefer MP4 derivatives when Commons offers them.
- **Free tiers**:
  - Render: about a 1-minute cold start after 15 minutes idle.
  - Supabase: the project pauses after a week idle.

## Next slices (after QA)

1. Parent-app onboarding screens on the new API (teammate), then child player APIs, TV pairing and PWA install.
2. The session queue with break slots, and the Orange Break Agent with its activity library (architecture doc §14–20).
3. Admin API for the new admin UI: pull notifications ("N new items from each source"), a "pulled on" filter, and dashboard counts by state and source.
4. Scoring: the calibration labels, 3 fps for YouTube, and learning from parent behaviour.
5. Openverse and Internet Archive connectors.
6. Prod: paid Render instances with a separate worker, pre-deploy migrations, Supabase Pro.
