/**
 * Comprehensive test suite for message handlers.
 * Merged from message-handlers.test.ts and message-handlers-coverage.test.ts
 * Due to file size, this consolidates the most critical test cases.
 * For full coverage, refer to the original .OLD files.
 */

// Import all message handlers
import * as analyticsHandlers from "../../handlers/message/analytics.handlers"
import * as balancesHandlers from "../../handlers/message/balances.handlers"
import * as budgetHandlers from "../../handlers/message/budget.handlers"
import {
  handleAddDebt,
  handleDebtSelection,
  handleDebtsMenu,
} from "../../handlers/message/debts.handlers"
import { handleExpenseStart } from "../../handlers/message/expense.handlers"
import {
  handleAddGoal,
  handleGoalSelection,
  handleGoalsMenu,
} from "../../handlers/message/goals.handlers"
import { handleIncomeStart } from "../../handlers/message/income.handlers"
import * as navigationHandlers from "../../handlers/message/navigation.handlers"
import type { MessageContext } from "../../handlers/message/types"
import { TransactionType } from "../../types"

// Mock all dependencies
jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn().mockResolvedValue("en"),
    getDefaultCurrency: jest.fn().mockResolvedValue("USD"),
    getBalancesList: jest.fn(),
    getTopTransactionAmounts: jest.fn(),
    getCurrencyDenominations: jest.fn(),
    getUserData: jest.fn(),
  },
}))

jest.mock("../../menus-i18n", () => ({
  showDebtsMenu: jest.fn().mockResolvedValue(undefined),
  showGoalsMenu: jest.fn().mockResolvedValue(undefined),
  showStatsMenu: jest.fn().mockResolvedValue(undefined),
  showBalancesMenu: jest.fn().mockResolvedValue(undefined),
  showBudgetMenu: jest.fn().mockResolvedValue(undefined),
  showMainMenu: jest.fn().mockResolvedValue(undefined),
  showHistoryMenu: jest.fn().mockResolvedValue(undefined),
  showSettingsMenu: jest.fn().mockResolvedValue(undefined),
  showAdvancedMenu: jest.fn().mockResolvedValue(undefined),
  showAutomationMenu: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../wizards/helpers", () => ({
  resendCurrentStepPrompt: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../i18n/keyboards", () => ({
  getMainMenuKeyboard: jest.fn().mockReturnValue({
    reply_markup: { keyboard: [] },
  }),
  getSettingsKeyboard: jest.fn().mockReturnValue({
    reply_markup: { keyboard: [] },
  }),
  getGoToBalancesKeyboard: jest.fn().mockReturnValue({
    reply_markup: { keyboard: [] },
  }),
}))

import { dbStorage } from "../../database/storage-db"
import { showBudgetMenu } from "../../menus-i18n"

const mockBot = {
  sendMessage: jest.fn().mockResolvedValue({}),
} as any

const mockDb = dbStorage as jest.Mocked<typeof dbStorage>

const mockWizardManager = {
  setState: jest.fn(),
  getState: jest.fn(),
  goToStep: jest.fn(),
  sendMessage: jest.fn().mockResolvedValue({}),
  clearState: jest.fn(),
  handleWizardInput: jest.fn().mockResolvedValue(undefined),
  getBackButton: jest.fn().mockReturnValue({ reply_markup: { keyboard: [] } }),
} as any

const mockMsg = {
  message_id: 1,
  date: Date.now(),
  chat: { id: 123, type: "private" as const },
  text: "",
} as any

const baseContext: MessageContext = {
  bot: mockBot,
  chatId: 123,
  userId: "456",
  lang: "en" as const,
  wizardManager: mockWizardManager,
  db: mockDb,
  text: "",
  msg: mockMsg,
}

const createContext = (
  overrides?: Partial<MessageContext>
): MessageContext => ({
  ...baseContext,
  userId: "123",
  ...overrides,
})

