/**
 * Cache Manager Service
 *
 * Centralized caching layer for the application.
 * Provides type-safe caching for user data, balances, transactions, etc.
 *
 * Features:
 * - Type-safe cache operations
 * - Automatic cache invalidation
 * - TTL management
 * - Cache key prefixing
 * - Batch operations
 */

import { getCache } from "../cache"
import type { CacheInterface } from "../cache/cache.interface"
import { config } from "../config"
import type { Language } from "../i18n"
import logger from "../logger"
import type { Balance, Currency, Transaction, UserData } from "../types"

/**
 * Cache key prefixes
 */
const CACHE_KEYS = {
  USER_DATA: "user:data",
  USER_SETTINGS: "user:settings",
  USER_LANGUAGE: "user:language",
  BALANCES: "balances",
  BALANCE: "balance",
  TRANSACTIONS: "transactions",
  RECENT_TRANSACTIONS: "transactions:recent",
  MONTHLY_STATS: "stats:monthly",
  CATEGORY_TOTALS: "category:totals",
  CURRENCY_RATE: "currency:rate",
} as const

/**
 * Cache TTL (in seconds)
 */
const CACHE_TTL = {
  USER_DATA: 300, // 5 minutes
  USER_SETTINGS: 600, // 10 minutes
  BALANCES: 180, // 3 minutes
  TRANSACTIONS: 120, // 2 minutes
  RECENT_TRANSACTIONS: 60, // 1 minute
  MONTHLY_STATS: 300, // 5 minutes
  CATEGORY_TOTALS: 180, // 3 minutes
  CURRENCY_RATE: 3600, // 1 hour
} as const

/**
 * User settings cache structure
 */
interface UserSettings {
  defaultCurrency: Currency
  language?: Language
  uiMode?: "basic" | "pro"
  uiModeHintShown?: boolean
  autoDeposit?: boolean
  timezone?: string
}

/**
 * Cache Manager Class
 */
export class CacheManager {
  private cache: CacheInterface

  constructor(cache?: CacheInterface) {
    this.cache = cache || getCache()
  }

  /**
   * Build cache key with prefix and identifier
   */
  private buildKey(prefix: string, identifier: string): string {
    return `${prefix}:${identifier}`
  }

