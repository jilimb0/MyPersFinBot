import type TelegramBot from "@telegram-api"
import { dbStorage } from "../../database/storage-db"
import * as menus from "../../menus-i18n"
import { formatGoals, formatMonthlyStats } from "../../reports"
import { reminderManager } from "../../services/reminder-manager"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getBalances: jest.fn(),
    getBalancesList: jest.fn(),
    getUserData: jest.fn(),
    getIncomeSources: jest.fn(),
    getTransactionsPaginated: jest.fn(),
    getCategoryBudgets: jest.fn(),
    getDefaultCurrency: jest.fn(),
    getUserLanguage: jest.fn(),
  },
}))

jest.mock("../../reports", () => ({
  formatGoals: jest.fn(),
  formatMonthlyStats: jest.fn(),
}))

jest.mock("../../services/reminder-manager", () => ({
  reminderManager: {
    getUserReminders: jest.fn(),
  },
}))

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

function makeWizard(bot: TelegramBot) {
  return new WizardManager(bot)
}

describe("menus-i18n", () => {
  const lang = "en"

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("showBalancesMenu handles 2+ balances and 1 balance", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = makeWizard(bot)

    ;(dbStorage.getBalances as jest.Mock).mockResolvedValue("balances")
    ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValueOnce([
      { accountId: "Cash", currency: "USD" },
      { accountId: "Card", currency: "EUR" },
    ])

    await menus.showBalancesMenu(wizard, 1, "u1", lang)
    expect(wizard.getState("u1")?.step).toBe("BALANCE_LIST")
    ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValueOnce([
      { accountId: "Cash", currency: "USD" },
    ])

    await menus.showBalancesMenu(wizard, 1, "u1", lang)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showDebtsMenu renders empty and mixed debts", async () => {
    const bot = new MockBot() as unknown as TelegramBot

    ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
      defaultCurrency: "USD",
      debts: [],
    })

    await menus.showDebtsMenu(bot, 1, "u1", lang)
    ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
      defaultCurrency: "USD",
      debts: [
        {
          id: "d1",
          name: "Alice",
          type: "I_OWE",
          amount: 100,
          paidAmount: 20,
          currency: "USD",
        },
        {
          id: "d2",
          name: "Bob",
          type: "OWES_ME",
          amount: 200,
          paidAmount: 50,
          currency: "USD",
          dueDate: new Date().toISOString(),
        },
      ],
    })

    await menus.showDebtsMenu(bot, 1, "u1", lang)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showDebtsMenu covers netDebt > 0 (they owe more)", async () => {
    const bot = new MockBot() as unknown as TelegramBot

    ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
      defaultCurrency: "USD",
      debts: [
        {
          id: "d1",
          name: "Bob",
          type: "OWES_ME",
          amount: 500,
          paidAmount: 0,
          currency: "USD",
          isPaid: false,
        },
        {
          id: "d2",
          name: "Alice",
          type: "I_OWE",
          amount: 100,
          paidAmount: 0,
          currency: "USD",
          isPaid: false,
        },
      ],
    })

    await menus.showDebtsMenu(bot, 1, "u1", lang)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showDebtsMenu covers netDebt <= 0 (you owe more)", async () => {
    const bot = new MockBot() as unknown as TelegramBot

    ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
      defaultCurrency: "USD",
      debts: [
        {
          id: "d1",
          name: "Alice",
          type: "I_OWE",
          amount: 500,
          paidAmount: 0,
          currency: "USD",
          isPaid: false,
        },
        {
          id: "d2",
          name: "Bob",
          type: "OWES_ME",
          amount: 100,
          paidAmount: 0,
          currency: "USD",
          isPaid: false,
        },
      ],
    })

    await menus.showDebtsMenu(bot, 1, "u1", lang)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showGoalsMenu and showIncomeSourcesMenu", async () => {
    const bot = new MockBot() as unknown as TelegramBot

    ;(formatGoals as jest.Mock).mockResolvedValue("goals")
    ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
      goals: [
        { id: "g1", name: "Trip", status: "ACTIVE" },
        { id: "g2", name: "Done", status: "COMPLETED" },
      ],
      incomeSources: [{ id: "i1", name: "Salary" }],
    })

    await menus.showGoalsMenu(bot, 1, "u1", lang)
    ;(dbStorage.getIncomeSources as jest.Mock).mockResolvedValue("")
    ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
      incomeSources: [{ id: "i1", name: "Salary" }],
    })
    await menus.showIncomeSourcesMenu(bot, 1, "u1", lang)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showHistoryMenu covers empty, filtered, and paged", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = makeWizard(bot)

    ;(dbStorage.getTransactionsPaginated as jest.Mock).mockResolvedValueOnce({
      transactions: [],
      total: 0,
      hasMore: false,
    })

    await menus.showHistoryMenu(wizard, 1, "u1", lang, 1)

    wizard.setState("u1", {
      step: "HISTORY_FILTERED",
      data: {
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        filterType: "last7days",
      },
      lang: "en",
    })
    ;(dbStorage.getTransactionsPaginated as jest.Mock).mockResolvedValueOnce({
      transactions: [
        {
          type: "EXPENSE",
          date: new Date().toISOString(),
          amount: 10,
          currency: "USD",
          category: "FOOD_DINING",
          fromAccountId: "Cash",
        },
        {
          type: "INCOME",
          date: new Date().toISOString(),
          amount: 20,
          currency: "USD",
          category: "SALARY",
          toAccountId: "Card",
        },
        {
          type: "TRANSFER",
          date: new Date().toISOString(),
          amount: 30,
          currency: "USD",
          category: "TRANSFER",
          fromAccountId: "Cash",
        },
      ],
      total: 9,
      hasMore: true,
    })

    await menus.showHistoryMenu(wizard, 1, "u1", lang, 2)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showBudgetMenu covers empty and populated budgets", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = makeWizard(bot)

    ;(dbStorage.getCategoryBudgets as jest.Mock).mockResolvedValueOnce({})
    ;(dbStorage.getDefaultCurrency as jest.Mock).mockResolvedValueOnce("USD")

    await menus.showBudgetMenu(wizard, 1, "u1", lang)
    ;(dbStorage.getCategoryBudgets as jest.Mock).mockResolvedValueOnce({
      FOOD_DINING: { limit: 200, spent: 50, currency: "USD" },
      TRANSPORT: { limit: 0, spent: 0, currency: "USD" },
    })
    ;(dbStorage.getDefaultCurrency as jest.Mock).mockResolvedValueOnce("USD")

    await menus.showBudgetMenu(wizard, 1, "u1", lang)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showAnalyticsReportsMenu and showStatsMenu", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = makeWizard(bot)

    ;(formatMonthlyStats as jest.Mock).mockResolvedValue("stats")

    await menus.showAnalyticsReportsMenu(wizard, 1, "u1", lang)
    await menus.showStatsMenu(bot, 1, lang)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showNetWorthMenu variants", async () => {
    const bot = new MockBot() as unknown as TelegramBot

    const userData = {
      defaultCurrency: "USD",
      balances: [
        { accountId: "Cash", amount: 100, currency: "USD" },
        { accountId: "Card", amount: 50, currency: "USD" },
      ],
      debts: [
        {
          id: "d1",
          name: "Alice",
          type: "I_OWE",
          amount: 100,
          paidAmount: 20,
          currency: "USD",
        },
        {
          id: "d2",
          name: "Bob",
          type: "OWES_ME",
          amount: 200,
          paidAmount: 50,
          currency: "USD",
        },
      ],
    }

    ;(dbStorage.getUserData as jest.Mock).mockResolvedValue(userData)

    await menus.showNetWorthMenu(bot, 1, "u1", lang, "summary")
    await menus.showNetWorthMenu(bot, 1, "u1", lang, "assets")
    await menus.showNetWorthMenu(bot, 1, "u1", lang, "debts")
    await menus.showNetWorthMenu(bot, 1, "u1", lang, "full")

    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showActiveRemindersMenu covers debts, goals, and empty", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = makeWizard(bot)

    ;(reminderManager.getUserReminders as jest.Mock).mockResolvedValueOnce({
      debts: [
        {
          debt: { name: "Alice" },
          reminders: [
            { reminderDate: new Date().toISOString(), message: "Pay" },
          ],
        },
      ],
      goals: [],
    })

    await menus.showActiveRemindersMenu(wizard, 1, "u1", lang)
    ;(reminderManager.getUserReminders as jest.Mock).mockResolvedValueOnce({
      debts: [],
      goals: [
        {
          goal: { name: "Trip" },
          reminders: [
            { reminderDate: new Date().toISOString(), message: "Save" },
          ],
        },
      ],
    })

    await menus.showActiveRemindersMenu(wizard, 1, "u1", lang)
    ;(reminderManager.getUserReminders as jest.Mock).mockResolvedValueOnce({
      debts: [],
      goals: [],
    })

    await menus.showActiveRemindersMenu(wizard, 1, "u1", lang)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showAutomationMenu and showAdvancedMenu", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = makeWizard(bot)

    await menus.showAutomationMenu(wizard, 1, "u1", lang)
    await menus.showAdvancedMenu(wizard, 1, "u1", lang)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showSettingsMenu", async () => {
    const bot = new MockBot() as unknown as TelegramBot

    ;(dbStorage.getDefaultCurrency as jest.Mock).mockResolvedValue("USD")
    await menus.showSettingsMenu(bot, 1, "u1", lang)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showHistoryMenu with filters (startDate, endDate, type)", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = makeWizard(bot)

    wizard.setState("u1", {
      step: "HISTORY_FILTERED",
      data: {
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        type: "EXPENSE",
        filterType: "expenses",
      },
      lang: "en",
    })

    ;(dbStorage.getTransactionsPaginated as jest.Mock).mockResolvedValueOnce({
      transactions: [
        {
          type: "EXPENSE",
          date: new Date().toISOString(),
          amount: 50,
          currency: "USD",
          category: "FOOD_DINING",
          fromAccountId: "Card",
        },
      ],
      total: 1,
      hasMore: false,
    })

    await menus.showHistoryMenu(wizard, 1, "u1", lang, 1)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showHistoryMenu with empty filtered results", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = makeWizard(bot)

    wizard.setState("u1", {
      step: "HISTORY_FILTERED",
      data: {
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        filterType: "last7days",
      },
      lang: "en",
    })

    ;(dbStorage.getTransactionsPaginated as jest.Mock).mockResolvedValueOnce({
      transactions: [],
      total: 0,
      hasMore: false,
    })

    await menus.showHistoryMenu(wizard, 1, "u1", lang, 1)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showHistoryMenu with different filterTypes", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = makeWizard(bot)

    const filterTypes = [
      "last7days",
      "last30days",
      "expenses",
      "income",
      "unknown",
    ]

    for (const filterType of filterTypes) {
      wizard.setState("u1", {
        step: "HISTORY_FILTERED",
        data: {
          filterType,
        },
        lang: "en",
      })

      ;(dbStorage.getTransactionsPaginated as jest.Mock).mockResolvedValueOnce({
        transactions: [
          {
            type: "EXPENSE",
            date: new Date().toISOString(),
            amount: 50,
            currency: "USD",
            category: "FOOD_DINING",
            fromAccountId: "Card",
          },
        ],
        total: 1,
        hasMore: false,
      })

      await menus.showHistoryMenu(wizard, 1, "u1", lang, 1)
    }

    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showHistoryMenu with transactions without fromAccountId/toAccountId", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = makeWizard(bot)

    ;(dbStorage.getTransactionsPaginated as jest.Mock).mockResolvedValueOnce({
      transactions: [
        {
          type: "EXPENSE",
          date: new Date().toISOString(),
          amount: 50,
          currency: "USD",
          category: "FOOD_DINING",
          fromAccountId: null,
          toAccountId: null,
        },
      ],
      total: 1,
      hasMore: false,
    })

    await menus.showHistoryMenu(wizard, 1, "u1", lang, 1)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showBudgetMenu with totalLimit > 0", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = makeWizard(bot)

    ;(dbStorage.getCategoryBudgets as jest.Mock).mockResolvedValueOnce({
      FOOD_DINING: { limit: 200, spent: 50, currency: "USD" },
      TRANSPORT: { limit: 150, spent: 75, currency: "USD" },
    })
    ;(dbStorage.getDefaultCurrency as jest.Mock).mockResolvedValueOnce("USD")

    await menus.showBudgetMenu(wizard, 1, "u1", lang)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("showNetWorthMenu with debts having dueDate", async () => {
    const bot = new MockBot() as unknown as TelegramBot

    const userData = {
      defaultCurrency: "USD",
      balances: [{ accountId: "Cash", amount: 100, currency: "USD" }],
      debts: [
        {
          id: "d1",
          name: "Alice",
          type: "I_OWE",
          amount: 100,
          paidAmount: 20,
          currency: "USD",
          isPaid: false,
          dueDate: new Date().toISOString(),
        },
      ],
    }

    ;(dbStorage.getUserData as jest.Mock).mockResolvedValue(userData)

    await menus.showNetWorthMenu(bot, 1, "u1", lang, "debts")
    expect(bot.sendMessage).toHaveBeenCalled()
  })
})
