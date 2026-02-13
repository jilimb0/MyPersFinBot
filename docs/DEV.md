# Development

## Prerequisites

- Node.js 20+
- pnpm
- FFmpeg (for voice)

## Setup

1. Install dependencies:

```bash
pnpm install
```

1. Create `.env`:

```bash
cp .env.example .env
```

1. Run in dev:

```bash
pnpm dev
```

## Useful Commands

- `pnpm type-check`
- `pnpm test`
- `pnpm test:coverage`
- `pnpm test:coverage:ci`
- `pnpm lint`
- `pnpm i18n:check`
- `pnpm i18n:prune`

## Local Services

- Redis is optional. If unavailable, in‑memory cache is used.

## Debug Logs

See `docs/DEBUGGING.md`.

## Environment

See `docs/ENV.md`.
