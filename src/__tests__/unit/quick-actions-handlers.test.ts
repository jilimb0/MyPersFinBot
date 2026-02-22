import type { BotClient } from "@jilimb0/tgwrapper"
import { QuickActionsHandlers } from "../../handlers/quick-actions-handlers"
import { t } from "../../i18n"
import { TransactionType } from "../../types"

jest.mock("../../i18n", () => ({
  ...jest.requireActual("../../i18n"),
  t: jest.fn((_lang, key) => {
    if (key === "transactions.moreCategories") return "More categories"
    if (key === "transactions.selectCategory") return "Select category"
    return key
  }),
  resolveLanguage: jest.fn(() => "en"),
  getExpenseCategoryLabel: jest.fn((_lang, cat) => cat),
  getIncomeCategoryLabel: jest.fn((_lang, cat) => cat),
}))

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn().mockResolvedValue("en"),
    getTopCategories: jest.fn(),
    getBalancesList: jest.fn(),
    addTransaction: jest.fn(),
    setCategoryPreferredAccount: jest.fn(),
    getSmartBalanceSelection: jest.fn(),
    getAllTransactions: jest.fn(),
    getDefaultCurrency: jest.fn().mockResolvedValue("USD"),
  },
}))

const { dbStorage } = jest.requireMock("../../database/storage-db")

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
  answerCallbackQuery = jest.fn().mockResolvedValue(true)
  editMessageText = jest.fn().mockResolvedValue({})
}

/**
 * Comprehensive test suite for quick actions handlers.
 * Merged from quick-actions-handlers.test.ts and quick-actions-coverage.test.ts
 * All duplicate tests have been removed.
 */