  /**
   * Generic get with type safety
   */
  private async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cache.get(key)
      return value as T | null
    } catch (error) {
      logger.error("Cache get error", { key, error })
      return null
    }
  }

  /**
   * Generic set with type safety
   */
  private async set<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttl)
    } catch (error) {
      logger.error("Cache set error", { key, error })
    }
  }

  /**
   * Delete cache entry
   */
  private async delete(key: string): Promise<void> {
    try {
      await this.cache.del(key)
    } catch (error) {
      logger.error("Cache delete error", { key, error })
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  private async deletePattern(pattern: string): Promise<void> {
    try {
      await this.cache.clear(pattern)
    } catch (error) {
      logger.error("Cache clear pattern error", { pattern, error })
    }
  }

  // ==================== USER DATA ====================

  /**
   * Get cached user data
   */
  async getUserData(userId: string): Promise<UserData | null> {
    const key = this.buildKey(CACHE_KEYS.USER_DATA, userId)
    return this.get<UserData>(key)
  }

  /**
   * Cache user data
   */
  async setUserData(userId: string, data: UserData): Promise<void> {
    const key = this.buildKey(CACHE_KEYS.USER_DATA, userId)
    await this.set(key, data, CACHE_TTL.USER_DATA)
  }

  /**
   * Invalidate user data cache
   */
  async invalidateUserData(userId: string): Promise<void> {
    const key = this.buildKey(CACHE_KEYS.USER_DATA, userId)
    await this.delete(key)
  }

  // ==================== USER SETTINGS ====================

  /**
   * Get cached user settings
   */
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    const key = this.buildKey(CACHE_KEYS.USER_SETTINGS, userId)
    return this.get<UserSettings>(key)
  }

  /**
   * Cache user settings
   */
  async setUserSettings(userId: string, settings: UserSettings): Promise<void> {
    const key = this.buildKey(CACHE_KEYS.USER_SETTINGS, userId)
    await this.set(key, settings, CACHE_TTL.USER_SETTINGS)
  }

  /**
   * Update user settings (partial)
   */
  async updateUserSettings(
    userId: string,
    updates: Partial<UserSettings>
  ): Promise<void> {
    const current = await this.getUserSettings(userId)
    if (current) {
      const updated = { ...current, ...updates }
      await this.setUserSettings(userId, updated)
    }
  }

  /**
   * Invalidate user settings cache
   */
  async invalidateUserSettings(userId: string): Promise<void> {
    const key = this.buildKey(CACHE_KEYS.USER_SETTINGS, userId)
    await this.delete(key)
  }

  // ==================== USER LANGUAGE ====================

  /**
   * Get cached user language
   */
  async getUserLanguage(userId: string): Promise<Language | null> {
    const key = this.buildKey(CACHE_KEYS.USER_LANGUAGE, userId)
    return this.get<Language>(key)
  }

  /**
   * Cache user language
   */
  async setUserLanguage(userId: string, language: Language): Promise<void> {
    const key = this.buildKey(CACHE_KEYS.USER_LANGUAGE, userId)
    await this.set(key, language, CACHE_TTL.USER_SETTINGS)
  }

  /**
   * Invalidate user language cache
   */
  async invalidateUserLanguage(userId: string): Promise<void> {
    const key = this.buildKey(CACHE_KEYS.USER_LANGUAGE, userId)
    await this.delete(key)
  }

  // ==================== BALANCES ====================

  /**
   * Get cached balances for user
   */
  async getBalances(userId: string): Promise<Balance[] | null> {
    const key = this.buildKey(CACHE_KEYS.BALANCES, userId)
    return this.get<Balance[]>(key)
  }

  /**
   * Cache balances for user
   */
  async setBalances(userId: string, balances: Balance[]): Promise<void> {
    const key = this.buildKey(CACHE_KEYS.BALANCES, userId)
    await this.set(key, balances, CACHE_TTL.BALANCES)
  }

  /**
   * Get cached single balance
   */
  async getBalance(
    userId: string,
    currency: Currency
  ): Promise<Balance | null> {
    const key = this.buildKey(CACHE_KEYS.BALANCE, `${userId}:${currency}`)
    return this.get<Balance>(key)
  }

  /**
   * Cache single balance
   */
  async setBalance(
    userId: string,
    currency: Currency,
    balance: Balance
  ): Promise<void> {
    const key = this.buildKey(CACHE_KEYS.BALANCE, `${userId}:${currency}`)
    await this.set(key, balance, CACHE_TTL.BALANCES)
  }

  /**
   * Invalidate all balances for user
   */
  async invalidateBalances(userId: string): Promise<void> {
    // Invalidate user's all balances
    const balancesKey = this.buildKey(CACHE_KEYS.BALANCES, userId)
    await this.delete(balancesKey)

    // Also invalidate individual balance caches
    const pattern = this.buildKey(CACHE_KEYS.BALANCE, `${userId}:*`)
    await this.deletePattern(pattern)
  }

  // ==================== TRANSACTIONS ====================

  /**
   * Get cached transactions for user
   */
  async getTransactions(userId: string): Promise<Transaction[] | null> {
    const key = this.buildKey(CACHE_KEYS.TRANSACTIONS, userId)
    return this.get<Transaction[]>(key)
  }

  /**
   * Cache transactions for user
   */
  async setTransactions(
    userId: string,
    transactions: Transaction[]
  ): Promise<void> {
    const key = this.buildKey(CACHE_KEYS.TRANSACTIONS, userId)
    await this.set(key, transactions, CACHE_TTL.TRANSACTIONS)
  }

  /**
   * Get cached recent transactions
   */
  async getRecentTransactions(
    userId: string,
    limit: number = 10
  ): Promise<Transaction[] | null> {
    const key = this.buildKey(
      CACHE_KEYS.RECENT_TRANSACTIONS,
      `${userId}:${limit}`
    )
    return this.get<Transaction[]>(key)
  }

  /**
   * Cache recent transactions
   */
  async setRecentTransactions(
    userId: string,
    transactions: Transaction[],
    limit: number = 10
  ): Promise<void> {
    const key = this.buildKey(
      CACHE_KEYS.RECENT_TRANSACTIONS,
      `${userId}:${limit}`
    )
    await this.set(key, transactions, CACHE_TTL.RECENT_TRANSACTIONS)
  }

  /**
   * Invalidate all transactions for user
   */
  async invalidateTransactions(userId: string): Promise<void> {
    // Invalidate all transactions
    const transactionsKey = this.buildKey(CACHE_KEYS.TRANSACTIONS, userId)
    await this.delete(transactionsKey)

    // Invalidate recent transactions
    const recentPattern = this.buildKey(
      CACHE_KEYS.RECENT_TRANSACTIONS,
      `${userId}:*`
    )
    await this.deletePattern(recentPattern)
  }

  // ==================== STATISTICS ====================

  /**
   * Get cached monthly statistics
   */
  async getMonthlyStats(
    userId: string,
    year: number,
    month: number
  ): Promise<any | null> {
    const key = this.buildKey(
      CACHE_KEYS.MONTHLY_STATS,
      `${userId}:${year}-${month}`
    )
    return this.get<any>(key)
  }

  /**
   * Cache monthly statistics
   */
  async setMonthlyStats(
    userId: string,
    year: number,
    month: number,
    stats: any
  ): Promise<void> {
    const key = this.buildKey(
      CACHE_KEYS.MONTHLY_STATS,
      `${userId}:${year}-${month}`
    )
    await this.set(key, stats, CACHE_TTL.MONTHLY_STATS)
  }

  /**
   * Invalidate monthly statistics
   */
  async invalidateMonthlyStats(
    userId: string,
    year?: number,
    month?: number
  ): Promise<void> {
    if (year && month) {
      const key = this.buildKey(
        CACHE_KEYS.MONTHLY_STATS,
        `${userId}:${year}-${month}`
      )
      await this.delete(key)
    } else {
      // Invalidate all monthly stats for user
      const pattern = this.buildKey(CACHE_KEYS.MONTHLY_STATS, `${userId}:*`)
      await this.deletePattern(pattern)
    }
  }

  /**
   * Get cached category totals
   */
  async getCategoryTotals(
    userId: string,
    year: number,
    month: number
  ): Promise<Record<string, number> | null> {
    const key = this.buildKey(
      CACHE_KEYS.CATEGORY_TOTALS,
      `${userId}:${year}-${month}`
    )
    return this.get<Record<string, number>>(key)
  }

  /**
   * Cache category totals
   */
  async setCategoryTotals(
    userId: string,
    year: number,
    month: number,
    totals: Record<string, number>
  ): Promise<void> {
    const key = this.buildKey(
      CACHE_KEYS.CATEGORY_TOTALS,
      `${userId}:${year}-${month}`
    )
    await this.set(key, totals, CACHE_TTL.CATEGORY_TOTALS)
  }

  /**
   * Invalidate category totals
   */
  async invalidateCategoryTotals(
    userId: string,
    year?: number,
    month?: number
  ): Promise<void> {
    if (year && month) {
      const key = this.buildKey(
        CACHE_KEYS.CATEGORY_TOTALS,
        `${userId}:${year}-${month}`
      )
      await this.delete(key)
    } else {
      const pattern = this.buildKey(CACHE_KEYS.CATEGORY_TOTALS, `${userId}:*`)
      await this.deletePattern(pattern)
    }
  }

  // ==================== CURRENCY RATES ====================

  /**
   * Get cached currency rate
   */
  async getCurrencyRate(from: Currency, to: Currency): Promise<number | null> {
    const key = this.buildKey(CACHE_KEYS.CURRENCY_RATE, `${from}:${to}`)
    return this.get<number>(key)
  }

  /**
   * Cache currency rate
   */
  async setCurrencyRate(
    from: Currency,
    to: Currency,
    rate: number
  ): Promise<void> {
    const key = this.buildKey(CACHE_KEYS.CURRENCY_RATE, `${from}:${to}`)
    await this.set(key, rate, CACHE_TTL.CURRENCY_RATE)
  }

  /**
   * Invalidate currency rate
   */
  async invalidateCurrencyRate(from: Currency, to: Currency): Promise<void> {
    const key = this.buildKey(CACHE_KEYS.CURRENCY_RATE, `${from}:${to}`)
    await this.delete(key)
  }

  /**
   * Invalidate all currency rates
   */
  async invalidateAllCurrencyRates(): Promise<void> {
    const pattern = `${CACHE_KEYS.CURRENCY_RATE}:*`
    await this.deletePattern(pattern)
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Invalidate all caches for a user
   */
  async invalidateAllUserCaches(userId: string): Promise<void> {
    await Promise.all([
      this.invalidateUserData(userId),
      this.invalidateUserSettings(userId),
      this.invalidateUserLanguage(userId),
      this.invalidateBalances(userId),
      this.invalidateTransactions(userId),
      this.invalidateMonthlyStats(userId),
      this.invalidateCategoryTotals(userId),
    ])

    if (config.LOG_CACHE_VERBOSE) {
      logger.info("All caches invalidated for user", { userId })
    }
  }

  /**
   * Invalidate transaction-related caches
   * (balances, transactions, stats) when a transaction is added/updated/deleted
   */
  async invalidateTransactionRelatedCaches(
    userId: string,
    year?: number,
    month?: number
  ): Promise<void> {
    await Promise.all([
      this.invalidateBalances(userId),
      this.invalidateTransactions(userId),
      this.invalidateMonthlyStats(userId, year, month),
      this.invalidateCategoryTotals(userId, year, month),
    ])

    if (config.LOG_CACHE_VERBOSE) {
      logger.debug("Transaction-related caches invalidated", {
        userId,
        year,
        month,
      })
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      return await this.cache.getStats()
    } catch (error) {
      logger.error("Failed to get cache stats", { error })
      return null
    }
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    try {
      await this.cache.clear()
      logger.info("All cache cleared")
    } catch (error) {
      logger.error("Failed to clear cache", { error })
    }
  }
}

// Singleton instance
let cacheManagerInstance: CacheManager | null = null

/**
 * Get cache manager instance
 */
export function getCacheManager(): CacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager()
  }
  return cacheManagerInstance
}

/**
 * Initialize cache manager with custom cache
 */
export function initCacheManager(cache: CacheInterface): CacheManager {
  cacheManagerInstance = new CacheManager(cache)
  return cacheManagerInstance
}
