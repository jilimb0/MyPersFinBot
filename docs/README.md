# Documentation

This directory contains project documentation for development, operations, and deployment.

## Core Docs

- `ARCHITECTURE.md` - system structure and module boundaries
- `DEV.md` - local development setup
- `ENV.md` - environment variables
- `TESTING.md` - test strategy and commands
- `MONETIZATION.md` - subscriptions, limits, admin billing commands
- `DEBUGGING.md` - troubleshooting and diagnostics

## Operations

- `DEPLOYMENT.md` - production deployment guide
- `RUNBOOK.md` - operational procedures
- `LOGGING.md` - logging strategy and practices
- `RELEASE_CHECKLIST.md` - release readiness checklist

Admin access note:
- Admin UI uses Telegram code authentication with session cookie (`/admin/ui`).
- Admin action history is available in UI and persisted to `logs/admin-actions.jsonl`.

## Engineering References

- `DATABASE_SCHEMA.md` - database entities and relationships
- `CODE_QUALITY.md` - linting/formatting/type-quality standards
- `JSDOC_EXAMPLES.md` - inline documentation examples

## API Docs

Generated API docs are in `docs/api/`.

Commands:

- `pnpm run docs:generate`
- `pnpm run docs:serve`
- `pnpm run docs:clean`
