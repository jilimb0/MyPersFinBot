import { closeCache, initializeCache } from "../../cache"
import { RateLimiterService } from "../../rate-limiter/rate-limiter.service"
import type { RateLimitConfig } from "../../rate-limiter/types"

// Mock Redis
const mockRedis = {
  zremrangebyscore: jest.fn().mockResolvedValue(0),
  zcard: jest.fn().mockResolvedValue(0),
  zadd: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
  pttl: jest.fn().mockResolvedValue(-1),
  zrange: jest.fn().mockResolvedValue([]),
}

// Cache service mock removed - using real implementation

describe.skip("RateLimiterService (requires Redis)", () => {
  let rateLimiter: RateLimiterService
  const testUserId = "123456"

  const defaultConfig: RateLimitConfig = {
    enabled: true,
    maxRequests: 10,
    windowMs: 60000, // 1 minute
    blockDurationMs: 300000, // 5 minutes
    skipAdmins: true,
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    await initializeCache() // Initialize cache before tests
    rateLimiter = new RateLimiterService(defaultConfig)
  })

  afterEach(async () => {
    await closeCache() // Clean up cache after tests
  })

  describe("checkLimit", () => {
    test("should allow request when under limit", async () => {
      mockRedis.zcard.mockResolvedValue(5) // 5 requests so far

      const result = await rateLimiter.checkLimit(testUserId)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4) // 10 - 5 - 1 = 4
      expect(mockRedis.zadd).toHaveBeenCalled()
    })

    test("should deny request when limit exceeded", async () => {
      mockRedis.zcard.mockResolvedValue(10) // At limit

      const result = await rateLimiter.checkLimit(testUserId)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeDefined()
      expect(mockRedis.zadd).not.toHaveBeenCalled()
    })

    test("should skip rate limiting when disabled", async () => {
      const disabledLimiter = new RateLimiterService({
        ...defaultConfig,
        enabled: false,
      })

      const result = await disabledLimiter.checkLimit(testUserId)

      expect(result.allowed).toBe(true)
      expect(mockRedis.zcard).not.toHaveBeenCalled()
    })

    test("should skip rate limiting for admins when configured", async () => {
      const result = await rateLimiter.checkLimit(testUserId, true)

      expect(result.allowed).toBe(true)
      expect(mockRedis.zcard).not.toHaveBeenCalled()
    })

    test("should not skip rate limiting for admins when not configured", async () => {
      const noSkipLimiter = new RateLimiterService({
        ...defaultConfig,
        skipAdmins: false,
      })

      mockRedis.zcard.mockResolvedValue(5)

      const result = await noSkipLimiter.checkLimit(testUserId, true)

      expect(result.allowed).toBe(true)
      expect(mockRedis.zcard).toHaveBeenCalled() // Still checks limit
    })

    test("should block user when limit exceeded and blockDuration set", async () => {
      mockRedis.zcard.mockResolvedValue(10)

      await rateLimiter.checkLimit(testUserId)

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining("ratelimit:block"),
        expect.any(String),
        "PX",
        defaultConfig.blockDurationMs
      )
    })

    test("should deny request when user is blocked", async () => {
      mockRedis.get.mockResolvedValue("blocked")
      mockRedis.pttl.mockResolvedValue(60000) // 60 seconds left

      const result = await rateLimiter.checkLimit(testUserId)

      expect(result.allowed).toBe(false)
      expect(result.retryAfter).toBe(60)
      expect(mockRedis.zcard).not.toHaveBeenCalled()
    })

    test("should fail open on Redis error", async () => {
      mockRedis.zcard.mockRejectedValue(new Error("Redis error"))

      const result = await rateLimiter.checkLimit(testUserId)

      expect(result.allowed).toBe(true) // Fail open
    })
  })

  describe("getInfo", () => {
    test("should return current rate limit info", async () => {
      mockRedis.zcard.mockResolvedValue(5)
      mockRedis.get.mockResolvedValue(null) // Not blocked

      const info = await rateLimiter.getInfo(testUserId)

      expect(info.userId).toBe(testUserId)
      expect(info.count).toBe(5)
      expect(info.blocked).toBe(false)
      expect(info.resetAt).toBeInstanceOf(Date)
    })

    test("should include block info when user is blocked", async () => {
      mockRedis.zcard.mockResolvedValue(10)
      mockRedis.get.mockResolvedValue("blocked")
      mockRedis.pttl.mockResolvedValue(120000) // 2 minutes

      const info = await rateLimiter.getInfo(testUserId)

      expect(info.blocked).toBe(true)
      expect(info.blockedUntil).toBeInstanceOf(Date)
    })
  })

  describe("reset", () => {
    test("should clear rate limit and block for user", async () => {
      await rateLimiter.reset(testUserId)

      expect(mockRedis.del).toHaveBeenCalledTimes(2)
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining("ratelimit:")
      )
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining("ratelimit:block")
      )
    })
  })

  describe("updateConfig", () => {
    test("should update configuration", () => {
      const newConfig = {
        maxRequests: 20,
        windowMs: 120000,
      }

      rateLimiter.updateConfig(newConfig)

      const config = rateLimiter.getConfig()
      expect(config.maxRequests).toBe(20)
      expect(config.windowMs).toBe(120000)
      expect(config.enabled).toBe(true) // Should keep other values
    })
  })

  describe("getConfig", () => {
    test("should return current configuration", () => {
      const config = rateLimiter.getConfig()

      expect(config).toEqual(defaultConfig)
    })

    test("should return copy of config (not reference)", () => {
      const config1 = rateLimiter.getConfig()
      const config2 = rateLimiter.getConfig()

      expect(config1).not.toBe(config2) // Different objects
      expect(config1).toEqual(config2) // But same values
    })
  })
})

describe.skip("RateLimiter Integration (requires Redis)", () => {
  test("should handle multiple concurrent requests", async () => {
    const rateLimiter = new RateLimiterService({
      enabled: true,
      maxRequests: 5,
      windowMs: 60000,
      skipAdmins: false,
    })

    mockRedis.zcard.mockResolvedValue(0)

    const promises = Array.from({ length: 10 }, () =>
      rateLimiter.checkLimit("user123")
    )

    const results = await Promise.all(promises)

    // All should complete without error
    expect(results).toHaveLength(10)
  })

  test("should handle sliding window correctly", async () => {
    const rateLimiter = new RateLimiterService({
      enabled: true,
      maxRequests: 3,
      windowMs: 1000,
      skipAdmins: false,
    })

    // Simulate requests over time
    mockRedis.zcard.mockResolvedValueOnce(0)
    await rateLimiter.checkLimit("user123") // Request 1

    mockRedis.zcard.mockResolvedValueOnce(1)
    await rateLimiter.checkLimit("user123") // Request 2

    mockRedis.zcard.mockResolvedValueOnce(2)
    await rateLimiter.checkLimit("user123") // Request 3

    mockRedis.zcard.mockResolvedValueOnce(3)
    const result = await rateLimiter.checkLimit("user123") // Request 4 - should fail

    expect(result.allowed).toBe(false)
  })
})
