/**
 * Unit tests for CacheManager
 */

import type { CacheInterface } from "../../cache/cache.interface"
import type { Language } from "../../i18n"
import { CacheManager } from "../../services/cache-manager"
import {
  type Balance,
  type Currency,
  ExpenseCategory,
  IncomeCategory,
  type Transaction,
  TransactionType,
} from "../../types"

// Mock cache implementation
class MockCache implements CacheInterface {
  private store = new Map<string, { value: any; expiry: number }>()

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key)
    if (!entry) return null

    // Check expiry
    if (entry.expiry && Date.now() > entry.expiry) {
      this.store.delete(key)
      return null
    }

    return entry.value as T
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiry = ttl ? Date.now() + ttl * 1000 : 0
    this.store.set(key, { value, expiry })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async delMany(keys: string[]): Promise<void> {
    keys.forEach((key) => this.store.delete(key))
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key)
  }

  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.store.clear()
      return
    }

    // Simple pattern matching
    const regex = new RegExp(pattern.replace(/\*/g, ".*"))
    const keysToDelete: string[] = []

    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach((key) => this.store.delete(key))
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"))
    const matchingKeys: string[] = []

    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        matchingKeys.push(key)
      }
    }

    return matchingKeys
  }

  async getStats(): Promise<any> {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      keys: this.store.size,
      memory: 0,
    }
  }

  async close(): Promise<void> {
    this.store.clear()
  }

  // Helper for tests
  getAllKeys(): string[] {
    return Array.from(this.store.keys())
  }
}

