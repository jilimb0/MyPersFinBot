# Testing Guide

## Prerequisites

- Node.js 20.x
- pnpm 8.x
- SQLite available (local)

## Step-by-Step Instructions

1. Install dependencies
2. Run unit tests
3. Run integration/E2E tests
4. Check coverage

## Verification

- All tests pass
- Coverage report generated in `coverage/`

## Troubleshooting

- If tests hang, check mocked timers and async handlers
- If coverage fails, adjust thresholds in `jest.config.js`

## Test Suites

- Unit: `src/__tests__/unit/**/*.test.ts`
- Integration: `src/__tests__/integration/**/*.test.ts`
- E2E flows: expense, income, transfer, analytics, export

## Commands

- `pnpm test`
- `pnpm test:coverage`
- `pnpm test:coverage:stable`
- `pnpm test:ci`
- `pnpm test:e2e`
- `pnpm test:e2e:critical`
- `pnpm test:e2e:ci`
- `pnpm test:integration:real-db`
- `pnpm test:integration:real-db:ci`
- `pnpm benchmark`
- `pnpm benchmark:ci`
- `pnpm benchmark:profile:fx`
- `pnpm benchmark:profile:db`
- `pnpm benchmark:profile:nlp`

## Real DB Integration

- Dedicated suite: `src/__tests__/integration/real-db.sqlite.integration.test.ts`
- Uses `better-sqlite3` file-backed DB (not in-memory SQLJS)
- Enabled via `REAL_DB_TEST=1` or `CI_REAL_DB=true`

## E2E Scenarios

1. Expense flow: amount -> category (inline) -> account
2. Income flow: amount -> category (inline) -> account
3. Transfer flow: amount -> from account
4. Analytics flow: menu -> net worth/history
5. Export flow: analytics reports -> export CSV

## CI E2E Gate

- Dedicated CI job runs `pnpm test:e2e:ci`
- Critical suite includes:
  - expense flow
  - income flow
  - voice flow
  - analytics flow
- In CI, E2E tests use `jest.retryTimes(2)` for flake resistance.
- CI uploads JSON result artifact: `artifacts/test-results/e2e-critical.json`.

## CI Real DB Gate

- Dedicated CI job runs `pnpm test:integration:real-db:ci`.
- CI uploads JSON result artifact: `artifacts/test-results/real-db.json`.

## Benchmarks

- CI benchmark job runs `pnpm benchmark:ci`.
- CI uploads JSON benchmark artifact: `artifacts/benchmarks/summary.json`.
