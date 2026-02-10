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
- `pnpm test:coverage:ci`

## E2E Scenarios
1. Expense flow: amount -> category (inline) -> account
2. Income flow: amount -> category (inline) -> account
3. Transfer flow: amount -> from account
4. Analytics flow: menu -> net worth/history
5. Export flow: analytics reports -> export CSV
