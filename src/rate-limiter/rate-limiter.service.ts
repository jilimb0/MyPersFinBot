/**
 * Rate limiter service
 * Implements sliding window rate limiting with Redis
 */

import { getRedisClient } from "../cache"
import logger from "../logger"
import type { RateLimitConfig, RateLimitInfo, RateLimitResult } from "./types"

export class RateLimiterService {
  private config: RateLimitConfig
  private readonly keyPrefix = "ratelimit"
  private readonly blockPrefix = "ratelimit:block"

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  /**
   * Check if request is allowed
   */
  async checkLimit(
    userId: string,
    isAdmin: boolean = false
  ): Promise<RateLimitResult> {
    // Skip if rate limiting disabled
    if (!this.config.enabled) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(Date.now() + this.config.windowMs),
      }
    }

    // Skip rate limiting for admins if configured
    if (isAdmin && this.config.skipAdmins) {
      logger.debug("Rate limit skipped for admin", { userId })
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(Date.now() + this.config.windowMs),
      }
    }

    // Check if user is blocked
    // const blockKey = `${this.blockPrefix}:${userId}`
    const blocked = await this.isBlocked(userId)

    if (blocked) {
      const ttl = await this.getBlockTTL(userId)
      logger.warn("User is rate limited (blocked)", { userId, ttl })

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + ttl * 1000),
        retryAfter: ttl,
      }
    }

    // Increment counter
    const redis = getRedisClient()
    const key = `${this.keyPrefix}:${userId}`
    const now = Date.now()
    const windowStart = now - this.config.windowMs

    try {
      // Use sorted set for sliding window
      // Remove old entries
      await redis.zremrangebyscore(key, 0, windowStart)

      // Count current requests
      const count = await redis.zcard(key)

      // Check if limit exceeded
      if (count >= this.config.maxRequests) {
        // Block user if configured
        if (this.config.blockDurationMs) {
          await this.blockUser(userId, this.config.blockDurationMs)
          logger.warn("User rate limit exceeded - blocked", {
            userId,
            count,
            maxRequests: this.config.maxRequests,
            blockDuration: this.config.blockDurationMs,
          })
        } else {
          logger.warn("User rate limit exceeded", {
            userId,
            count,
            maxRequests: this.config.maxRequests,
          })
        }

        return {
          allowed: false,
          remaining: 0,
          resetAt: await this.getResetTime(userId),
          retryAfter: Math.ceil(this.config.windowMs / 1000),
        }
      }

      // Add current request
      await redis.zadd(key, now, `${now}:${Math.random()}`)

      // Set expiry on key
      await redis.expire(key, Math.ceil(this.config.windowMs / 1000))

      const remaining = this.config.maxRequests - count - 1

      logger.debug("Rate limit check passed", {
        userId,
        count: count + 1,
        remaining,
        maxRequests: this.config.maxRequests,
      })

      return {
        allowed: true,
        remaining,
        resetAt: await this.getResetTime(userId),
      }
    } catch (error) {
      logger.error("Rate limiter error - allowing request", error, { userId })
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(Date.now() + this.config.windowMs),
      }
    }
  }

  /**
   * Get rate limit info for user
   */
  async getInfo(userId: string): Promise<RateLimitInfo> {
    const redis = getRedisClient()
    const key = `${this.keyPrefix}:${userId}`
    const now = Date.now()
    const windowStart = now - this.config.windowMs

    try {
      // Remove old entries
      await redis.zremrangebyscore(key, 0, windowStart)

      // Get current count
      const count = await redis.zcard(key)

      // Check if blocked
      const blocked = await this.isBlocked(userId)
      const blockedUntil = blocked
        ? new Date(Date.now() + (await this.getBlockTTL(userId)) * 1000)
        : undefined

      return {
        userId,
        count,
        resetAt: await this.getResetTime(userId),
        blocked,
        blockedUntil,
      }
    } catch (error) {
      logger.error("Error getting rate limit info", error, { userId })
      throw error
    }
  }

  /**
   * Reset rate limit for user
   */
  async reset(userId: string): Promise<void> {
    const redis = getRedisClient()
    const key = `${this.keyPrefix}:${userId}`
    const blockKey = `${this.blockPrefix}:${userId}`

    try {
      await redis.del(key)
      await redis.del(blockKey)
      logger.info("Rate limit reset", { userId })
    } catch (error) {
      logger.error("Error resetting rate limit", error, { userId })
      throw error
    }
  }

  /**
   * Block user
   */
  private async blockUser(userId: string, durationMs: number): Promise<void> {
    const redis = getRedisClient()
    const blockKey = `${this.blockPrefix}:${userId}`

    try {
      await redis.set(blockKey, Date.now().toString(), "PX", durationMs)
      logger.warn("User blocked", { userId, durationMs })
    } catch (error) {
      logger.error("Error blocking user", error, { userId })
    }
  }

  /**
   * Check if user is blocked
   */
  private async isBlocked(userId: string): Promise<boolean> {
    const redis = getRedisClient()
    const blockKey = `${this.blockPrefix}:${userId}`

    try {
      const blocked = await redis.get(blockKey)
      return blocked !== null
    } catch (error) {
      logger.error("Error checking if user is blocked", error, { userId })
      return false
    }
  }

  /**
   * Get block TTL in seconds
   */
  private async getBlockTTL(userId: string): Promise<number> {
    const redis = getRedisClient()
    const blockKey = `${this.blockPrefix}:${userId}`

    try {
      const ttl = await redis.pttl(blockKey)
      return Math.ceil(ttl / 1000)
    } catch (error) {
      logger.error("Error getting block TTL", error, { userId })
      return 0
    }
  }

  /**
   * Get reset time for user's rate limit
   */
  private async getResetTime(userId: string): Promise<Date> {
    const redis = getRedisClient()
    const key = `${this.keyPrefix}:${userId}`

    try {
      // Get oldest entry
      const oldest = await redis.zrange(key, 0, 0, "WITHSCORES")

      if (oldest.length >= 2) {
        const oldestTime = parseInt(oldest[1], 10)
        return new Date(oldestTime + this.config.windowMs)
      }

      return new Date(Date.now() + this.config.windowMs)
    } catch (error) {
      logger.error("Error getting reset time", error, { userId })
      return new Date(Date.now() + this.config.windowMs)
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info("Rate limiter config updated", this.config)
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config }
  }
}

/**
 * Default rate limiter instance
 */
export const rateLimiter = new RateLimiterService({
  enabled: process.env.RATE_LIMIT_ENABLED === "true",
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_MESSAGES || "30", 10),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
  blockDurationMs: 300000, // 5 minutes
  skipAdmins: true,
})

export default rateLimiter
