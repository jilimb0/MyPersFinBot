/**
 * Rate limiter service
 * Implements sliding window rate limiting with Redis session adapter
 */

import logger from "../logger"
import type { RateLimitConfig, RateLimitInfo, RateLimitResult } from "./types"

type RateLimitSession = {
  version: number
  timestamps: number[]
  blockedUntil?: number
}

type VersionedValue<T> = {
  value: T
  version: number
}

type CasResult<T> = {
  ok: boolean
  current?: VersionedValue<T>
}

type SessionStorage<TSession> = {
  get(key: string): Promise<TSession | null>
  set(key: string, value: TSession): Promise<void>
  delete(key: string): Promise<void>
  getWithVersion(key: string): Promise<VersionedValue<TSession> | null>
  compareAndSet(
    key: string,
    expectedVersion: number,
    nextValue: TSession
  ): Promise<CasResult<TSession>>
}

export class RateLimiterService {
  private config: RateLimitConfig
  private readonly keyPrefix = "ratelimit"
  private adapter?: SessionStorage<RateLimitSession>
  private adapterInitPromise?: Promise<void>

  constructor(config: RateLimitConfig) {
    this.config = config
    this.adapterInitPromise = this.initAdapter()
  }

  private initAdapter(): Promise<void> {
    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      return Promise.resolve()
    }