describe("CacheManager", () => {
  let cacheManager: CacheManager
  let mockCache: MockCache

  beforeEach(() => {
    mockCache = new MockCache()
    cacheManager = new CacheManager(mockCache)
  })

  afterEach(async () => {
    await mockCache.close()
  })

  describe("User Data", () => {
    const userId = "user123"
    const userData = {
      id: userId,
      defaultCurrency: "USD" as Currency,
      language: "en" as Language,
    }

    test("should cache and retrieve user data", async () => {
      await cacheManager.setUserData(userId, userData as any)
      const cached = await cacheManager.getUserData(userId)
      expect(cached).toEqual(userData)
    })

    test("should return null for non-existent user data", async () => {
      const cached = await cacheManager.getUserData("nonexistent")
      expect(cached).toBeNull()
    })

    test("should invalidate user data", async () => {
      await cacheManager.setUserData(userId, userData as any)
      await cacheManager.invalidateUserData(userId)
      const cached = await cacheManager.getUserData(userId)
      expect(cached).toBeNull()
    })
  })

  describe("User Settings", () => {
    const userId = "user123"
    const settings = {
      defaultCurrency: "USD" as Currency,
      language: "en" as Language,
      autoDeposit: true,
      timezone: "UTC",
    }

    test("should cache and retrieve user settings", async () => {
      await cacheManager.setUserSettings(userId, settings)
      const cached = await cacheManager.getUserSettings(userId)
      expect(cached).toEqual(settings)
    })

    test("should update user settings", async () => {
      await cacheManager.setUserSettings(userId, settings)
      await cacheManager.updateUserSettings(userId, {
        language: "ru" as Language,
      })
      const cached = await cacheManager.getUserSettings(userId)
      expect(cached?.language).toBe("ru")
      expect(cached?.defaultCurrency).toBe("USD")
    })

    test("should invalidate user settings", async () => {
      await cacheManager.setUserSettings(userId, settings)
      await cacheManager.invalidateUserSettings(userId)
      const cached = await cacheManager.getUserSettings(userId)
      expect(cached).toBeNull()
    })
  })

  describe("User Language", () => {
    const userId = "user123"
    const language: Language = "en"

    test("should cache and retrieve user language", async () => {
      await cacheManager.setUserLanguage(userId, language)
      const cached = await cacheManager.getUserLanguage(userId)
      expect(cached).toBe(language)
    })

    test("should invalidate user language", async () => {
      await cacheManager.setUserLanguage(userId, language)
      await cacheManager.invalidateUserLanguage(userId)
      const cached = await cacheManager.getUserLanguage(userId)
      expect(cached).toBeNull()
    })
  })

  describe("Balances", () => {
    const userId = "user123"
    const balances: Balance[] = [
      {
        currency: "USD",
        amount: 1000,
        accountId: "cash",
        lastUpdated: new Date(),
      },
      {
        currency: "EUR",
        amount: 500,
        accountId: "bank",
        lastUpdated: new Date(),
      },
    ]

    test("should cache and retrieve balances", async () => {
      await cacheManager.setBalances(userId, balances)
      const cached = await cacheManager.getBalances(userId)
      expect(cached).toEqual(balances)
    })

    test("should cache and retrieve single balance", async () => {
      const balance = balances[0]!
      await cacheManager.setBalance(userId, "USD", balance)
      const cached = await cacheManager.getBalance(userId, "USD")
      expect(cached).toEqual(balance)
    })

    test("should invalidate all balances", async () => {
      await cacheManager.setBalances(userId, balances)
      await cacheManager.setBalance(userId, "USD", balances[0]!)
      await cacheManager.invalidateBalances(userId)

      const cachedAll = await cacheManager.getBalances(userId)
      const cachedSingle = await cacheManager.getBalance(userId, "USD")

      expect(cachedAll).toBeNull()
      expect(cachedSingle).toBeNull()
    })
  })

  describe("Transactions", () => {
    const userId = "user123"
    const transactions: Transaction[] = [
      {
        id: "1",
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: "USD",
        category: ExpenseCategory.FOOD_DINING,
        description: "Lunch",
        date: new Date(),
        fromAccountId: "cash",
      },
      {
        id: "2",
        type: TransactionType.INCOME,
        amount: 500,
        currency: "USD",
        category: IncomeCategory.SALARY,
        description: "Monthly salary",
        date: new Date(),
        toAccountId: "cash",
      },
    ]

    test("should cache and retrieve transactions", async () => {
      await cacheManager.setTransactions(userId, transactions)
      const cached = await cacheManager.getTransactions(userId)
      expect(cached).toEqual(transactions)
    })

    test("should cache and retrieve recent transactions", async () => {
      const recent = transactions.slice(0, 1)
      await cacheManager.setRecentTransactions(userId, recent, 1)
      const cached = await cacheManager.getRecentTransactions(userId, 1)
      expect(cached).toEqual(recent)
    })

    test("should invalidate all transactions", async () => {
      await cacheManager.setTransactions(userId, transactions)
      await cacheManager.setRecentTransactions(userId, transactions.slice(0, 1))
      await cacheManager.invalidateTransactions(userId)

      const cachedAll = await cacheManager.getTransactions(userId)
      const cachedRecent = await cacheManager.getRecentTransactions(userId)

      expect(cachedAll).toBeNull()
      expect(cachedRecent).toBeNull()
    })
  })

  describe("Statistics", () => {
    const userId = "user123"
    const year = 2026
    const month = 1
    const stats = {
      totalIncome: 1000,
      totalExpenses: 500,
      balance: 500,
    }
    const categoryTotals = {
      food: 200,
      transport: 150,
      entertainment: 150,
    }

    test("should cache and retrieve monthly stats", async () => {
      await cacheManager.setMonthlyStats(userId, year, month, stats)
      const cached = await cacheManager.getMonthlyStats(userId, year, month)
      expect(cached).toEqual(stats)
    })

    test("should invalidate specific monthly stats", async () => {
      await cacheManager.setMonthlyStats(userId, year, month, stats)
      await cacheManager.invalidateMonthlyStats(userId, year, month)
      const cached = await cacheManager.getMonthlyStats(userId, year, month)
      expect(cached).toBeNull()
    })

    test("should invalidate all monthly stats for user", async () => {
      await cacheManager.setMonthlyStats(userId, 2026, 1, stats)
      await cacheManager.setMonthlyStats(userId, 2026, 2, stats)
      await cacheManager.invalidateMonthlyStats(userId)

      const cached1 = await cacheManager.getMonthlyStats(userId, 2026, 1)
      const cached2 = await cacheManager.getMonthlyStats(userId, 2026, 2)

      expect(cached1).toBeNull()
      expect(cached2).toBeNull()
    })

    test("should cache and retrieve category totals", async () => {
      await cacheManager.setCategoryTotals(userId, year, month, categoryTotals)
      const cached = await cacheManager.getCategoryTotals(userId, year, month)
      expect(cached).toEqual(categoryTotals)
    })

    test("should invalidate category totals", async () => {
      await cacheManager.setCategoryTotals(userId, year, month, categoryTotals)
      await cacheManager.invalidateCategoryTotals(userId, year, month)
      const cached = await cacheManager.getCategoryTotals(userId, year, month)
      expect(cached).toBeNull()
    })
  })

  describe("Currency Rates", () => {
    test("should cache and retrieve currency rate", async () => {
      await cacheManager.setCurrencyRate("USD", "EUR", 0.85)
      const cached = await cacheManager.getCurrencyRate("USD", "EUR")
      expect(cached).toBe(0.85)
    })

    test("should invalidate currency rate", async () => {
      await cacheManager.setCurrencyRate("USD", "EUR", 0.85)
      await cacheManager.invalidateCurrencyRate("USD", "EUR")
      const cached = await cacheManager.getCurrencyRate("USD", "EUR")
      expect(cached).toBeNull()
    })

    test("should invalidate all currency rates", async () => {
      await cacheManager.setCurrencyRate("USD", "EUR", 0.85)
      await cacheManager.setCurrencyRate("USD", "UAH", 0.73)
      await cacheManager.invalidateAllCurrencyRates()

      const cached1 = await cacheManager.getCurrencyRate("USD", "EUR")
      const cached2 = await cacheManager.getCurrencyRate("USD", "UAH")

      expect(cached1).toBeNull()
      expect(cached2).toBeNull()
    })
  })

  describe("Bulk Operations", () => {
    const userId = "user123"

    test("should invalidate all user caches", async () => {
      // Setup various caches
      await cacheManager.setUserData(userId, { id: userId } as any)
      await cacheManager.setUserSettings(userId, {
        defaultCurrency: "USD",
      })
      await cacheManager.setUserLanguage(userId, "en")
      await cacheManager.setBalances(userId, [])
      await cacheManager.setTransactions(userId, [])
      await cacheManager.setMonthlyStats(userId, 2026, 1, {})
      await cacheManager.setCategoryTotals(userId, 2026, 1, {})

      // Invalidate all
      await cacheManager.invalidateAllUserCaches(userId)

      // Check all are null
      expect(await cacheManager.getUserData(userId)).toBeNull()
      expect(await cacheManager.getUserSettings(userId)).toBeNull()
      expect(await cacheManager.getUserLanguage(userId)).toBeNull()
      expect(await cacheManager.getBalances(userId)).toBeNull()
      expect(await cacheManager.getTransactions(userId)).toBeNull()
      expect(await cacheManager.getMonthlyStats(userId, 2026, 1)).toBeNull()
      expect(await cacheManager.getCategoryTotals(userId, 2026, 1)).toBeNull()
    })

    test("should invalidate transaction-related caches", async () => {
      const year = 2026
      const month = 1

      // Setup caches
      await cacheManager.setBalances(userId, [])
      await cacheManager.setTransactions(userId, [])
      await cacheManager.setMonthlyStats(userId, year, month, {})
      await cacheManager.setCategoryTotals(userId, year, month, {})

      // Invalidate transaction-related
      await cacheManager.invalidateTransactionRelatedCaches(userId, year, month)

      // Check
      expect(await cacheManager.getBalances(userId)).toBeNull()
      expect(await cacheManager.getTransactions(userId)).toBeNull()
      expect(await cacheManager.getMonthlyStats(userId, year, month)).toBeNull()
      expect(
        await cacheManager.getCategoryTotals(userId, year, month)
      ).toBeNull()
    })
  })

  describe("Utility Methods", () => {
    test("should get cache stats", async () => {
      const stats = await cacheManager.getStats()
      expect(stats).toBeDefined()
      expect(stats).toHaveProperty("keys")
    })

    test("should clear all cache", async () => {
      await cacheManager.setUserData("user1", { id: "user1" } as any)
      await cacheManager.setUserData("user2", { id: "user2" } as any)

      await cacheManager.clearAll()

      const stats = await cacheManager.getStats()
      expect(stats?.keys).toBe(0)
    })
  })
})
