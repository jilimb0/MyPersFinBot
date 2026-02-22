import { registerCommands } from "../../commands"
import { dbStorage } from "../../database/storage-db"
import { clearPersistedCache, resetMetrics } from "../../fx"
import { queryMonitor } from "../../monitoring"
import { ExpenseCategory, TransactionType } from "../../types"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn().mockResolvedValue("en"),
    getBalances: jest.fn().mockResolvedValue("No balances"),
    getBalancesList: jest
      .fn()
      .mockResolvedValue([{ accountId: "acc1", amount: 100, currency: "USD" }]),
    getTemplates: jest.fn().mockResolvedValue([]),
    getUserData: jest.fn().mockResolvedValue({ defaultCurrency: "USD" }),
    addTransaction: jest.fn().mockResolvedValue("tx-123"),
    getSmartBalanceSelection: jest.fn().mockResolvedValue("acc1"),
    searchTransactions: jest.fn().mockResolvedValue({
      transactions: [],
      total: 0,
      hasMore: false,
    }),
  },
}))
jest.mock("../../services/chart-service", () => ({
  generateChartImage: jest.fn(),
}))

const mockDbStorage = dbStorage as jest.Mocked<typeof dbStorage>

jest.mock("crypto", () => {
  const actualCrypto = jest.requireActual("crypto")
  return {
    ...actualCrypto,
    randomUUID: jest.fn(() => "test-uuid-123"),
  }
})

// Mock logger before utils to prevent initialization issues
jest.mock("../../logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock("../../utils", () => ({
  ...jest.requireActual("../../utils"),
  escapeMarkdown: jest.fn((text) => text),
  formatMoney: jest.fn((amount, currency) => `${amount} ${currency}`),
}))

jest.mock("../../i18n", () => ({
  t: jest.fn((_lang, key) => key),
  getExpenseCategoryByLabel: jest.fn((input) =>
    input === "Food" ? "FOOD_DINING" : "OTHER_EXPENSE"
  ),
  getIncomeCategoryByLabel: jest.fn((input) =>
    input === "Salary" ? "SALARY" : "OTHER_INCOME"
  ),
  getCategoryLabel: jest.fn((_, cat) => cat),
}))

jest.mock("../../monitoring", () => ({
  queryMonitor: {
    formatReport: jest.fn().mockReturnValue("Query Stats Report"),
    reset: jest.fn(),
  },
}))

jest.mock("../../fx", () => ({
  clearPersistedCache: jest.fn().mockResolvedValue(undefined),
  getCacheHitRate: jest.fn().mockReturnValue(95.5),
  getCacheStatus: jest.fn().mockReturnValue({
    cacheValid: true,
    cacheAge: 1000,
    nextUpdate: 23000,
    isPersisted: true,
    errorCount: 0,
  }),
  getMetrics: jest.fn().mockReturnValue({
    cacheHits: 100,
    cacheMisses: 5,
    apiCalls: 10,
    apiErrors: 0,
    retries: 1,
    http2Used: true,
    lastUpdate: Date.now(),
  }),
  resetMetrics: jest.fn(),
}))

const mockBot = {
  on: jest.fn(),
  sendMessage: jest.fn().mockResolvedValue({}),
  sendDocument: jest.fn().mockResolvedValue({}),
} as any