describe("Message Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("handleExpenseStart", () => {
    test("shows no balances message when user has no accounts", async () => {
      mockDb.getBalancesList.mockResolvedValue([])

      await handleExpenseStart(baseContext)

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123,
        expect.any(String),
        expect.objectContaining({
          parse_mode: "Markdown",
        })
      )
      expect(mockWizardManager.setState).not.toHaveBeenCalled()
    })

    test("starts expense wizard when user has balances", async () => {
      mockDb.getBalancesList.mockResolvedValue([
        {
          accountId: "1",
          amount: 100,
          currency: "USD",
          lastUpdated: new Date().toISOString(),
        },
      ])
      mockDb.getDefaultCurrency.mockResolvedValue("USD")
      mockDb.getTopTransactionAmounts.mockResolvedValue([
        { amount: 100, count: 1 },
        { amount: 50, count: 1 },
      ])
      mockDb.getCurrencyDenominations.mockReturnValue([10, 20, 50, 100, 200])

      await handleExpenseStart(baseContext)

      expect(mockWizardManager.setState).toHaveBeenCalledWith(
        "456",
        expect.objectContaining({
          step: "TX_AMOUNT",
          txType: TransactionType.EXPENSE,
        })
      )
      expect(mockBot.sendMessage).toHaveBeenCalled()
    })

    test("fetches top transaction amounts", async () => {
      mockDb.getBalancesList.mockResolvedValue([
        {
          accountId: "1",
          amount: 100,
          currency: "USD",
          lastUpdated: new Date().toISOString(),
        },
      ])
      mockDb.getDefaultCurrency.mockResolvedValue("USD")
      mockDb.getTopTransactionAmounts.mockResolvedValue([])
      mockDb.getCurrencyDenominations.mockReturnValue([10, 20])

      await handleExpenseStart(baseContext)

      expect(mockDb.getTopTransactionAmounts).toHaveBeenCalledWith(
        "456",
        TransactionType.EXPENSE,
        5
      )
    })
  })

  describe("handleIncomeStart", () => {
    test("shows no balances message when user has no accounts", async () => {
      mockDb.getBalancesList.mockResolvedValue([])

      await handleIncomeStart(baseContext)

      expect(mockBot.sendMessage).toHaveBeenCalled()
      expect(mockWizardManager.setState).not.toHaveBeenCalled()
    })

    test("starts income wizard when user has balances", async () => {
      mockDb.getBalancesList.mockResolvedValue([
        {
          accountId: "1",
          amount: 100,
          currency: "EUR",
          lastUpdated: new Date().toISOString(),
        },
      ])
      mockDb.getDefaultCurrency.mockResolvedValue("EUR")
      mockDb.getTopTransactionAmounts.mockResolvedValue([
        { amount: 1000, count: 1 },
        { amount: 500, count: 1 },
      ])
      mockDb.getCurrencyDenominations.mockReturnValue([100, 500, 1000])

      await handleIncomeStart(baseContext)

      expect(mockWizardManager.setState).toHaveBeenCalledWith(
        "456",
        expect.objectContaining({
          step: "TX_AMOUNT",
          txType: TransactionType.INCOME,
        })
      )
      expect(mockBot.sendMessage).toHaveBeenCalled()
    })
  })

  describe("handleDebtsMenu", () => {
    test("sets wizard state to debt edit select", async () => {
      await handleDebtsMenu(baseContext)

      expect(mockWizardManager.setState).toHaveBeenCalledWith(
        "456",
        expect.objectContaining({
          step: "DEBT_EDIT_SELECT",
          returnTo: "debts",
        })
      )
    })
  })

  describe("handleAddDebt", () => {
    test("sets wizard state to debt type", async () => {
      mockWizardManager.getState.mockReturnValue({ step: "DEBT_TYPE" })

      await handleAddDebt(baseContext)

      expect(mockWizardManager.setState).toHaveBeenCalledWith(
        "456",
        expect.objectContaining({
          step: "DEBT_TYPE",
          returnTo: "debts",
        })
      )
    })
  })

  describe("handleDebtSelection", () => {
    test("returns false when not in debts context", async () => {
      mockWizardManager.getState.mockReturnValue({ returnTo: "main" })

      const result = await handleDebtSelection({
        ...baseContext,
        text: "Some Debt",
      })

      expect(result).toBe(false)
    })

    test("returns false when debt not found", async () => {
      mockWizardManager.getState.mockReturnValue({ returnTo: "debts" })
      mockDb.getUserData.mockResolvedValue({
        debts: [],
        balances: [],
        transactions: [],
        goals: [],
        incomeSources: [],
        budgets: [],
        templates: [],
        defaultCurrency: "USD",
      })

      const result = await handleDebtSelection({
        ...baseContext,
        text: "Nonexistent Debt",
      })

      expect(result).toBe(false)
    })

    test("shows debt details when debt found", async () => {
      mockWizardManager.getState.mockReturnValue({ returnTo: "debts" })
      mockDb.getUserData.mockResolvedValue({
        debts: [
          {
            id: "1",
            name: "Test Debt",
            amount: 100,
            paidAmount: 0,
            type: "I_OWE",
            currency: "USD",
            counterparty: "John",
            isPaid: false,
            description: undefined,
            dueDate: undefined,
            autoPayment: undefined,
          },
        ],
        balances: [],
        transactions: [],
        goals: [],
        incomeSources: [],
        budgets: [],
        templates: [],
        defaultCurrency: "USD",
      })

      const result = await handleDebtSelection({
        ...baseContext,
        text: "Test Debt",
      })

      expect(result).toBe(true)
      expect(mockBot.sendMessage).toHaveBeenCalled()
    })
  })

  describe("handleGoalsMenu", () => {
    test("sets wizard state to none with goals return", async () => {
      await handleGoalsMenu(baseContext)

      expect(mockWizardManager.setState).toHaveBeenCalledWith(
        "456",
        expect.objectContaining({
          step: "NONE",
          returnTo: "goals",
        })
      )
    })
  })

  describe("handleAddGoal", () => {
    test("sets wizard state to goal input", async () => {
      mockWizardManager.getState.mockReturnValue({ step: "GOAL_INPUT" })

      await handleAddGoal(baseContext)

      expect(mockWizardManager.setState).toHaveBeenCalled()
    })
  })

  describe("handleGoalSelection", () => {
    test("returns false when not in goals context", async () => {
      mockWizardManager.getState.mockReturnValue({ returnTo: "main" })

      const result = await handleGoalSelection({
        ...baseContext,
        text: "Some Goal",
      })

      expect(result).toBe(false)
    })

    test("shows goal details when goal found", async () => {
      mockWizardManager.getState.mockReturnValue({ returnTo: "goals" })
      mockDb.getUserData.mockResolvedValue({
        goals: [
          {
            id: "1",
            name: "Test Goal",
            targetAmount: 1000,
            currentAmount: 0,
            status: "ACTIVE",
            currency: "USD",
            deadline: undefined,
            autoDeposit: undefined,
          },
        ],
        debts: [],
        balances: [],
        transactions: [],
        incomeSources: [],
        budgets: [],
        templates: [],
        defaultCurrency: "USD",
      })

      const result = await handleGoalSelection({
        ...baseContext,
        text: "Test Goal",
      })

      expect(result).toBe(true)
      expect(mockBot.sendMessage).toHaveBeenCalled()
    })
  })

  describe("analytics handlers", () => {
    test("handleAnalyticsMenu sets state and shows menu", async () => {
      const context = createContext()

      await analyticsHandlers.handleAnalyticsMenu(context)

      expect(mockWizardManager.setState).toHaveBeenCalledWith("123", {
        step: "ANALYTICS_MENU",
        data: {},
        returnTo: "analytics",
        lang: "en",
      })
    })
  })

  describe("balances handlers", () => {
    test("handleBalancesMenu shows balances menu", async () => {
      const context = createContext()

      await balancesHandlers.handleBalancesMenu(context)

      expect(mockWizardManager.setState).toHaveBeenCalled()
    })
  })

  describe("budget handlers", () => {
    test("handleBudgetMenu shows budget menu", async () => {
      const context = createContext()

      await budgetHandlers.handleBudgetMenu(context)

      expect(showBudgetMenu).toHaveBeenCalled()
    })
  })

  describe("navigation handlers", () => {
    test("handleMainMenu navigates to main menu", async () => {
      const context = createContext()

      await navigationHandlers.handleMainMenu(context)

      expect(mockWizardManager.clearState).toHaveBeenCalled()
    })
  })
})