    return (async () => {
      try {
        const dynamicImport: (specifier: string) => Promise<unknown> =
          new Function("s", "return import(s)") as (
            specifier: string
          ) => Promise<unknown>
        const mod = (await (async () => {
          try {
            return (await dynamicImport(
              "@jilimb0/tgwrapper-adapter-redis"
            )) as {
              RedisSessionAdapter: new (options: {
                redisUrl: string
                tenantId: string
                botId: string
                ttlSeconds: number
              }) => SessionStorage<RateLimitSession>
            }
          } catch {
            return (await dynamicImport(
              "@jilimb0/tgwrapper-adapter-redis/dist/index.js"
            )) as {
              RedisSessionAdapter: new (options: {
                redisUrl: string
                tenantId: string
                botId: string
                ttlSeconds: number
              }) => SessionStorage<RateLimitSession>
            }
          }
        })()) as {
          RedisSessionAdapter: new (options: {
            redisUrl: string
            tenantId: string
            botId: string
            ttlSeconds: number
          }) => SessionStorage<RateLimitSession>
        }

        this.adapter = new mod.RedisSessionAdapter({
          redisUrl,
          tenantId: process.env.TGWRAPPER_TENANT_ID || "my-pers-fin",
          botId: process.env.TGWRAPPER_BOT_ID || "telegram-rate-limiter",
          ttlSeconds: Math.max(
            Math.ceil(this.config.windowMs / 1000),
            Math.ceil((this.config.blockDurationMs || 0) / 1000),
            60
          ),
        })
      } catch (error) {
        logger.error("Rate limiter adapter init failed", error)
      }
    })()
  }

  private async getAdapter(): Promise<SessionStorage<RateLimitSession> | null> {
    if (this.adapterInitPromise) {
      await this.adapterInitPromise
    }
    return this.adapter || null
  }

  private storageKey(userId: string): string {
    return `${this.keyPrefix}:${userId}`
  }

  private isBlockedAt(session: RateLimitSession | null, now: number): boolean {
    return Boolean(session?.blockedUntil && session.blockedUntil > now)
  }

  private pruneTimestamps(timestamps: number[], now: number): number[] {
    const windowStart = now - this.config.windowMs
    return timestamps.filter((ts) => ts > windowStart)
  }

  private async updateSession(
    userId: string,
    updater: (current: RateLimitSession | null) => RateLimitSession
  ): Promise<RateLimitSession> {
    const adapter = await this.getAdapter()
    if (!adapter) {
      throw new Error("Rate limiter storage is not available")
    }

    const key = this.storageKey(userId)
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await adapter.getWithVersion(key)
      const currentSession = current?.value || null
      const next = updater(currentSession)

      const result = await adapter.compareAndSet(
        key,
        current?.version || 0,
        next
      )

      if (result.ok) {
        return next
      }
    }

    throw new Error("Rate limiter CAS failed after retries")
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

    const adapter = await this.getAdapter()
    if (!adapter) {
      logger.warn("Rate limiter storage unavailable, allowing request", {
        userId,
      })
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(Date.now() + this.config.windowMs),
      }
    }

    const now = Date.now()
    const initial = await adapter.get(this.storageKey(userId))
    const blocked = this.isBlockedAt(initial, now)

    if (blocked) {
      const ttl = Math.max(
        0,
        Math.ceil(((initial?.blockedUntil || now) - now) / 1000)
      )
      logger.warn("User is rate limited (blocked)", { userId, ttl })

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + ttl * 1000),
        retryAfter: ttl,
      }
    }

    try {
      let blockedAfterCheck = false
      let retryAfter = 0
      const nextSession = await this.updateSession(userId, (current) => {
        const active = this.pruneTimestamps(current?.timestamps || [], now)
        const currentlyBlocked = this.isBlockedAt(current, now)
        if (currentlyBlocked) {
          blockedAfterCheck = true
          retryAfter = Math.max(
            0,
            Math.ceil(((current?.blockedUntil || now) - now) / 1000)
          )
          return {
            version: (current?.version || 0) + 1,
            timestamps: active,
            blockedUntil: current?.blockedUntil,
          }
        }

        if (active.length >= this.config.maxRequests) {
          if (this.config.blockDurationMs) {
            blockedAfterCheck = true
            retryAfter = Math.ceil(this.config.blockDurationMs / 1000)
            return {
              version: (current?.version || 0) + 1,
              timestamps: active,
              blockedUntil: now + this.config.blockDurationMs,
            }
          }
          blockedAfterCheck = true
          retryAfter = Math.ceil(this.config.windowMs / 1000)
          return {
            version: (current?.version || 0) + 1,
            timestamps: active,
            blockedUntil: undefined,
          }
        }

        return {
          version: (current?.version || 0) + 1,
          timestamps: [...active, now],
          blockedUntil: current?.blockedUntil,
        }
      })

      const count = nextSession.timestamps.length
      if (blockedAfterCheck) {
        if (this.config.blockDurationMs) {
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
          retryAfter,
        }
      }

      const remaining = Math.max(0, this.config.maxRequests - count)

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
    const adapter = await this.getAdapter()
    if (!adapter) {
      throw new Error("Rate limiter storage is not available")
    }

    const now = Date.now()

    try {
      const state = await this.updateSession(userId, (current) => {
        const active = this.pruneTimestamps(current?.timestamps || [], now)
        return {
          version: (current?.version || 0) + 1,
          timestamps: active,
          blockedUntil: current?.blockedUntil,
        }
      })
      const count = state.timestamps.length
      const blocked = this.isBlockedAt(state, now)
      const blockedUntil = blocked
        ? new Date(state.blockedUntil || now)
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
    const adapter = await this.getAdapter()
    if (!adapter) {
      throw new Error("Rate limiter storage is not available")
    }

    try {
      await adapter.delete(this.storageKey(userId))
      logger.info("Rate limit reset", { userId })
    } catch (error) {
      logger.error("Error resetting rate limit", error, { userId })
      throw error
    }
  }

  /**
   * Get reset time for user's rate limit
   */
  private async getResetTime(userId: string): Promise<Date> {
    const adapter = await this.getAdapter()
    if (!adapter) {
      return new Date(Date.now() + this.config.windowMs)
    }

    try {
      const now = Date.now()
      const state = await adapter.get(this.storageKey(userId))
      if (!state || state.timestamps.length === 0) {
        return new Date(now + this.config.windowMs)
      }
      const active = this.pruneTimestamps(state.timestamps, now)
      const oldestTime = active.length > 0 ? Math.min(...active) : now
      if (Number.isFinite(oldestTime)) {
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
