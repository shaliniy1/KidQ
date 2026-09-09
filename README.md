# KidQ

Fresh KidQ foundation — a clean-slate rebuild with separate `web` and `api` apps, no product features yet.

## Structure

```
KidQ/
├── web/    Next.js + TypeScript frontend
├── api/    TypeScript backend (Express)
├── docs/   Project docs
```

## Requirements

- Node.js 20+
- npm 10+

## Setup

```bash
npm install
cp .env.example .env
cp web/.env.example web/.env.local
cp api/.env.example api/.env
```

## Development

Run both apps together:

```bash
npm run dev
```

Or separately:

```bash
npm run dev:web   # http://localhost:3000
npm run dev:api   # http://localhost:4000
```

## Build

```bash
npm run build
```

## Health check

```bash
curl http://localhost:4000/health
```

## Status

## Content discovery

See the complete [KidQ Content Curation System](./docs/content-curation/README.md) for source connectors, transcript and licensing rules, low-cost assessment, PostgreSQL storage, Supabase/Render deployment, and the implementation roadmap.

The API exposes `POST /content/discover`. It creates a provenance-rich KidQ content record and appends it to `KIDQ_DATA_DIR/content.jsonl` (an intentionally simple first storage layer). Opening `GET /content/discover` in a browser returns usage instructions.

YouTube discovery uses the official YouTube Data API only; it does not scrape, download, cache, or copy videos. Set `YOUTUBE_DATA_API_KEY`, then call:

```bash
curl -X POST http://localhost:4000/content/discover \
  -H 'content-type: application/json' \
  -d '{"source":"youtube","query":"calm counting for toddlers","max_results":5,"language":"en","region_code":"US"}'
```

Open sources can be ingested by URL. The fetcher records visible metadata, a clearly marked transcript when the page exposes one, the first iframe URL, and license metadata when present:

```bash
curl -X POST http://localhost:4000/content/discover \
  -H 'content-type: application/json' \
  -d '{"source":"open_web","query":"story","open_urls":["https://example.org/story"]}'
```

Every record is `MANUAL_REVIEW_REQUIRED` unless an explicit exclusion signal is found. This is deliberate: metadata and transcripts cannot establish visual pacing, flashing, audio intensity, or age suitability. YouTube captions are only reported as available; transcript download requires the appropriate official API/OAuth capability and is not performed by scraping.
