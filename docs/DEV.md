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
2. Create `.env`:
```bash
cp .env.example .env
```
3. Run in dev:
```bash
pnpm dev
```

## Useful Commands
- `pnpm type-check`
- `pnpm test`
- `pnpm lint`

## Local Services
- Redis is optional. If unavailable, in‑memory cache is used.

## Debug Logs
See `docs/DEBUGGING.md`.

## Environment
See `docs/ENV.md`.
