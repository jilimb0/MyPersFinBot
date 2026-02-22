/**
 * Extra setup for E2E stability in CI.
 */
if (process.env.CI === "true") {
  jest.retryTimes(2, { logErrorsBeforeRetry: true })
}
