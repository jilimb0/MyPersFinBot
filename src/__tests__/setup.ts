/**
 * Jest setup file
 * Runs before all tests
 */

// Mock environment variables
process.env.NODE_ENV = "test"
process.env.BOT_TOKEN = "test-bot-token"
process.env.DATABASE_PATH = ":memory:"

// Global test timeout
jest.setTimeout(10000)

// Suppress console logs during tests (optional)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}