describe("Quick Actions Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("handleQuickCategory", () => {
    test("initial top categories flow", async () => {
      dbStorage.getTopCategories.mockResolvedValue(["FOOD_DINING"])
      const bot = new MockBot() as unknown as BotClient
      const state: any = {
        lang: "en",
        txType: TransactionType.EXPENSE,
        data: {},
      }
      const result = await QuickActionsHandlers.handleQuickCategory(
        bot,
        1,
        "u1",
        "text",
        state
      )
      expect(result.handled).toBe(true)
      expect(state.data.topCategoriesShown).toBe(true)
    })

    test("shows top categories on first call", async () => {
      const bot = new MockBot() as unknown as BotClient
      const state: any = {
        step: "TRANSACTION_CATEGORY" as const,
        txType: TransactionType.EXPENSE,
        data: {},
        lang: "en" as const,
      }

      const result = await QuickActionsHandlers.handleQuickCategory(
        bot,
        123,
        "123",
        "Food",
        state
      )

      expect(result.handled).toBe(true)
      expect(bot.sendMessage).toHaveBeenCalled()
      expect(state.data.topCategoriesShown).toBe(true)
    })

    test("more categories button", async () => {
      const bot = new MockBot() as unknown as BotClient
      const state: any = {
        lang: "en",
        txType: TransactionType.EXPENSE,
        data: { topCategoriesShown: true },
      }
      const result = await QuickActionsHandlers.handleQuickCategory(
        bot,
        1,
        "u1",
        t("en", "transactions.moreCategories"),
        state
      )
      expect(result.showAllCategories).toBe(true)
    })

    test("handles 'more categories' selection", async () => {
      const bot = new MockBot() as unknown as BotClient
      const state: any = {
        step: "TRANSACTION_CATEGORY" as const,
        txType: TransactionType.INCOME,
        data: { topCategoriesShown: true },
        lang: "en" as const,
      }

      const result = await QuickActionsHandlers.handleQuickCategory(
        bot,
        123,
        "123",
        "More categories",
        state
      )

      expect(result.handled).toBe(true)
      expect(result.showAllCategories).toBe(true)
    })
  })

  describe("handleQuickAccount", () => {
    test("income with multiple balances returns false", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "A", amount: 1, currency: "USD" },
        { accountId: "B", amount: 1, currency: "USD" },
      ])
      const bot = new MockBot() as unknown as BotClient
      const state: any = {
        lang: "en",
        txType: TransactionType.INCOME,
        data: { amount: 10, currency: "USD", category: "SALARY" },
      }
      const result = await QuickActionsHandlers.handleQuickAccount(
        bot,
        1,
        "u1",
        state,
        jest.fn()
      )
      expect(result).toBe(false)
    })

    test("expense single eligible balance mismatch currency", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 10, currency: "EUR" },
      ])
      const bot = new MockBot() as unknown as BotClient
      const state: any = {
        lang: "en",
        txType: TransactionType.EXPENSE,
        data: { amount: 5, currency: "USD", category: "FOOD_DINING" },
      }
      const result = await QuickActionsHandlers.handleQuickAccount(
        bot,
        1,
        "u1",
        state,
        jest.fn()
      )
      expect(result).toBe(true)
    })

    test("expense single eligible insufficient funds", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 1, currency: "USD" },
      ])
      const bot = new MockBot() as unknown as BotClient
      const state: any = {
        lang: "en",
        txType: TransactionType.EXPENSE,
        data: { amount: 5, currency: "USD", category: "FOOD_DINING" },
      }
      const result = await QuickActionsHandlers.handleQuickAccount(
        bot,
        1,
        "u1",
        state,
        jest.fn()
      )
      expect(result).toBe(true)
    })

    test("expense single eligible success", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 10, currency: "USD" },
      ])
      const bot = new MockBot() as unknown as BotClient
      const clear = jest.fn()
      const state: any = {
        lang: "en",
        txType: TransactionType.EXPENSE,
        data: { amount: 5, currency: "USD", category: "FOOD_DINING" },
      }
      const result = await QuickActionsHandlers.handleQuickAccount(
        bot,
        1,
        "u1",
        state,
        clear
      )
      expect(result).toBe(true)
      expect(dbStorage.addTransaction).toHaveBeenCalled()
      expect(clear).toHaveBeenCalled()
    })

    test("handles single account for expense", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "acc1", amount: 100, currency: "USD" },
      ])
      dbStorage.getSmartBalanceSelection.mockResolvedValue("acc1")

      const bot = new MockBot() as unknown as BotClient
      const mockClearState = jest.fn()
      const state: any = {
        step: "TRANSACTION_ACCOUNT" as const,
        txType: TransactionType.EXPENSE,
        data: { amount: 50, category: "Food", currency: "USD" },
        lang: "en" as const,
      }

      const result = await QuickActionsHandlers.handleQuickAccount(
        bot,
        123,
        "123",
        state,
        mockClearState
      )

      expect(result).toBe(true)
      expect(dbStorage.addTransaction).toHaveBeenCalled()
    })

    test("no eligible balances", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 0, currency: "USD" },
      ])
      const bot = new MockBot() as unknown as BotClient
      const state: any = {
        lang: "en",
        txType: TransactionType.EXPENSE,
        data: { amount: 5, currency: "USD", category: "FOOD_DINING" },
      }
      const result = await QuickActionsHandlers.handleQuickAccount(
        bot,
        1,
        "u1",
        state,
        jest.fn()
      )
      expect(result).toBe(true)
    })

    test("handles no eligible accounts", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "acc1", amount: 10, currency: "USD" },
      ])

      const bot = new MockBot() as unknown as BotClient
      const mockClearState = jest.fn()
      const state: any = {
        step: "TRANSACTION_ACCOUNT" as const,
        txType: TransactionType.EXPENSE,
        data: { amount: 50, category: "Food", currency: "USD" },
        lang: "en" as const,
      }

      const result = await QuickActionsHandlers.handleQuickAccount(
        bot,
        123,
        "123",
        state,
        mockClearState
      )

      expect(result).toBe(true)
      expect(bot.sendMessage).toHaveBeenCalled()
    })

    test("smart account not found returns false", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 10, currency: "USD" },
      ])
      dbStorage.getSmartBalanceSelection.mockResolvedValue("Card")
      const bot = new MockBot() as unknown as BotClient
      const state: any = {
        lang: "en",
        txType: TransactionType.INCOME,
        data: { amount: 5, currency: "USD", category: "SALARY" },
      }
      const result = await QuickActionsHandlers.handleQuickAccount(
        bot,
        1,
        "u1",
        state,
        jest.fn()
      )
      expect(result).toBe(false)
    })

    test("smart account mismatch with single balance returns true", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 10, currency: "EUR" },
      ])
      dbStorage.getSmartBalanceSelection.mockResolvedValue("Cash")
      const bot = new MockBot() as unknown as BotClient
      const state: any = {
        lang: "en",
        txType: TransactionType.EXPENSE,
        data: { amount: 5, currency: "USD", category: "FOOD_DINING" },
      }
      const result = await QuickActionsHandlers.handleQuickAccount(
        bot,
        1,
        "u1",
        state,
        jest.fn()
      )
      expect(result).toBe(true)
    })

    test("smart account insufficient funds multi-balance returns false", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 1, currency: "USD" },
        { accountId: "Card", amount: 1, currency: "USD" },
      ])
      dbStorage.getSmartBalanceSelection.mockResolvedValue("Cash")
      const bot = new MockBot() as unknown as BotClient
      const state: any = {
        lang: "en",
        txType: TransactionType.EXPENSE,
        data: { amount: 5, currency: "USD", category: "FOOD_DINING" },
      }
      const result = await QuickActionsHandlers.handleQuickAccount(
        bot,
        1,
        "u1",
        state,
        jest.fn()
      )
      expect(result).toBe(false)
    })

    test("smart account success", async () => {
      dbStorage.getBalancesList.mockResolvedValue([
        { accountId: "Cash", amount: 10, currency: "USD" },
      ])
      dbStorage.getSmartBalanceSelection.mockResolvedValue("Cash")
      const bot = new MockBot() as unknown as BotClient
      const clear = jest.fn()
      const state: any = {
        lang: "en",
        txType: TransactionType.EXPENSE,
        data: { amount: 5, currency: "USD", category: "FOOD_DINING" },
      }
      const result = await QuickActionsHandlers.handleQuickAccount(
        bot,
        1,
        "u1",
        state,
        clear
      )
      expect(result).toBe(true)
      expect(dbStorage.addTransaction).toHaveBeenCalled()
      expect(clear).toHaveBeenCalled()
    })
  })

  describe("showAllCategories", () => {
    test("shows all expense categories", async () => {
      const bot = new MockBot() as unknown as BotClient
      await QuickActionsHandlers.showAllCategories(
        bot,
        123,
        TransactionType.EXPENSE,
        "en"
      )

      expect(bot.sendMessage).toHaveBeenCalled()
    })

    test("shows all income categories", async () => {
      const bot = new MockBot() as unknown as BotClient
      await QuickActionsHandlers.showAllCategories(
        bot,
        123,
        TransactionType.INCOME,
        "en"
      )

      expect(bot.sendMessage).toHaveBeenCalled()
    })
  })

  describe("getLastUsedAccount", () => {
    test("returns last account or null", async () => {
      dbStorage.getAllTransactions.mockResolvedValue([
        { date: "2026-01-01", category: "FOOD", fromAccountId: "A" },
        { date: "2026-02-01", category: "FOOD", toAccountId: "B" },
      ])
      const result = await QuickActionsHandlers.getLastUsedAccount("u1", "FOOD")
      expect(result).toBe("B")

      dbStorage.getAllTransactions.mockResolvedValue([])
      const none = await QuickActionsHandlers.getLastUsedAccount("u1", "FOOD")
      expect(none).toBeNull()
    })

    test("returns null when no transactions exist", async () => {
      dbStorage.getAllTransactions.mockResolvedValue([])

      const result = await QuickActionsHandlers.getLastUsedAccount(
        "123",
        "Food"
      )

      expect(result).toBeNull()
    })
  })
})
