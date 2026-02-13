import Redis from "ioredis"
import { config as appConfig } from "../config"
import logger from "../logger"
import type { CacheConfig, CacheInterface, CacheStats } from "./cache.interface"

/**
 * Redis Cache Service with connection pooling and error handling
 */
export class RedisCacheService implements CacheInterface {
  private redis: Redis
  private namespace: string
  private defaultTtl: number
  private stats = {
    hits: 0,
    misses: 0,
  }

  constructor(config: CacheConfig = {}) {
    this.namespace = config.namespace || "bot"
    this.defaultTtl = config.ttl || 3600 // 1 hour default

    // Initialize Redis with retry strategy
    this.redis = new Redis({
      host: config.host || process.env.REDIS_HOST || "127.0.0.1",
      port: config.port || Number(process.env.REDIS_PORT) || 6379,
      password: config.password || process.env.REDIS_PASSWORD,
      db: config.db || 0,
      maxRetriesPerRequest: config.maxRetries || 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        logger.warn(`Redis retry attempt ${times}, delay: ${delay}ms`)
        return delay
      },
      reconnectOnError: (err) => {
        const targetErrors = ["READONLY", "ECONNREFUSED"]
        if (
          targetErrors.some((targetError) => err.message.includes(targetError))
        ) {
          logger.error("Redis reconnecting on error", { error: err.message })
          return true
        }
        return false
      },
    })

    // Setup event handlers
    this.redis.on("connect", () => {
      if (appConfig.LOG_BOOT_DETAIL) {
        logger.info("Redis connected successfully")
      }
    })

    this.redis.on("error", (err) => {
      logger.error("Redis connection error", { error: err.message })
    })

    this.redis.on("close", () => {
      if (appConfig.LOG_BOOT_DETAIL) {
        logger.warn("Redis connection closed")
      }
    })
  }

  /**
   * Build namespaced key
   */
  private buildKey(key: string): string {
    return `${this.namespace}:${key}`
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key)
      const value = await this.redis.get(fullKey)

      if (value === null) {
        this.stats.misses++
        return null
      }

      this.stats.hits++
      return JSON.parse(value) as T
    } catch (error: any) {
      logger.error("Redis get error", { key, error: error.message })
      return null
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const fullKey = this.buildKey(key)
      const serialized = JSON.stringify(value)
      const expiry = ttl || this.defaultTtl

      if (expiry > 0) {
        await this.redis.setex(fullKey, expiry, serialized)
      } else {
        await this.redis.set(fullKey, serialized)
      }

      if (appConfig.LOG_CACHE_VERBOSE) {
        logger.debug("Redis set", { key, ttl: expiry })
      }
    } catch (error: any) {
      logger.error("Redis set error", { key, error: error.message })
      throw error
    }
  }

  /**
   * Delete single key
   */
  async del(key: string): Promise<void> {
    try {
      const fullKey = this.buildKey(key)
      await this.redis.del(fullKey)
      if (appConfig.LOG_CACHE_VERBOSE) {
        logger.debug("Redis del", { key })
      }
    } catch (error: any) {
      logger.error("Redis del error", { key, error: error.message })
      throw error
    }
  }

  /**
   * Delete multiple keys
   */
  async delMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return

    try {
      const fullKeys = keys.map((k) => this.buildKey(k))
      await this.redis.del(...fullKeys)
      logger.debug("Redis delMany", { count: keys.length })
    } catch (error: any) {
      logger.error("Redis delMany error", { error: error.message })
      throw error
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key)
      const exists = await this.redis.exists(fullKey)
      return exists === 1
    } catch (error: any) {
      logger.error("Redis has error", { key, error: error.message })
      return false
    }
  }

  /**
   * Clear cache by pattern or all
   */
  async clear(pattern?: string): Promise<void> {
    try {
      const searchPattern = pattern
        ? this.buildKey(pattern)
        : `${this.namespace}:*`

      const keys = await this.redis.keys(searchPattern)

      if (keys.length > 0) {
        await this.redis.del(...keys)
        logger.info("Redis cleared", {
          pattern: searchPattern,
          count: keys.length,
        })
      }
    } catch (error: any) {
      logger.error("Redis clear error", { pattern, error: error.message })
      throw error
    }
  }

  /**
   * Get keys by pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const searchPattern = this.buildKey(pattern)
      const keys = await this.redis.keys(searchPattern)

      // Remove namespace prefix
      return keys.map((key) => key.replace(`${this.namespace}:`, ""))
    } catch (error: any) {
      logger.error("Redis keys error", { pattern, error: error.message })
      return []
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const keys = await this.redis.keys(`${this.namespace}:*`)
      const info = await this.redis.info("memory")

      // Parse memory usage
      const memoryMatch = info.match(/used_memory:(\d+)/)
      const memory = memoryMatch ? parseInt(memoryMatch[1] || "0", 10) : 0

      const total = this.stats.hits + this.stats.misses
      const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        keys: keys.length,
        memory,
      }
    } catch (error: any) {
      logger.error("Redis getStats error", { error: error.message })
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: 0,
        keys: 0,
      }
    }
  }

  /**
   * Increment value atomically
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const fullKey = this.buildKey(key)
      return await this.redis.incrby(fullKey, amount)
    } catch (error: any) {
      logger.error("Redis increment error", { key, error: error.message })
      throw error
    }
  }

  /**
   * Set key with expiry (atomic)
   */
  async setWithExpiry(key: string, value: any, seconds: number): Promise<void> {
    const fullKey = this.buildKey(key)
    const serialized = JSON.stringify(value)
    await this.redis.setex(fullKey, seconds, serialized)
  }

  /**
   * Get remaining TTL for key
   */
  async getTTL(key: string): Promise<number> {
    try {
      const fullKey = this.buildKey(key)
      return await this.redis.ttl(fullKey)
    } catch (error: any) {
      logger.error("Redis getTTL error", { key, error: error.message })
      return -1
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit()
      logger.info("Redis connection closed gracefully")
    } catch (error: any) {
      logger.error("Redis close error", { error: error.message })
      throw error
    }
  }

  /**
   * Ping Redis to check connection
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping()
      return result === "PONG"
    } catch (error: any) {
      logger.error("Redis ping error", { error: error.message })
      return false
    }
  }
}

// Singleton instance
let cacheInstance: RedisCacheService | null = null

/**
 * Get cache instance (singleton)
 */
export function getCacheService(config?: CacheConfig): RedisCacheService {
  if (!cacheInstance) {
    cacheInstance = new RedisCacheService(config)
  }
  return cacheInstance
}

/**
 * Close cache instance
 */
export async function closeCacheService(): Promise<void> {
  if (cacheInstance) {
    await cacheInstance.close()
    cacheInstance = null
  }
}
