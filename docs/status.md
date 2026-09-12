# Status — 2026-09-12

When something below changes, update it; delete any line that is no longer true.

## Built — [PR #1](https://github.com/shaliniy1/KidQ/pull/1)

- **API**
  - ingestion from YouTube, NASA and Wikimedia, with rule pre-checks and the Gemini scoring agent
  - KidQ content score (`KIDQ_SCORE_V1`) and the admin gate
  - recommendations (`RANK_V1`), the parent library, and parent URL submissions
  - OpenAPI contract at `/openapi.json` and `/docs`
- **Admin Content Studio** (`admin/`) and the shared **KidQ Player** (`packages/kidq-player`).
- **Deploy**:
  - `render.yaml` (QA on free tiers)
  - CI for api, web and admin
  - daily job-drain workflow (`.github/workflows/drain-jobs.yml`)

## Verified

- 35 API tests pass: unit, plus integration tests on Postgres using fixtures.
- A live pull from NASA (49) and Wikimedia Commons (30) stored 79 real videos in local Postgres.
- An item was published through the admin UI, and a Wikimedia video played in the KidQ Player with its license credit.
- **Not yet run against real services**: YouTube import and Gemini scoring. Both need API keys.

## Before the QA deploy

Owner: Shalini. Step-by-step instructions are in `docs/deployment.md`.

1. Create the Supabase QA project, and give admin users `app_metadata.role = "admin"`.
2. Create the Render Blueprint from `render.yaml` and enter its secrets.
3. Get a YouTube Data API key and a Gemini API key. Add the GitHub secrets the drain workflow needs: `QA_DATABASE_URL`, `YOUTUBE_DATA_API_KEY`, `GEMINI_API_KEY`.
4. Seed QA: `npm run seed:discover -w api -- --drain`, with `DATABASE_URL` pointing at QA.

## Known issues and follow-ups

- **Express 5 upgrade**: clears the `qs` advisory, which the simple query parser already mitigates. A separate session is working on this.
- **Wikimedia playback**: videos stream as WebM (VP9), which older iPhones may not play. Prefer MP4 derivatives when Commons offers them.
- **NASA and Wikimedia content**: much of it is general footage, so admins will reject a large share.
- **Free tiers**:
  - Render: about a 1-minute cold start after 15 minutes idle.
  - Supabase: the project pauses after a week idle.

## Next slices (after QA)

1. Activities, break rules, session timer, child player APIs, TV pairing, PWA install.
2. AI calibration: compare against ~30 hand-scored videos before relying on bulk approval.
3. Openverse and Internet Archive connectors; StoryWeaver once its license review is done.
4. Prod: paid Render instances with a separate worker, pre-deploy migrations, Supabase Pro.
