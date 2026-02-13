/**
 * Simple tests to cover switch case branches in wizards
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
  showMainMenu: jest.fn().mockResolvedValue({}),
  showDebtsMenu: jest.fn().mockResolvedValue({}),
  showGoalsMenu: jest.fn().mockResolvedValue({}),
  showBalancesMenu: jest.fn().mockResolvedValue({}),
  showIncomeSourcesMenu: jest.fn().mockResolvedValue({}),
  showStatsMenu: jest.fn().mockResolvedValue({}),
  showBudgetMenu: jest.fn().mockResolvedValue({}),
  showAnalyticsReportsMenu: jest.fn().mockResolvedValue({}),
  showAutomationMenu: jest.fn().mockResolvedValue({}),
  showAdvancedMenu: jest.fn().mockResolvedValue({}),
  showHistoryMenu: jest.fn().mockResolvedValue({}),
  showSettingsMenu: jest.fn().mockResolvedValue({}),
  showNetWorthMenu: jest.fn().mockResolvedValue({}),
}))

describe("WizardManager - Simple Switch Coverage", () => {
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
    ;(handlers.handleTxAmount as jest.Mock).mockResolvedValue(true)
    ;(handlers.handleTxCategory as jest.Mock).mockResolvedValue(true)
    ;(handlers.handleTxAccount as jest.Mock).mockResolvedValue(true)
    ;(handlers.handleTxToAccount as jest.Mock).mockResolvedValue(true)
  })

  describe("Transaction steps", () => {
    it("should handle TX_AMOUNT step", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      await wizard.handleWizardInput(chatId, userId, "100")

      expect(handlers.handleTxAmount).toHaveBeenCalled()
    })

    it("should handle TX_CATEGORY step", async () => {
      wizard.setState(userId, {
        step: "TX_CATEGORY",
        data: {},
        lang: "en",
      })

      await wizard.handleWizardInput(chatId, userId, "Food")

      expect(handlers.handleTxCategory).toHaveBeenCalled()
    })

    it("should handle TX_ACCOUNT step", async () => {
      wizard.setState(userId, {
        step: "TX_ACCOUNT",
        data: {},
        lang: "en",
      })

      await wizard.handleWizardInput(chatId, userId, "Cash")

      expect(handlers.handleTxAccount).toHaveBeenCalled()
    })

    it("should handle TX_TO_ACCOUNT step", async () => {
      wizard.setState(userId, {
        step: "TX_TO_ACCOUNT",
        data: {},
        lang: "en",
      })

      await wizard.handleWizardInput(chatId, userId, "Bank")

      expect(handlers.handleTxToAccount).toHaveBeenCalled()
    })
  })

  describe("History and filters", () => {
    it("should handle HISTORY_LIST step", async () => {
      wizard.setState(userId, {
        step: "HISTORY_LIST",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "test")

      expect(typeof result).toBe("boolean")
    })

    it("should handle TX_VIEW_PERIOD with last 7 days", async () => {
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

      expect(typeof result).toBe("boolean")
    })

    it("should handle TX_VIEW_PERIOD with expenses only", async () => {
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

      expect(typeof result).toBe("boolean")
    })
  })

  describe("Command handling", () => {
    it("should clear state and return false for /start", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "/start")

      expect(result).toBe(false)
      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should clear state and return true for other commands", async () => {
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

  describe("Back button handling", () => {
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

    it("should handle back with history", async () => {
      wizard.setState(userId, {
        step: "TX_CATEGORY",
        data: {},
        history: ["TX_AMOUNT"],
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "⬅️ Back")

      expect(result).toBe(true)
      const state = wizard.getState(userId)
      expect(state?.step).toBe("TX_AMOUNT")
    })
  })

  describe("Main menu button", () => {
    it("should clear state and show main menu", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "🏠 Main Menu"
      )

      expect(result).toBe(true)
      expect(wizard.getState(userId)).toBeUndefined()
    })
  })

  describe("Balances button", () => {
    it("should handle balances button", async () => {
      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "💰 Balances"
      )

      expect(typeof result).toBe("boolean")
    })
  })
})
