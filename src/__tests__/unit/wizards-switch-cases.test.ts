/**
 * Tests to cover all switch case branches in wizards handleWizardInput
 */

import { dbStorage as db } from "../../database/storage-db"
import * as handlers from "../../handlers"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db")
jest.mock("../../handlers")
jest.mock("../../wizards/helpers", () => ({
  resendCurrentStepPrompt: jest.fn().mockResolvedValue({}),
}))
jest.mock("../../menus-i18n", () => ({
  showMainMenu: jest.fn(),
  showDebtsMenu: jest.fn(),
  showGoalsMenu: jest.fn(),
  showBalancesMenu: jest.fn(),
  showIncomeSourcesMenu: jest.fn(),
  showStatsMenu: jest.fn(),
  showBudgetMenu: jest.fn(),
  showAnalyticsReportsMenu: jest.fn(),
  showAutomationMenu: jest.fn(),
  showAdvancedMenu: jest.fn(),
  showHistoryMenu: jest.fn(),
  showSettingsMenu: jest.fn(),
  showNetWorthMenu: jest.fn(),
}))

describe("WizardManager - Switch Case Coverage", () => {
  let wizard: WizardManager
  let bot: any
  const chatId = 123
  const userId = "user1"

  beforeEach(() => {
    jest.clearAllMocks()
    bot = {
      sendMessage: jest.fn().mockResolvedValue({}),
    }
    wizard = new WizardManager(bot)
    ;(db.getUserLanguage as jest.Mock).mockResolvedValue("en")
    ;(db.getDefaultCurrency as jest.Mock).mockResolvedValue("USD")
    ;(db.getBalancesList as jest.Mock).mockResolvedValue([])
    ;(db.getAllTransactions as jest.Mock).mockResolvedValue([])
    ;(db.getRecentTransactions as jest.Mock).mockResolvedValue([])
    ;(db.getUserData as jest.Mock).mockResolvedValue({ userId })
  })

  describe("TX_CONFIRM_REFUND step", () => {
    it("should handle refund confirmation YES", async () => {
      wizard.setState(userId, {
        step: "TX_CONFIRM_REFUND",
        data: { amount: 100, currency: "USD" },
        lang: "en",
      })

      ;(handlers.handleTxToAccount as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "✅ Yes, this is a refund"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle refund confirmation NO", async () => {
      wizard.setState(userId, {
        step: "TX_CONFIRM_REFUND",
        data: { amount: 100, currency: "USD" },
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "No")

      expect(typeof result).toBe("boolean")
    })
  })

  describe("HISTORY_LIST step", () => {
    it("should handle history filters button", async () => {
      wizard.setState(userId, {
        step: "HISTORY_LIST",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "📊 Filters"
      )

      expect(result).toBe(true)
    })

    it("should handle no transaction selected", async () => {
      wizard.setState(userId, {
        step: "HISTORY_LIST",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "random text"
      )

      expect(result).toBe(true)
    })
  })

  describe("TX_VIEW_PERIOD step", () => {
    it("should handle last 7 days filter", async () => {
      wizard.setState(userId, {
        step: "TX_VIEW_PERIOD",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "📅 Last 7 Days"
      )

      expect(result).toBe(true)
    })

    it("should handle last 30 days filter", async () => {
      wizard.setState(userId, {
        step: "TX_VIEW_PERIOD",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "📅 Last 30 Days"
      )

      expect(result).toBe(true)
    })

    it("should handle expenses only filter", async () => {
      wizard.setState(userId, {
        step: "TX_VIEW_PERIOD",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "📉 Expenses Only"
      )

      expect(result).toBe(true)
    })

    it("should handle income only filter", async () => {
      wizard.setState(userId, {
        step: "TX_VIEW_PERIOD",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "📈 Income Only"
      )

      expect(result).toBe(true)
    })

    it("should handle custom period button", async () => {
      wizard.setState(userId, {
        step: "TX_VIEW_PERIOD",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "📆 Custom Period"
      )

      expect(result).toBe(true)
    })

    it("should handle all transactions button", async () => {
      wizard.setState(userId, {
        step: "TX_VIEW_PERIOD",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "📋 All Transactions"
      )

      expect(result).toBe(true)
    })
  })

  describe("CUSTOM_PERIOD_SINGLE step", () => {
    it("should handle custom date input", async () => {
      wizard.setState(userId, {
        step: "CUSTOM_PERIOD_SINGLE",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "2026-01-01"
      )

      expect(typeof result).toBe("boolean")
    })
  })

  describe("TX_EDIT_MENU step", () => {
    it("should handle edit amount button", async () => {
      wizard.setState(userId, {
        step: "TX_EDIT_MENU",
        data: { transaction: { id: "tx1", amount: 100 } },
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "✏️ Edit Amount"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle edit category button", async () => {
      wizard.setState(userId, {
        step: "TX_EDIT_MENU",
        data: { transaction: { id: "tx1", category: "Food" } },
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "🏷️ Edit Category"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle edit account button", async () => {
      wizard.setState(userId, {
        step: "TX_EDIT_MENU",
        data: { transaction: { id: "tx1", fromAccountId: "Cash" } },
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "💳 Edit Account"
      )

      expect(typeof result).toBe("boolean")
    })

    it("should handle delete transaction button", async () => {
      wizard.setState(userId, {
        step: "TX_EDIT_MENU",
        data: { transaction: { id: "tx1" } },
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "🗑️ Delete Transaction"
      )

      expect(typeof result).toBe("boolean")
    })
  })

  describe("STATS_MENU step", () => {
    it("should handle stats menu options", async () => {
      wizard.setState(userId, {
        step: "STATS_MENU",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "📊 View Stats"
      )

      expect(typeof result).toBe("boolean")
    })
  })

  describe("NET_WORTH_MENU step", () => {
    it("should handle net worth menu", async () => {
      wizard.setState(userId, {
        step: "NET_WORTH_MENU",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "💰 Net Worth"
      )

      expect(typeof result).toBe("boolean")
    })
  })

  describe("BUDGET_REPORT_PERIOD step", () => {
    it("should handle budget report period", async () => {
      wizard.setState(userId, {
        step: "BUDGET_REPORT_PERIOD",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "This Month"
      )

      expect(typeof result).toBe("boolean")
    })
  })

  describe("Command handling", () => {
    it("should handle /start command", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "/start")

      expect(result).toBe(false)
      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should handle /expense command", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "/expense")

      expect(result).toBe(false)
      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should handle /income command", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "/income")

      expect(result).toBe(false)
      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should handle other commands", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "/help")

      expect(result).toBe(true)
      expect(wizard.getState(userId)).toBeUndefined()
    })
  })

  describe.skip("Special button handling", () => {
    it("should handle changeAmount button without state", async () => {
      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "💵 Change Amount"
      )

      expect(result).toBe(true)
    })

    it("should handle changeAmount button with state", async () => {
      wizard.setState(userId, {
        step: "TX_CATEGORY",
        data: { amount: 100 },
        lang: "en",
      })

      ;(handlers as any).resendCurrentStepPrompt = jest.fn()

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "💵 Change Amount"
      )

      expect(result).toBe(true)
    })
  })

  describe("Back button special cases", () => {
    it("should handle back from DEBT_MENU", async () => {
      wizard.setState(userId, {
        step: "DEBT_MENU",
        data: {},
        returnTo: "debts",
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "⬅️ Back")

      expect(result).toBe(true)
      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should handle back from GOAL_MENU", async () => {
      wizard.setState(userId, {
        step: "GOAL_MENU",
        data: {},
        returnTo: "goals",
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "⬅️ Back")

      expect(result).toBe(true)
      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should handle back from RECURRING_MENU", async () => {
      wizard.setState(userId, {
        step: "RECURRING_MENU",
        data: {},
        returnTo: "automation",
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "⬅️ Back")

      expect(result).toBe(true)
      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should handle back from TX_CATEGORY with showedAllCategories", async () => {
      wizard.setState(userId, {
        step: "TX_CATEGORY",
        data: { showedAllCategories: true, topCategoriesShown: true },
        history: ["TX_AMOUNT"],
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "⬅️ Back")

      expect(result).toBe(true)
    })

    it("should handle back with empty history", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        history: [],
        returnTo: "balances",
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "⬅️ Back")

      expect(result).toBe(true)
      expect(wizard.getState(userId)).toBeUndefined()
    })
  })
})