describe("Commands Coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    registerCommands(mockBot)
  })

  describe("/balance command", () => {
    test("registers /balance command", () => {
      expect(mockBot.on).toHaveBeenCalledWith("message", expect.any(Function))
    })

    test("handles /balance command", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("balance")
      )?.[1]

      expect(handler).toBeDefined()

      await handler({ chat: { id: 123 } })

      expect(mockDbStorage.getBalances).toHaveBeenCalledWith("123")
      expect(mockBot.sendMessage).toHaveBeenCalled()
    })
  })

  describe("/templates command", () => {
    test("shows empty message when no templates", async () => {
      mockDbStorage.getTemplates.mockResolvedValueOnce([])

      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("templates")
      )?.[1]

      await handler({ chat: { id: 123 } })

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("commands.templates.empty"),
        expect.any(Object)
      )
    })

    test("shows templates list with buttons", async () => {
      mockDbStorage.getTemplates.mockResolvedValueOnce([
        {
          id: "tpl1",
          name: "Coffee",
          amount: 5,
          currency: "USD",
          type: TransactionType.EXPENSE,
          category: "FOOD_DINING",
        },
      ])

      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("templates")
      )?.[1]

      await handler({ chat: { id: 123 } })

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.any(String),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        })
      )
    })
  })

  describe("/expense command", () => {
    test("handles valid expense with amount first", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("expense")
      )?.[1]

      await handler({ chat: { id: 123 } }, ["/expense 50 Food", "50 Food"])

      expect(mockDbStorage.addTransaction).toHaveBeenCalledWith(
        "123",
        expect.objectContaining({
          amount: 50,
          type: TransactionType.EXPENSE,
        })
      )
      expect(mockBot.sendMessage).toHaveBeenCalled()
    })

    test("handles valid expense with amount last", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("expense")
      )?.[1]

      await handler({ chat: { id: 123 } }, ["/expense Food 50", "Food 50"])

      expect(mockDbStorage.addTransaction).toHaveBeenCalled()
    })

    test("handles invalid expense format", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("expense")
      )?.[1]

      await handler({ chat: { id: 123 } }, ["/expense invalid", "invalid"])

      expect(mockDbStorage.addTransaction).not.toHaveBeenCalled()
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        "commands.expense.invalidFormat",
        expect.any(Object)
      )
    })

    test("warns when no balances exist", async () => {
      mockDbStorage.getBalancesList.mockResolvedValueOnce([])

      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("expense")
      )?.[1]

      await handler({ chat: { id: 123 } }, ["/expense 50 Food", "50 Food"])

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        "warnings.noBalancesAdd"
      )
    })

    test("shows change account button when multiple balances", async () => {
      mockDbStorage.getBalancesList.mockResolvedValueOnce([
        {
          accountId: "acc1",
          amount: 100,
          currency: "USD",
          lastUpdated: Date(),
        },
        {
          accountId: "acc2",
          amount: 200,
          currency: "USD",
          lastUpdated: Date(),
        },
      ])

      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("expense")
      )?.[1]

      await handler({ chat: { id: 123 } }, ["/expense 50 Food", "50 Food"])

      const lastCall =
        mockBot.sendMessage.mock.calls[
          mockBot.sendMessage.mock.calls.length - 1
        ]
      expect(lastCall[2].reply_markup.inline_keyboard).toHaveLength(2)
    })
  })

  describe("/income command", () => {
    test("handles valid income", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("income")
      )?.[1]

      await handler({ chat: { id: 123 } }, [
        "/income 1000 Salary",
        "1000 Salary",
      ])

      expect(mockDbStorage.addTransaction).toHaveBeenCalledWith(
        "123",
        expect.objectContaining({
          amount: 1000,
          type: TransactionType.INCOME,
        })
      )
    })

    test("handles invalid income format", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("income")
      )?.[1]

      await handler({ chat: { id: 123 } }, ["/income invalid", "invalid"])

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        "commands.income.invalidFormat",
        expect.any(Object)
      )
    })

    test("warns when no balances exist", async () => {
      mockDbStorage.getBalancesList.mockResolvedValueOnce([])

      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("income")
      )?.[1]

      await handler({ chat: { id: 123 } }, [
        "/income 1000 Salary",
        "1000 Salary",
      ])

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        "warnings.noBalancesAdd"
      )
    })
  })

  describe("/querystats command", () => {
    beforeEach(() => {
      process.env.ADMIN_USERS = "123"
    })

    test("shows stats for admin user", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("querystats")
      )?.[1]

      await handler({ chat: { id: 123 } })

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        "Query Stats Report",
        expect.any(Object)
      )
    })

    test("denies access for non-admin user", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("querystats")
      )?.[1]

      await handler({ chat: { id: 999 } })

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        999,
        "errors.accessDenied"
      )
    })
  })

  describe("/resetquerystats command", () => {
    test("resets query stats", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("resetquerystats")
      )?.[1]

      await handler({ chat: { id: 123 } })

      expect(queryMonitor.reset).toHaveBeenCalled()
      expect(mockBot.sendMessage).toHaveBeenCalled()
    })
  })

  describe("/fxstats command", () => {
    beforeEach(() => {
      process.env.ADMIN_USERS = "123"
    })

    test("shows FX stats for admin user", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("fxstats")
      )?.[1]

      await handler({ chat: { id: 123 } })

      expect(mockBot.sendMessage).toHaveBeenCalled()
      const messageText = mockBot.sendMessage.mock.calls[0][1]
      expect(messageText).toContain("fxReport.title")
    })

    test("denies access for non-admin user", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("fxstats")
      )?.[1]

      await handler({ chat: { id: 999 } })

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        999,
        "errors.accessDenied"
      )
    })
  })

  describe("/fxreset command", () => {
    test("resets FX metrics", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("fxreset")
      )?.[1]

      await handler({ chat: { id: 123 } })

      expect(resetMetrics).toHaveBeenCalled()
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        "success.metricsReset",
        expect.any(Object)
      )
    })
  })

  describe("/fxclear command", () => {
    test("clears persisted cache", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("fxclear")
      )?.[1]

      await handler({ chat: { id: 123 } })

      expect(clearPersistedCache).toHaveBeenCalled()
      expect(mockBot.sendMessage).toHaveBeenCalled()
    })
  })

  describe("/search command", () => {
    test("shows usage when no args", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("search")
      )?.[1]

      await handler({ chat: { id: 123 } }, ["/search"])

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Usage:")
      )
    })

    test("shows validation errors for invalid filters", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("search")
      )?.[1]

      await handler({ chat: { id: 123 } }, ["/search --type=bad", "--type=bad"])

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Invalid filters"),
        expect.any(Object)
      )
    })

    test("calls db search and returns results", async () => {
      mockDbStorage.searchTransactions.mockResolvedValueOnce({
        transactions: [
          {
            id: "tx1",
            date: new Date("2026-01-01"),
            amount: 42,
            currency: "USD",
            type: TransactionType.EXPENSE,
            category: ExpenseCategory.FOOD_DINING,
            description: "coffee",
            fromAccountId: "Card",
            toAccountId: undefined,
          },
        ],
        total: 1,
        hasMore: false,
      })

      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("search")
      )?.[1]

      await handler({ chat: { id: 123 } }, [
        "/search coffee --type=EXPENSE --from-account=Card --to-account=Savings",
        "coffee --type=EXPENSE --from-account=Card --to-account=Savings",
      ])

      expect(mockDbStorage.searchTransactions).toHaveBeenCalledWith(
        "123",
        expect.objectContaining({
          query: "coffee",
          type: TransactionType.EXPENSE,
          fromAccountId: "Card",
          toAccountId: "Savings",
          page: 1,
          limit: 10,
        })
      )
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Search Results"),
        expect.any(Object)
      )
    })
  })

  describe("/chart command", () => {
    test("shows usage for invalid chart type", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("chart")
      )?.[1]

      await handler({ chat: { id: 123 } }, ["/chart wrong", "wrong"])

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Usage: /chart")
      )
    })

    test("shows validation for invalid months", async () => {
      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("chart")
      )?.[1]

      await handler({ chat: { id: 123 } }, ["/chart trends 99", "trends 99"])

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining("Months should be between")
      )
    })

    test("sends chart image document", async () => {
      const { generateChartImage } = jest.requireMock(
        "../../services/chart-service"
      ) as { generateChartImage: jest.Mock }
      generateChartImage.mockResolvedValueOnce(Buffer.from("png"))

      const handler = mockBot.on.mock.calls.find((call: any) =>
        (call[1].__pattern?.source || "").includes("chart")
      )?.[1]

      await handler({ chat: { id: 123 } }, ["/chart trends 6", "trends 6"])

      expect(generateChartImage).toHaveBeenCalledWith("123", "trends", "en", 6)
      expect(mockBot.sendDocument).toHaveBeenCalledWith(
        123,
        expect.any(Buffer),
        {},
        expect.objectContaining({
          filename: expect.stringContaining("chart_trends_6m"),
          contentType: "image/png",
        })
      )
    })
  })
})
