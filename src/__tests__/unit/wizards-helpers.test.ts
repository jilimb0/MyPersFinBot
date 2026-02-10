import type TelegramBot from "node-telegram-bot-api"
import { dbStorage } from "../../database/storage-db"
import * as handlers from "../../handlers"
import { t } from "../../i18n"
import * as menus from "../../menus-i18n"
import { resendCurrentStepPrompt } from "../../wizards/helpers"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn().mockResolvedValue("USD"),
    getCurrencyDenominations: jest.fn().mockReturnValue([10, 20, 50]),
    getUserData: jest.fn(),
    getCategoryBudgets: jest.fn(),
    getBalancesList: jest.fn(),
    getBalance: jest.fn(),
  },
}))

jest.mock("../../handlers", () => ({
  QuickActionsHandlers: {
    handleQuickCategory: jest.fn().mockResolvedValue(undefined),
  },
  handleTxAccount: jest.fn().mockResolvedValue(undefined),
  handleTxToAccount: jest.fn().mockResolvedValue(undefined),
  handleNotificationsMenu: jest.fn().mockResolvedValue(undefined),
  handleRecurringCreateStart: jest.fn().mockResolvedValue(undefined),
  handleRecurringSelect: jest.fn().mockResolvedValue(undefined),
  handleRecurringMenu: jest.fn().mockResolvedValue(undefined),
  handleRecurringItemAction: jest.fn().mockResolvedValue(undefined),
  handleRecurringDeleteConfirm: jest.fn().mockResolvedValue(undefined),
  handleRecurringDescription: jest.fn().mockResolvedValue(undefined),
  handleRecurringType: jest.fn().mockResolvedValue(undefined),
  handleRecurringAmount: jest.fn().mockResolvedValue(undefined),
  handleRecurringAccount: jest.fn().mockResolvedValue(undefined),
  handleRecurringCategory: jest.fn().mockResolvedValue(undefined),
  handleRecurringDay: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../menus-i18n", () => ({
  showActiveRemindersMenu: jest.fn().mockResolvedValue(undefined),
  showAnalyticsReportsMenu: jest.fn().mockResolvedValue(undefined),
  showBalancesMenu: jest.fn().mockResolvedValue(undefined),
  showBudgetMenu: jest.fn().mockResolvedValue(undefined),
  showHistoryMenu: jest.fn().mockResolvedValue(undefined),
  showIncomeSourcesMenu: jest.fn().mockResolvedValue(undefined),
  showMainMenu: jest.fn().mockResolvedValue(undefined),
}))

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("wizards/helpers resendCurrentStepPrompt", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("TX_AMOUNT and TX_CATEGORY and TX_ACCOUNT", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "TX_AMOUNT",
      txType: "EXPENSE",
      lang: "en",
    } as any)
    expect(bot.sendMessage).toHaveBeenCalled()

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "TX_CATEGORY",
      txType: "EXPENSE",
      lang: "en",
    } as any)
    expect(handlers.QuickActionsHandlers.handleQuickCategory).toHaveBeenCalled()

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "TX_ACCOUNT",
      txType: "EXPENSE",
      lang: "en",
    } as any)
    expect(handlers.handleTxAccount).toHaveBeenCalled()
  })

  test("TX_TO_ACCOUNT, TX_CONFIRM_REFUND", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "TX_TO_ACCOUNT",
      lang: "en",
    } as any)
    expect(handlers.handleTxToAccount).toHaveBeenCalled()

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "TX_CONFIRM_REFUND",
      lang: "en",
      data: { amount: 5, currency: "USD" },
    } as any)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("TX_VIEW_PERIOD and TX_VIEW_LIST", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "TX_VIEW_PERIOD",
      lang: "en",
    } as any)
    expect(bot.sendMessage).toHaveBeenCalled()

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "TX_VIEW_LIST",
      lang: "en",
      data: {
        transactions: [
          {
            type: "EXPENSE",
            amount: 10,
            currency: "USD",
            category: "FOOD_DINING",
          },
        ],
        period: "All",
      },
    } as any)
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("TX_EDIT_* branches", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    ;(dbStorage.getDefaultCurrency as jest.Mock).mockResolvedValue("USD")

    const tx = {
      type: "EXPENSE",
      amount: 10,
      currency: "USD",
      category: "FOOD_DINING",
      date: new Date().toISOString(),
      fromAccountId: "Cash",
    }

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "TX_EDIT_MENU",
      lang: "en",
      data: { transaction: tx },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "TX_EDIT_AMOUNT",
      lang: "en",
      data: { transaction: tx },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "TX_EDIT_CATEGORY",
      lang: "en",
      data: { transaction: tx },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "TX_EDIT_ACCOUNT",
      lang: "en",
      data: { transaction: tx },
    } as any)
  })

  test("Debt/Goal flows", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "DEBT_TYPE",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "DEBT_AMOUNT",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "DEBT_PARTIAL_AMOUNT",
      lang: "en",
      data: { debt: { name: "D", amount: 10, paidAmount: 2 } },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "DEBT_PARTIAL_ACCOUNT",
      lang: "en",
    } as any)
    ;(dbStorage.getUserData as jest.Mock).mockResolvedValue({
      debts: [{ name: "D", isPaid: false }],
    })

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "DEBT_EDIT_SELECT",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "DEBT_EDIT_AMOUNT",
      lang: "en",
      data: { debt: { amount: 10, paidAmount: 2, currency: "USD" } },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "DEBT_MENU",
      lang: "en",
      data: {
        debt: {
          amount: 10,
          paidAmount: 0,
          type: "I_OWE",
          name: "D",
          currency: "USD",
        },
      },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "DEBT_CREATE_DETAILS",
      lang: "en",
      data: { type: "I_OWE" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "GOAL_INPUT",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "GOAL_DEPOSIT_AMOUNT",
      lang: "en",
      data: { goal: { name: "G", targetAmount: 10, currentAmount: 1 } },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "GOAL_DEPOSIT_ACCOUNT",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "GOAL_MENU",
      lang: "en",
      data: { goal: { name: "G", targetAmount: 10, currentAmount: 1 } },
    } as any)
    ;(dbStorage.getUserData as jest.Mock).mockResolvedValueOnce({
      goals: [{ name: "G", status: "COMPLETED" }],
    })
    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "GOAL_COMPLETED_SELECT",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "GOAL_COMPLETED_DELETE",
      lang: "en",
      data: {
        goal: {
          name: "G",
          targetAmount: 10,
          currentAmount: 10,
          currency: "USD",
        },
      },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "GOAL_EDIT_AMOUNT",
      lang: "en",
      data: { goal: { targetAmount: 10, currency: "USD" } },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "GOAL_COMPLETE_CONFIRM",
      lang: "en",
      data: { goal: { currency: "USD" }, newTargetAmount: 10 },
    } as any)
  })

  test("Income/balance/history/analytics/notifications/recurring/default", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "INCOME_AMOUNT",
      lang: "en",
      data: { name: "Salary" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "INCOME_VIEW",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "INCOME_NAME",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "INCOME_DELETE",
      lang: "en",
      data: { name: "Salary" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "BALANCE_NAME",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "BALANCE_AMOUNT",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "BALANCE_DELETE_TRANSFER",
      lang: "en",
      data: { accountId: "Cash", currency: "USD", amount: 10 },
    } as any)
    ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValueOnce([
      { accountId: "Cash", currency: "USD" },
      { accountId: "Card", currency: "USD" },
    ])
    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "BALANCE_DELETE_SELECT_TARGET",
      lang: "en",
      data: { accountId: "Cash", currency: "USD", amount: 10 },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "BALANCE_EDIT_CURRENCY_CHOICE",
      lang: "en",
      data: {
        inputAmount: 10,
        inputCurrency: "USD",
        convertedAmount: 12,
        currency: "EUR",
      },
    } as any)
    ;(dbStorage.getBalance as jest.Mock).mockResolvedValueOnce({ amount: 5 })
    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "BALANCE_EDIT_MENU",
      lang: "en",
      data: { accountId: "Cash", currency: "USD" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "BALANCE_LIST",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "HISTORY_LIST",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "ANALYTICS_REPORTS_MENU",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "ANALYTICS_FILTERS",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "NOTIFICATIONS_MENU",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "NOTIFICATIONS_MANAGE_REMINDERS",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "BUDGET_MENU",
      lang: "en",
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "BUDGET_SELECT_CATEGORY",
      lang: "en",
    } as any)
    ;(dbStorage.getCategoryBudgets as jest.Mock).mockResolvedValueOnce({})
    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "BUDGET_CATEGORY_MENU",
      lang: "en",
      data: { category: "FOOD_DINING" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "RECURRING_MENU",
      lang: "en",
      data: { text: "💸 Rent" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "RECURRING_MENU",
      lang: "en",
      data: { text: "Other" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "RECURRING_MENU",
      lang: "en",
      data: { text: t("en", "buttons.addRecurring") },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "RECURRING_ITEM_MENU",
      lang: "en",
      data: { text: "x" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "RECURRING_DELETE_CONFIRM",
      lang: "en",
      data: { text: "x" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "RECURRING_CREATE_DESCRIPTION",
      lang: "en",
      data: { text: "x" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "RECURRING_CREATE_TYPE",
      lang: "en",
      data: { text: "x" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "RECURRING_CREATE_AMOUNT",
      lang: "en",
      data: { text: "x" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "RECURRING_CREATE_ACCOUNT",
      lang: "en",
      data: { text: "x" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "RECURRING_CREATE_CATEGORY",
      lang: "en",
      data: { text: "x" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "RECURRING_CREATE_DAY",
      lang: "en",
      data: { text: "x" },
    } as any)

    await resendCurrentStepPrompt(wizard, 1, "u1", {
      step: "UNKNOWN",
      lang: "en",
    } as any)

    expect(menus.showMainMenu).toHaveBeenCalled()
  })
})
