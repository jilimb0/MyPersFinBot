import { AnalyticsService } from "../../analytics/analytics.service"
import {
  getPeriodRange,
  calculatePercentChange,
  getTrend,
  formatAmount,
  formatPercent,
} from "../../analytics/helpers"

// Mock database
jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getTransactions: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"
import { Transaction, TransactionType } from "../../types"

const mockGetTransactions = dbStorage.getTransactions as jest.MockedFunction<
  typeof dbStorage.getTransactions
>

describe("AnalyticsService", () => {
  let service: AnalyticsService
  const userId = "123"

  beforeEach(() => {
    jest.clearAllMocks()
    service = new AnalyticsService()
  })

  describe("getSummary", () => {
    test("should calculate basic stats", async () => {
      const mockTransactions = [
        {
          id: "1",
          type: TransactionType.INCOME,
          amount: 1000,
          currency: "RUB",
          category: "SALARY",
          date: new Date(),
        },
        {
          id: "2",
          type: TransactionType.EXPENSE,
          amount: 500,
          currency: "RUB",
          category: "FOOD",
          date: new Date(),
        },
      ]

      mockGetTransactions.mockResolvedValue(mockTransactions as Transaction[])

      const summary = await service.getSummary(userId, "month", "RUB")

      expect(summary.stats.income).toBe(1000)
      expect(summary.stats.expense).toBe(500)
      expect(summary.stats.balance).toBe(500)
      expect(summary.stats.transactions).toBe(2)
    })

    test("should group by categories", async () => {
      const mockTransactions = [
        {
          id: "1",
          type: TransactionType.EXPENSE,
          amount: 300,
          currency: "RUB",
          category: "FOOD",
          date: new Date(),
        },
        {
          id: "2",
          type: TransactionType.EXPENSE,
          amount: 200,
          currency: "RUB",
          category: "FOOD",
          date: new Date(),
        },
        {
          id: "3",
          type: TransactionType.EXPENSE,
          amount: 500,
          currency: "RUB",
          category: "TRANSPORT",
          date: new Date(),
        },
      ]

      mockGetTransactions.mockResolvedValue(mockTransactions as Transaction[])

      const summary = await service.getSummary(userId, "month", "RUB")

      expect(summary.categories).toHaveLength(2)
      expect(summary.categories?.[0]?.total).toBe(500) // TRANSPORT (sorted by total)
      expect(summary.categories?.[1]?.total).toBe(500) // FOOD
    })

    test("should generate insights", async () => {
      const mockTransactions = [
        {
          id: "1",
          type: TransactionType.INCOME,
          amount: 1000,
          currency: "RUB",
          category: "SALARY",
          date: new Date(),
        },
        {
          id: "2",
          type: TransactionType.EXPENSE,
          amount: 200,
          currency: "RUB",
          category: "FOOD",
          date: new Date(),
        },
      ]

      mockGetTransactions.mockResolvedValue(mockTransactions as Transaction[])

      const summary = await service.getSummary(userId, "month", "RUB")

      expect(summary.insights).toBeDefined()
      expect(summary.insights.length).toBeGreaterThan(0)
    })
  })

  describe("comparePeriods", () => {
    test("should compare two periods", async () => {
      const currentTransactions = [
        {
          id: "1",
          type: TransactionType.INCOME,
          amount: 2000,
          currency: "RUB",
          date: new Date(),
        },
        {
          id: "2",
          type: TransactionType.EXPENSE,
          amount: 1000,
          currency: "RUB",
          date: new Date(),
        },
      ]

      const previousTransactions = [
        {
          id: "3",
          type: TransactionType.INCOME,
          amount: 1000,
          currency: "RUB",
          date: new Date(),
        },
        {
          id: "4",
          type: TransactionType.EXPENSE,
          amount: 800,
          currency: "RUB",
          date: new Date(),
        },
      ]

      mockGetTransactions
        .mockResolvedValueOnce(currentTransactions as Transaction[])
        .mockResolvedValueOnce(previousTransactions as Transaction[])

      const comparison = await service.comparePeriods(userId, "month", "RUB")

      expect(comparison.current.income).toBe(2000)
      expect(comparison.previous.income).toBe(1000)
      expect(comparison.change.income).toBe(1000)
      expect(comparison.change.incomePercent).toBe(100)
    })
  })

  describe("getMonthlyTrend", () => {
    test("should group transactions by month", async () => {
      const mockTransactions = [
        {
          id: "1",
          type: TransactionType.INCOME,
          amount: 1000,
          currency: "RUB",
          date: new Date("2026-01-15"),
        },
        {
          id: "2",
          type: TransactionType.EXPENSE,
          amount: 500,
          currency: "RUB",
          date: new Date("2026-01-20"),
        },
        {
          id: "3",
          type: TransactionType.INCOME,
          amount: 2000,
          currency: "RUB",
          date: new Date("2026-02-10"),
        },
      ]

      mockGetTransactions.mockResolvedValue(mockTransactions as Transaction[])

      const trend = await service.getMonthlyTrend(userId, 6, "RUB")

      expect(trend).toBeDefined()
      expect(Array.isArray(trend)).toBe(true)
    })
  })
})

