/**
 * Cache interface for different implementations (Redis, In-Memory, etc.)
 */

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  namespace?: string // Prefix for keys
}

export interface CacheInterface {
  /**
   * Get value from cache
   */
  get<T>(key: string): Promise<T | null>

  /**
   * Set value in cache with optional TTL
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>

  /**
   * Delete value from cache
   */
  del(key: string): Promise<void>

  /**
   * Delete multiple keys
   */
  delMany(keys: string[]): Promise<void>

  /**
   * Check if key exists
   */
  has(key: string): Promise<boolean>

  /**
   * Clear all cache or by pattern
   */
  clear(pattern?: string): Promise<void>

  /**
   * Get all keys matching pattern
   */
  keys(pattern: string): Promise<string[]>

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>

  /**
   * Close cache connection
   */
  close(): Promise<void>
}

export interface CacheStats {
  hits: number
  misses: number
  hitRate: number
  keys: number
  memory?: number // in bytes
}

export interface CacheConfig {
  host?: string
  port?: number
  password?: string
  db?: number
  ttl?: number // Default TTL in seconds
  namespace?: string // Prefix for all keys
  maxRetries?: number
  retryDelay?: number
}
