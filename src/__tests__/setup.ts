/**
 * Jest setup file
 * Runs before all tests
 */

// Mock environment variables
process.env.NODE_ENV = "test"
process.env.TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || "test-token-000000000000"
process.env.DB_PATH = process.env.DB_PATH || ":memory:"
process.env.DATABASE_PATH = process.env.DATABASE_PATH || ":memory:"

// Node 18 compatibility for undici/web APIs used by some imports.
if (typeof (globalThis as any).File === "undefined") {
  ;(globalThis as any).File = class File extends Blob {
    name: string
    lastModified: number

    constructor(
      bits: unknown[],
      name: string,
      options?: {
        type?: string
        endings?: "transparent" | "native"
        lastModified?: number
      }
    ) {
      super(bits as any, options as any)
      this.name = name
      this.lastModified = options?.lastModified ?? Date.now()
    }
  }
}

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
