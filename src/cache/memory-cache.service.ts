import NodeCache from "node-cache"
import { config as appConfig } from "../config"
import logger from "../logger"
import type { CacheConfig, CacheInterface, CacheStats } from "./cache.interface"

/**
 * In-Memory Cache Service (fallback if Redis is not available)
 * Note: Methods are async to match CacheService interface for Redis compatibility,
 * even though memory operations are synchronous
 */
export class MemoryCacheService implements CacheInterface {
  private cache: NodeCache
  private namespace: string
  private stats = {
    hits: 0,
    misses: 0,
  }

  constructor(config: CacheConfig = {}) {
    this.namespace = config.namespace || "bot"

    this.cache = new NodeCache({
      stdTTL: config.ttl || 3600, // 1 hour default
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false, // Better performance
    })

    if (appConfig.LOG_BOOT_DETAIL) {
      logger.info("Memory cache initialized (in-memory fallback)")
    }
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
    const fullKey = this.buildKey(key)
    const value = this.cache.get<T>(fullKey)

    if (value === undefined) {
      this.stats.misses++
      return null
    }

    this.stats.hits++
    return value
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.buildKey(key)

    if (ttl !== undefined && ttl > 0) {
      this.cache.set(fullKey, value, ttl)
    } else {
      this.cache.set(fullKey, value)
    }
  }

  /**
   * Delete single key
   */
  async del(key: string): Promise<void> {
    const fullKey = this.buildKey(key)
    this.cache.del(fullKey)
  }

  /**
   * Delete multiple keys
   */
  async delMany(keys: string[]): Promise<void> {
    const fullKeys = keys.map((k) => this.buildKey(k))
    this.cache.del(fullKeys)
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key)
    return this.cache.has(fullKey)
  }

  /**
   * Clear cache by pattern or all
   */
  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      // Clear all keys with our namespace
      const keys = this.cache.keys()
      const namespacedKeys = keys.filter((k) =>
        k.startsWith(`${this.namespace}:`)
      )
      this.cache.del(namespacedKeys)
    } else {
      // Clear by pattern
      const searchPattern = this.buildKey(pattern)
      const keys = this.cache.keys()
      const matchingKeys = keys.filter((k) => k.includes(searchPattern))
      this.cache.del(matchingKeys)
    }
  }

  /**
   * Get keys by pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const searchPattern = this.buildKey(pattern)
    const allKeys = this.cache.keys()

    const matchingKeys = allKeys.filter((k) => k.includes(searchPattern))

    // Remove namespace prefix
    return matchingKeys.map((key) => key.replace(`${this.namespace}:`, ""))
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const keys = this.cache
      .keys()
      .filter((k) => k.startsWith(`${this.namespace}:`))
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      keys: keys.length,
    }
  }

  /**
   * Close cache (no-op for memory cache)
   */
  async close(): Promise<void> {
    this.cache.flushAll()
    if (appConfig.LOG_BOOT_DETAIL) {
      logger.info("Memory cache closed")
    }
  }
}
