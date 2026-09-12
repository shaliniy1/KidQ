# Deployment — QA (free tiers) and prod

KidQ runs as three Render services from one [`render.yaml`](../render.yaml) Blueprint — `kidq-api`, `kidq-admin`, `kidq-web` — plus a Supabase project for Postgres and Auth. Merging to `main` auto-deploys QA.

## What "free" means for QA

- **Render free**
  - Web services sleep after 15 minutes without traffic and take about a minute to wake.
  - No background workers, cron jobs or pre-deploy step. So the API migrates at boot (`RUN_MIGRATIONS_ON_BOOT`) and runs the job worker in-process (`RUN_WORKER_IN_PROCESS`).
  - Queued jobs wait safely in Postgres while the service sleeps.
- **Supabase free**: 500 MB database (KidQ's ~300 items are a tiny fraction), no backups, and **the project pauses after a week without activity** — unpause it from the dashboard.
- **Gemini free**: at most 8 hours of YouTube video per day. KidQ stops at 7.5 hours and resumes after midnight Pacific. About 90 short videos are scored per day.

## One-time setup (QA)

1. **Supabase** — create project `kidq-qa`, choosing the region closest to Render Singapore.
   - **Connect → Session pooler**: copy the connection string (port 5432) → `DATABASE_URL`. Keep `DATABASE_SSL=require`.
   - **Settings → API**: copy the Project URL → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`, and the anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - **JWT secret**: `SUPABASE_JWT_SECRET` is only needed for legacy HS256 projects; projects on the newer signing keys are verified through JWKS automatically.
   - **Authentication**: enable email sign-in. Create the admin users, then run in the SQL editor:
     ```sql
     update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = 'admin@example.com';
     ```
     Admins must sign out and back in to pick up the role. Everyone else is a parent.
2. **Google Cloud** — enable **YouTube Data API v3** and create an API key restricted to that API → `YOUTUBE_DATA_API_KEY`.
3. **Google AI Studio** — create a Gemini API key → `GEMINI_API_KEY`. The free tier is enough for QA.
4. **Render** — New → **Blueprint** → connect `shaliniy1/KidQ` → pick `render.yaml`, then fill the secret values:
   - `kidq-api`: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET` (if needed), `YOUTUBE_DATA_API_KEY`, `GEMINI_API_KEY`, `CORS_ORIGINS`
   - `kidq-admin` and `kidq-web`: `NEXT_PUBLIC_API_URL` (the `kidq-api` URL), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - After the first deploy, set `CORS_ORIGINS` to the admin and web URLs (comma-separated), e.g. `https://kidq-admin.onrender.com,https://kidq-web.onrender.com`. `NEXT_PUBLIC_*` values are baked in at build time, so redeploy the UIs after changing them.
5. **Check**: `https://<kidq-api>/ready` lists the migrations `001`–`003`; `/docs` shows every endpoint.

## Seed the catalogue (~270 videos)

Run from a laptop against the QA database. `--drain` does the fetching and AI scoring right there, so it doesn't depend on the free API service staying awake:

```bash
cd api
DATABASE_URL='<session pooler url>' DATABASE_SSL=require \
YOUTUBE_DATA_API_KEY=… GEMINI_API_KEY=… \
npm run seed:discover -- --drain
```

- **Items appear immediately** in the admin app as they're saved.
- **AI scoring** stops at the daily free-tier limit. Unscored items stay in *Pending analysis* and continue the next day, when the API's worker is awake or on another `--drain` run.
- **Admins can rate and publish** any item by hand at any time.

## Daily AI scoring on the free tier

[`.github/workflows/drain-jobs.yml`](../.github/workflows/drain-jobs.yml) runs every day just after Gemini's quota resets. It works through queued jobs with that day's allowance, whether or not the free API service is awake.

- **Setup**: add the repository secrets `QA_DATABASE_URL`, `YOUTUBE_DATA_API_KEY` and `GEMINI_API_KEY` (GitHub → Settings → Secrets and variables → Actions).
- **Manual run**: *Actions → Drain QA jobs → Run workflow*.

## Smoke test after each QA deploy

1. `/ready` is green.
2. Sign in to the admin app. The library lists items with their states; a detail page plays the video in the KidQ Player and shows the AI scores with evidence.
3. Adjust sliders and tags, publish one item, and bulk-publish a few "Ready to approve" items.
4. In the parent app (or `/docs` with a parent token), create a child aged 4 with interests. Only published, age-fitting items are recommended, each with reasons.
5. Add one to the library → it appears. Unpublish it in admin → it disappears.

## Prod — what changes

| | QA | Prod |
|---|---|---|
| Render plan | free | paid always-on (smallest: `0.5c-512mb`, "Starter") |
| Worker | in-process in the API | separate service: `npm run start:worker -w api`, and `RUN_WORKER_IN_PROCESS=false` on the API |
| Migrations | at boot | pre-deploy command `npm run db:migrate -w api`, and `RUN_MIGRATIONS_ON_BOOT=false` |
| Discovery | admin clicks "Run discovery" | Render cron job, daily |
| Database | Supabase free (pauses when idle) | Supabase Pro (no pausing, daily backups); `DATABASE_SSL=verify-full` + `DATABASE_CA_CERT` |
| Branch | `main` | `release` (promote from `main` once QA passes) |
| Gemini | free tier | paid tier (no daily video cap; set `AI_INPUT_USD_PER_MTOK` / `AI_OUTPUT_USD_PER_MTOK` to track spend) |

**Secrets**: only ever in Render and Supabase settings. The `.env.example` files list the names. Rotate any key that shows up in a log or a commit.
