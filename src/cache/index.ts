/**
 * Cache module entry point
 * Automatically selects Redis or In-Memory cache based on availability
 */

import { config as appConfig } from "../config"
import logger from "../logger"
import type { CacheConfig, CacheInterface } from "./cache.interface"
import { MemoryCacheService } from "./memory-cache.service"
import { RedisCacheService } from "./redis-cache.service"

// Export types
export * from "./cache.interface"
export { MemoryCacheService } from "./memory-cache.service"
export { RedisCacheService } from "./redis-cache.service"

// Cache instance
let cacheInstance: CacheInterface | null = null

/**
 * Initialize cache service
 * Tries Redis first, falls back to in-memory if Redis is not available
 */
export async function initializeCache(
  cacheConfig?: CacheConfig
): Promise<CacheInterface> {
  if (cacheInstance) {
    return cacheInstance
  }

  const useRedis = process.env.USE_REDIS !== "false" // Default to true

  if (useRedis) {
    try {
      if (appConfig.LOG_BOOT_DETAIL) {
        logger.info("Attempting to connect to Redis...")
      }
      const redisCache = new RedisCacheService(cacheConfig)

      // Test Redis connection
      const isConnected = await redisCache.ping()

      if (isConnected) {
        if (appConfig.LOG_BOOT_DETAIL) {
          logger.info("✅ Redis cache connected successfully")
        }
        cacheInstance = redisCache
        return redisCache
      } else {
        logger.warn("Redis ping failed, falling back to in-memory cache")
        await redisCache.close()
      }
    } catch (error: any) {
      logger.warn("Redis connection failed, falling back to in-memory cache", {
        error: error.message,
      })
    }
  }

  // Fallback to in-memory cache
  if (appConfig.LOG_BOOT_DETAIL) {
    logger.info("Using in-memory cache (fallback)")
  }
  cacheInstance = new MemoryCacheService(cacheConfig)
  return cacheInstance
}

/**
 * Get cache instance
 * Must call initializeCache() first
 */
export function getCache(): CacheInterface {
  if (!cacheInstance) {
    throw new Error("Cache not initialized. Call initializeCache() first.")
  }
  return cacheInstance
}

/**
 * Close cache connection
 */
export async function closeCache(): Promise<void> {
  if (cacheInstance) {
    await cacheInstance.close()
    cacheInstance = null
    if (appConfig.LOG_BOOT_DETAIL) {
      logger.info("Cache closed")
    }
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  if (!cacheInstance) {
    return null
  }
  return await cacheInstance.getStats()
}

/**
 * Clear cache by pattern
 */
export async function clearCache(pattern?: string): Promise<void> {
  if (cacheInstance) {
    await cacheInstance.clear(pattern)
  }
}

/**
 * Cache decorator for functions
 * Usage: @cache('key', 3600)
 */
export function cache(keyPrefix: string, ttl: number = 3600) {
  return (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) => {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      if (!cacheInstance) {
        return originalMethod.apply(this, args)
      }

      // Build cache key from function name and arguments
      const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`

      // Try to get from cache
      const cached = await cacheInstance.get(cacheKey)
      if (cached !== null) {
        logger.debug("Cache hit", { key: cacheKey })
        return cached
      }

      // Execute original method
      const result = await originalMethod.apply(this, args)

      // Store in cache
      await cacheInstance.set(cacheKey, result, ttl)
      logger.debug("Cache set", { key: cacheKey, ttl })

      return result
    }

    return descriptor
  }
}

/**
 * Cached wrapper for async functions
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyPrefix: string,
  ttl: number = 3600
): T {
  return (async (...args: any[]) => {
    if (!cacheInstance) {
      return fn(...args)
    }

    const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`

    // Try cache
    const cached = await cacheInstance.get(cacheKey)
    if (cached !== null) {
      return cached
    }

    // Execute and cache
    const result = await fn(...args)
    await cacheInstance.set(cacheKey, result, ttl)

    return result
  }) as T
}