describe("Analytics Helpers", () => {
  describe("getPeriodRange", () => {
    test("should get today range", () => {
      const { start, end } = getPeriodRange("today")

      expect(start.getHours()).toBe(0)
      expect(end.getHours()).toBe(23)
    })

    test("should get week range starting from Monday", () => {
      const { start } = getPeriodRange("week")

      const dayOfWeek = start.getDay()
      expect(dayOfWeek).toBe(1) // Monday
    })

    test("should get month range starting from 1st", () => {
      const { start } = getPeriodRange("month")

      expect(start.getDate()).toBe(1)
    })
  })

  describe("calculatePercentChange", () => {
    test("should calculate positive change", () => {
      const change = calculatePercentChange(150, 100)
      expect(change).toBe(50)
    })

    test("should calculate negative change", () => {
      const change = calculatePercentChange(50, 100)
      expect(change).toBe(-50)
    })

    test("should handle zero previous value", () => {
      const change = calculatePercentChange(100, 0)
      expect(change).toBe(100)
    })
  })

  describe("getTrend", () => {
    test("should return up for significant increase", () => {
      const trend = getTrend(150, 100)
      expect(trend).toBe("up")
    })

    test("should return down for significant decrease", () => {
      const trend = getTrend(50, 100)
      expect(trend).toBe("down")
    })

    test("should return stable for small changes", () => {
      const trend = getTrend(102, 100)
      expect(trend).toBe("stable")
    })
  })

  describe("formatAmount", () => {
    test("should format RUB amount", () => {
      const formatted = formatAmount(1234.56, "RUB")
      expect(formatted).toContain("1234.56")
      expect(formatted).toContain("₽")
    })

    test("should format USD amount", () => {
      const formatted = formatAmount(1234.56, "USD")
      expect(formatted).toContain("1234.56")
      expect(formatted).toContain("$")
    })
  })

  describe("formatPercent", () => {
    test("should format positive percent", () => {
      const formatted = formatPercent(25.5)
      expect(formatted).toBe("+25.5%")
    })

    test("should format negative percent", () => {
      const formatted = formatPercent(-15.3)
      expect(formatted).toBe("-15.3%")
    })
  })
})

describe("Analytics Integration", () => {
  test("should handle empty transactions", async () => {
    mockGetTransactions.mockResolvedValue([])

    const service = new AnalyticsService()
    const summary = await service.getSummary("123", "month", "RUB")

    expect(summary.stats.income).toBe(0)
    expect(summary.stats.expense).toBe(0)
    expect(summary.stats.balance).toBe(0)
    expect(summary.categories).toHaveLength(0)
  })

  test("should handle multiple currencies (filter by currency)", async () => {
    const mockTransactions = [
      {
        id: "1",
        type: TransactionType.INCOME,
        amount: 1000,
        currency: "RUB",
        date: new Date(),
      },
    ]

    mockGetTransactions.mockResolvedValue(mockTransactions as Transaction[])

    const service = new AnalyticsService()
    const summary = await service.getSummary("123", "month", "RUB")

    expect(summary.currency).toBe("RUB")
  })
})
