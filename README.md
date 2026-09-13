# KidQ

A calm, curated library of videos for children from birth to six. KidQ finds content through official source APIs, scores it (AI + admin review), publishes **only what an admin approves**, and recommends it to each child from their parent's onboarding answers.

## Structure

```
KidQ/
├── api/      TypeScript API (Express) + job worker: ingestion, KidQ content score, admin gate, recommendations
├── admin/    Admin Content Studio (Next.js): review, score, tag, publish
├── web/      Parent & child app (Next.js, PWA)
├── packages/ kidq-player: shared restricted video player (React, remote-ready)
├── config/   Source catalog and seed discovery plan
└── docs/     Specs, API integration guide, deployment
```

## Docs

- [Recommendation system](./docs/recommendation/README.md): content score, AI scoring agent, admin gate, ranking
- [Content curation](./docs/content-curation/README.md): sources, rights, rubric, lifecycle
- [API integration guide](./docs/api/README.md): for the UI teams. The live contract is at `/openapi.json`, with interactive docs at `/docs`
- [Deployment](./docs/deployment.md): QA on Render + Supabase free tiers, and what changes for prod

## Requirements

Node.js 22 (see `.node-version`), npm 10+, PostgreSQL 16 for local development.

## Local setup

```bash
npm install
cp api/.env.example api/.env          # AUTH_MODE=dev + local Postgres
cp web/.env.example web/.env.local
createdb kidq && createdb kidq_test
npm run db:migrate -w api
npm run dev                           # web :3000, admin :3001, api :4000 (the job worker runs inside the API)
```

With `AUTH_MODE=dev`:

- **Admin app**: sign in at http://localhost:3001 with any email (no Supabase needed).
- **API**: call it with `Authorization: Bearer dev:admin:<uuid>` or `Bearer dev:parent:<uuid>`, and try it at http://localhost:4000/docs.

## Seed content

```bash
npm run seed:discover -w api -- --drain
```

Loads ~270 videos from YouTube, NASA and Wikimedia, and ~48 StoryWeaver picture books. YouTube needs `YOUTUBE_DATA_API_KEY`; add `GEMINI_API_KEY` for AI scores.

## Checks

```bash
npm run typecheck
npm test          # unit + integration tests against local Postgres (kidq_test)
npm run build
```

## How content reaches a child

1. **Import**: discovery queries or pasted URLs, through official APIs only (YouTube Data API, NASA Image and Video Library, Wikimedia Commons). Nothing is scraped, and YouTube videos are never downloaded.
2. **Score**: rule pre-checks, then the Gemini scoring agent, then the KidQ content score (content & language 40%, pacing 25%, visual comfort 20%, audio comfort 15%). A safety flag withholds the score.
3. **Approve**: admins review, edit and approve in the Admin Content Studio. Nothing is visible to parents or children before that.
4. **Recommend**: ranked for each child profile. The parent adds items to the child's library, which plays in the restricted KidQ Player.
