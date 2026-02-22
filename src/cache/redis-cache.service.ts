import { randomUUID } from "node:crypto"
import { config as appConfig } from "../config"
import logger from "../logger"
import type { CacheConfig, CacheInterface, CacheStats } from "./cache.interface"

type RedisKvNamespaceLike = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  ttl(key: string): Promise<number>
  incr(key: string): Promise<number>
  scanKeys(options?: { count?: number }): Promise<string[]>
}

type RedisKvStoreLike = {
  disconnect(): Promise<void>
  withNamespace(namespace: string): RedisKvNamespaceLike
}

/**
 * Redis Cache Service implemented via RedisKvStore from tgwrapper adapter.
 */
export class RedisCacheService implements CacheInterface {
  private namespace: string
  private defaultTtl: number
  private kv?: RedisKvStoreLike
  private ns?: RedisKvNamespaceLike
  private initPromise?: Promise<void>
  private stats = {
    hits: 0,
    misses: 0,
  }

  constructor(config: CacheConfig = {}) {
    this.namespace = config.namespace || "bot"
    this.defaultTtl = config.ttl || 3600
    this.initPromise = this.initialize(config)
  }

  private buildRedisUrl(config: CacheConfig): string {
    if (process.env.REDIS_URL) return process.env.REDIS_URL

    const host = config.host || process.env.REDIS_HOST || "127.0.0.1"
    const port = config.port || Number(process.env.REDIS_PORT) || 6379
    const password = config.password || process.env.REDIS_PASSWORD
    const db = config.db || 0

    if (password) {
      return `redis://:${encodeURIComponent(password)}@${host}:${port}/${db}`
    }
    return `redis://${host}:${port}/${db}`
  }

  private initialize(config: CacheConfig): Promise<void> {
    return (async () => {
      const dynamicImport: (specifier: string) => Promise<unknown> =
        new Function("s", "return import(s)") as (
          specifier: string
        ) => Promise<unknown>

      const mod = (await (async () => {
        try {
          return (await dynamicImport("@jilimb0/tgwrapper-adapter-redis")) as {
            RedisKvStore: new (options: {
              redisUrl: string
              prefix: string
              defaultTtlSeconds: number
            }) => RedisKvStoreLike
          }
        } catch {
          return (await dynamicImport(
            "@jilimb0/tgwrapper-adapter-redis/dist/index.js"
          )) as {
            RedisKvStore: new (options: {
              redisUrl: string
              prefix: string
              defaultTtlSeconds: number
            }) => RedisKvStoreLike
          }
        }
      })()) as {
        RedisKvStore: new (options: {
          redisUrl: string
          prefix: string
          defaultTtlSeconds: number
        }) => RedisKvStoreLike
      }

      const kv = new mod.RedisKvStore({
        redisUrl: this.buildRedisUrl(config),
        prefix: process.env.TGWRAPPER_KV_PREFIX || "framework:kv",
        defaultTtlSeconds: this.defaultTtl,
      })

      this.kv = kv
      this.ns = kv.withNamespace(this.namespace)
    })()
  }

  private async getNamespace(): Promise<RedisKvNamespaceLike> {
    if (this.initPromise) {
      await this.initPromise
    }
    if (!this.ns) {
      throw new Error("Redis KV namespace is not initialized")
    }
    return this.ns
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const ns = await this.getNamespace()
      const raw = await ns.get(key)
      if (raw === null) {
        this.stats.misses++
        return null
      }
      this.stats.hits++
      return JSON.parse(raw) as T
    } catch (error: any) {
      logger.error("Redis get error", { key, error: error?.message })
      return null
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const ns = await this.getNamespace()
      const expiry = ttl ?? this.defaultTtl
      await ns.set(key, JSON.stringify(value), expiry)
      if (appConfig.LOG_CACHE_VERBOSE) {
        logger.debug("Redis set", { key, ttl: expiry })
      }
    } catch (error: any) {
      logger.error("Redis set error", { key, error: error?.message })
      throw error
    }
  }

  async del(key: string): Promise<void> {
    try {
      const ns = await this.getNamespace()
      await ns.del(key)
      if (appConfig.LOG_CACHE_VERBOSE) {
        logger.debug("Redis del", { key })
      }
    } catch (error: any) {
      logger.error("Redis del error", { key, error: error?.message })
      throw error
    }
  }

  async delMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return

    try {
      const ns = await this.getNamespace()
      await Promise.all(keys.map((key) => ns.del(key)))
      logger.debug("Redis delMany", { count: keys.length })
    } catch (error: any) {
      logger.error("Redis delMany error", { error: error?.message })
      throw error
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const ns = await this.getNamespace()
      return await ns.exists(key)
    } catch (error: any) {
      logger.error("Redis has error", { key, error: error?.message })
      return false
    }
  }

  async clear(pattern?: string): Promise<void> {
    try {
      const keys = await this.keys(pattern || "*")
      if (keys.length === 0) return
      await this.delMany(keys)
      logger.info("Redis cleared", {
        pattern: pattern || "*",
        count: keys.length,
      })
    } catch (error: any) {
      logger.error("Redis clear error", { pattern, error: error?.message })
      throw error
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      const ns = await this.getNamespace()
      if (!pattern || pattern === "*") {
        return await ns.scanKeys()
      }

      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      const regex = new RegExp(`^${escaped.replace(/\*/g, ".*")}$`)
      const keys = await ns.scanKeys()
      return keys.filter((key) => regex.test(key))
    } catch (error: any) {
      logger.error("Redis keys error", { pattern, error: error?.message })
      return []
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const keys = await this.keys("*")
      const total = this.stats.hits + this.stats.misses
      const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        keys: keys.length,
      }
    } catch (error: any) {
      logger.error("Redis getStats error", { error: error?.message })
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: 0,
        keys: 0,
      }
    }
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    const ns = await this.getNamespace()
    if (amount === 1) {
      return await ns.incr(key)
    }
    const current = (await this.get<number>(key)) || 0
    const next = current + amount
    await this.set(key, next)
    return next
  }

  async setWithExpiry(
    key: string,
    value: unknown,
    seconds: number
  ): Promise<void> {
    await this.set(key, value, seconds)
  }

  async getTTL(key: string): Promise<number> {
    try {
      const ns = await this.getNamespace()
      return await ns.ttl(key)
    } catch (error: any) {
      logger.error("Redis getTTL error", { key, error: error?.message })
      return -1
    }
  }

  async close(): Promise<void> {
    try {
      if (this.kv) {
        await this.kv.disconnect()
      }
      logger.info("Redis KV connection closed gracefully")
    } catch (error: any) {
      logger.error("Redis close error", { error: error?.message })
      throw error
    }
  }

  async ping(): Promise<boolean> {
    try {
      const probeKey = `__ping__:${randomUUID()}`
      await this.set(probeKey, "pong", 5)
      const value = await this.get<string>(probeKey)
      await this.del(probeKey)
      return value === "pong"
    } catch (error: any) {
      logger.error("Redis ping error", { error: error?.message })
      return false
    }
  }
}

let cacheInstance: RedisCacheService | null = null

export function getCacheService(config?: CacheConfig): RedisCacheService {
  if (!cacheInstance) {
    cacheInstance = new RedisCacheService(config)
  }
  return cacheInstance
}

export async function closeCacheService(): Promise<void> {
  if (cacheInstance) {
    await cacheInstance.close()
    cacheInstance = null
  }
}
