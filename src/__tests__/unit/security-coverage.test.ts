import {
  cleanupRateLimits,
  isRateLimited,
  isUserAllowed,
  SECURITY_CONFIG,
  securityCheck,
  sendRateLimitMessage,
  sendUnauthorizedMessage,
} from "../../security"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn().mockResolvedValue("en"),
  },
}))

jest.mock("../../i18n", () => ({
  t: jest.fn((_lang, key) => key),
  resolveLanguage: jest.fn((lang) => lang || "en"),
  Language: "en",
}))

const mockBot = {
  sendMessage: jest.fn().mockResolvedValue({}),
} as any

const mockMessage = {
  chat: { id: 123 },
  from: { id: 456 },
} as any

describe("Security Coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset config to defaults
    SECURITY_CONFIG.ALLOWED_USERS = []
    SECURITY_CONFIG.BLOCKED_USERS = []
    SECURITY_CONFIG.RATE_LIMIT.enabled = false
    // Clear rate limit store
    cleanupRateLimits()
  })

  describe("isUserAllowed", () => {
    test("allows all users when whitelist is empty", () => {
      SECURITY_CONFIG.ALLOWED_USERS = []
      SECURITY_CONFIG.BLOCKED_USERS = []

      expect(isUserAllowed("123")).toBe(true)
      expect(isUserAllowed("456")).toBe(true)
    })

    test("blocks users in blacklist", () => {
      SECURITY_CONFIG.BLOCKED_USERS = ["123", "456"]

      expect(isUserAllowed("123")).toBe(false)
      expect(isUserAllowed("456")).toBe(false)
      expect(isUserAllowed("789")).toBe(true)
    })

    test("allows only whitelisted users", () => {
      SECURITY_CONFIG.ALLOWED_USERS = ["123", "456"]
      SECURITY_CONFIG.BLOCKED_USERS = []

      expect(isUserAllowed("123")).toBe(true)
      expect(isUserAllowed("456")).toBe(true)
      expect(isUserAllowed("789")).toBe(false)
    })

    test("blacklist takes precedence over whitelist", () => {
      SECURITY_CONFIG.ALLOWED_USERS = ["123", "456"]
      SECURITY_CONFIG.BLOCKED_USERS = ["123"]

      expect(isUserAllowed("123")).toBe(false)
      expect(isUserAllowed("456")).toBe(true)
    })
  })

  describe("sendUnauthorizedMessage", () => {
    test("sends unauthorized message", async () => {
      await sendUnauthorizedMessage(mockBot, 123, "456")

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.any(String),
        { parse_mode: "Markdown" }
      )
    })

    test("logs unauthorized access when enabled", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation()
      SECURITY_CONFIG.LOG_UNAUTHORIZED_ACCESS = true

      await sendUnauthorizedMessage(mockBot, 123, "456")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unauthorized access attempt from user 456")
      )

      consoleSpy.mockRestore()
    })
  })

  describe("isRateLimited", () => {
    test("returns false when rate limiting is disabled", () => {
      SECURITY_CONFIG.RATE_LIMIT.enabled = false

      expect(isRateLimited("user-disabled-1")).toBe(false)
    })

    test("allows first request", () => {
      SECURITY_CONFIG.RATE_LIMIT.enabled = true
      SECURITY_CONFIG.RATE_LIMIT.maxMessages = 5
      SECURITY_CONFIG.RATE_LIMIT.windowMs = 60000

      expect(isRateLimited("user-first-1")).toBe(false)
    })

    test("blocks after exceeding limit", () => {
      SECURITY_CONFIG.RATE_LIMIT.enabled = true
      SECURITY_CONFIG.RATE_LIMIT.maxMessages = 3
      SECURITY_CONFIG.RATE_LIMIT.windowMs = 60000

      // Use unique userId to avoid state pollution
      const userId = `user-exceed-${Date.now()}`

      // First 3 requests should pass (count: 1, 2, 3)
      expect(isRateLimited(userId)).toBe(false)
      expect(isRateLimited(userId)).toBe(false)
      expect(isRateLimited(userId)).toBe(false)

      // 4th request should be blocked (count would be 4, which exceeds 3)
      expect(isRateLimited(userId)).toBe(true)
      expect(isRateLimited(userId)).toBe(true)
    })

    test("resets after window expires", async () => {
      SECURITY_CONFIG.RATE_LIMIT.enabled = true
      SECURITY_CONFIG.RATE_LIMIT.maxMessages = 2
      SECURITY_CONFIG.RATE_LIMIT.windowMs = 100 // 100ms window

      // Use unique userId to avoid state pollution
      const userId = `user-reset-${Date.now()}`

      // First 2 requests should pass
      expect(isRateLimited(userId)).toBe(false)
      expect(isRateLimited(userId)).toBe(false)
      // 3rd should be blocked
      expect(isRateLimited(userId)).toBe(true)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Should allow again
      expect(isRateLimited(userId)).toBe(false)
    })

    test("tracks users independently", () => {
      SECURITY_CONFIG.RATE_LIMIT.enabled = true
      SECURITY_CONFIG.RATE_LIMIT.maxMessages = 2
      SECURITY_CONFIG.RATE_LIMIT.windowMs = 60000

      // Use unique userIds to avoid state pollution
      const user1 = `user-independent-1-${Date.now()}`
      const user2 = `user-independent-2-${Date.now()}`

      // First 2 requests for each user should pass
      expect(isRateLimited(user1)).toBe(false)
      expect(isRateLimited(user2)).toBe(false)
      expect(isRateLimited(user1)).toBe(false)
      expect(isRateLimited(user2)).toBe(false)

      // Both users hit limit independently on 3rd request
      expect(isRateLimited(user1)).toBe(true)
      expect(isRateLimited(user2)).toBe(true)
    })
  })

  describe("sendRateLimitMessage", () => {
    test("sends rate limit message with wait time", async () => {
      SECURITY_CONFIG.RATE_LIMIT.enabled = true
      SECURITY_CONFIG.RATE_LIMIT.maxMessages = 1
      SECURITY_CONFIG.RATE_LIMIT.windowMs = 60000

      // Use unique userId to avoid state pollution
      const userId = `user-ratelimit-msg-${Date.now()}`

      // Trigger rate limit: first passes, second is blocked
      isRateLimited(userId)
      isRateLimited(userId)

      await sendRateLimitMessage(mockBot, 123, userId)

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.any(String),
        { parse_mode: "Markdown" }
      )
    })

    test("logs rate limit warning", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation()

      await sendRateLimitMessage(mockBot, 123, "456")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Rate limit exceeded for user 456")
      )

      consoleSpy.mockRestore()
    })
  })

  describe("cleanupRateLimits", () => {
    test("removes expired entries", async () => {
      SECURITY_CONFIG.RATE_LIMIT.enabled = true
      SECURITY_CONFIG.RATE_LIMIT.maxMessages = 1
      SECURITY_CONFIG.RATE_LIMIT.windowMs = 100

      // Use unique userId to avoid state pollution
      const userId = `user-cleanup-${Date.now()}`

      // First request passes
      expect(isRateLimited(userId)).toBe(false)
      // Second request should be blocked
      expect(isRateLimited(userId)).toBe(true)
      // Still blocked
      expect(isRateLimited(userId)).toBe(true)

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Cleanup expired entries
      cleanupRateLimits()

      // Should allow again after cleanup
      expect(isRateLimited(userId)).toBe(false)
    })
  })

  describe("securityCheck", () => {
    test("allows authorized user", async () => {
      SECURITY_CONFIG.ALLOWED_USERS = []
      SECURITY_CONFIG.BLOCKED_USERS = []
      SECURITY_CONFIG.RATE_LIMIT.enabled = false

      const result = await securityCheck(mockBot, mockMessage)

      expect(result).toBe(true)
      expect(mockBot.sendMessage).not.toHaveBeenCalled()
    })

    test("blocks unauthorized user", async () => {
      SECURITY_CONFIG.ALLOWED_USERS = ["999"]
      SECURITY_CONFIG.BLOCKED_USERS = []

      const result = await securityCheck(mockBot, mockMessage)

      expect(result).toBe(false)
      expect(mockBot.sendMessage).toHaveBeenCalled()
    })

    test("blocks rate limited user", async () => {
      SECURITY_CONFIG.RATE_LIMIT.enabled = true
      SECURITY_CONFIG.RATE_LIMIT.maxMessages = 1

      // First call should pass
      const result1 = await securityCheck(mockBot, mockMessage)
      expect(result1).toBe(true)

      // Second call should be rate limited
      const result2 = await securityCheck(mockBot, mockMessage)
      expect(result2).toBe(false)
      expect(mockBot.sendMessage).toHaveBeenCalled()
    })

    test("handles message without from field", async () => {
      const messageWithoutFrom = {
        chat: { id: 123 },
      } as any

      const result = await securityCheck(mockBot, messageWithoutFrom)

      // Should handle gracefully
      expect(typeof result).toBe("boolean")
    })
  })

  describe("SECURITY_CONFIG", () => {
    test("parses ALLOWED_USERS from env", () => {
      expect(Array.isArray(SECURITY_CONFIG.ALLOWED_USERS)).toBe(true)
    })

    test("parses BLOCKED_USERS from env", () => {
      expect(Array.isArray(SECURITY_CONFIG.BLOCKED_USERS)).toBe(true)
    })

    test("has rate limit configuration", () => {
      expect(SECURITY_CONFIG.RATE_LIMIT).toBeDefined()
      expect(typeof SECURITY_CONFIG.RATE_LIMIT.enabled).toBe("boolean")
      expect(typeof SECURITY_CONFIG.RATE_LIMIT.maxMessages).toBe("number")
      expect(typeof SECURITY_CONFIG.RATE_LIMIT.windowMs).toBe("number")
    })

    test("has LOG_UNAUTHORIZED_ACCESS flag", () => {
      expect(typeof SECURITY_CONFIG.LOG_UNAUTHORIZED_ACCESS).toBe("boolean")
    })
  })
})
