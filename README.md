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

Phase: clean foundation only. No database, auth, or product features yet — those come in the next phase.
