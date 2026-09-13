# KidQ

KidQ is a curated video library for children aged 0–6:
- **In**: content arrives through official source APIs.
- **Scored**: it gets a KidQ content score from rule checks, the Gemini scoring agent and admin review.
- **Out**: it reaches families only after an admin publishes it.

Domain terms are in `CONTEXT.md`.

## Where things live

- `api/` — Express + Postgres API and job worker: ingestion, scoring, admin gate, recommendations.
  - Implementation spec: `docs/recommendation/README.md`
  - Sources, rights and rubric: `docs/content-curation/README.md`
- `admin/` — Admin Content Studio (Next.js). Its typed client is generated from `api/openapi.json`.
- `web/` — the parent/child PWA, owned by a teammate. Change it only when asked. Integration guide: `docs/api/README.md`.
- `packages/kidq-player` — the restricted player shared by `admin/` and `web/`.
- Environments and deploys: `docs/deployment.md`.
- **Status, open work and QA prerequisites: `docs/status.md` — read it before planning.**

## Invariants

- **Admin gate.** Only an admin publication decision makes content visible, and every parent/child query reads `APPROVED` items only. RULE and MODEL assessors may recommend rejection; approval is HUMAN-only, and the database enforces it (`assessments_no_automated_approval`, `publication_decisions_admin_approval`).
- **Official APIs only**: YouTube Data API, NASA Image and Video Library, MediaWiki, and StoryWeaver's public API (undocumented; confirm with StoryWeaver before prod — `docs/content-curation/storyweaver.md`). Third-party media stays at its source and plays through the KidQ Player; picture books open in its story reader. Gemini watches the public YouTube URL; KidQ keeps no copy of YouTube media.
- **Rights gate.** Each item gets a `rights_assertions` row. An unknown permission disables the operation it covers: media copy, transcript storage, playback.
- **Content score** comes only from the API (`api/src/domain/scoring`); UIs render `content_score` as given. Ranking uses relevance, content score, expert review and preference — popularity signals stay out.
- **Family scope.** Parent queries filter by the signed-in parent. Gemini receives only the video, its public metadata and the rubric.
- **Secrets** live in Render and Supabase settings; `.env.example` files list names only.

## Changing the API

- **Schema**: add a new numbered migration in `api/db/migrations/`. Migrations run via `npm run db:migrate -w api`, and at boot on QA. A shipped migration is never edited.
- **Contract**: routes and zod schemas in `api/src/http/` define `api/openapi.json`. A contract change is done when:
  - `npm run openapi:write -w api` has run and its output is committed
  - `npm run gen:api -w admin` has run and its output is committed
  - `npm run openapi:check -w api` passes (CI checks both files)
- **Nullable schemas**: for a registered (named) schema, write `z.union([schema, z.null()])`. `.nullable()` on a registered schema generates an unusable client type.
- **Query strings**: Express uses the `simple` query parser (flat params). It also shields the open `qs` advisory until the Express 5 upgrade.

## Running and testing

- **Tests**: `npm test -w api` needs local Postgres with a `kidq_test` database. Tests run on recorded fixtures (`api/test/fixtures`) and spend no YouTube or Gemini quota.
- **Local auth**: with `AUTH_MODE=dev`, the API accepts `Bearer dev:<admin|parent>:<uuid>`. The admin app signs in with any email when the Supabase env vars are unset.
- **Next.js types**: `LayoutProps` and `PageProps` are generated — run `npx next typegen` before a bare `tsc`. The root `npm run typecheck` does this.
- **Env on Render**: `NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them.

## Done means

`npm run typecheck`, `npm test` and `npm run build` pass, and any contract change has been regenerated as above.
