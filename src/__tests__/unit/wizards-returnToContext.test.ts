/**
 * Tests for returnToContext method to cover all return destinations
 */

import { dbStorage as db } from "../../database/storage-db"
import * as handlers from "../../handlers"
import {
  showAdvancedMenu,
  showAnalyticsReportsMenu,
  showAutomationMenu,
  showBalancesMenu,
  showBudgetMenu,
  showDebtsMenu,
  showGoalsMenu,
  showHistoryMenu,
  showIncomeSourcesMenu,
  showMainMenu,
  showSettingsMenu,
  showStatsMenu,
} from "../../menus-i18n"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db")
jest.mock("../../handlers")
jest.mock("../../menus-i18n")

describe("WizardManager - returnToContext Coverage", () => {
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
  })

  describe("returnToContext switch cases", () => {
    it("should return to debts menu", async () => {
      await wizard.returnToContext(chatId, userId, "debts")
      expect(showDebtsMenu).toHaveBeenCalledWith(bot, chatId, userId, "en")
    })

    it("should return to goals menu", async () => {
      await wizard.returnToContext(chatId, userId, "goals")
      expect(showGoalsMenu).toHaveBeenCalledWith(bot, chatId, userId, "en")
    })

    it("should return to balances menu", async () => {
      await wizard.returnToContext(chatId, userId, "balances")
      expect(showBalancesMenu).toHaveBeenCalledWith(
        wizard,
        chatId,
        userId,
        "en"
      )
    })

    it("should return to income menu", async () => {
      await wizard.returnToContext(chatId, userId, "income")
      expect(showIncomeSourcesMenu).toHaveBeenCalledWith(
        bot,
        chatId,
        userId,
        "en"
      )
    })

    it("should return to settings menu", async () => {
      await wizard.returnToContext(chatId, userId, "settings")
      expect(showSettingsMenu).toHaveBeenCalledWith(bot, chatId, userId, "en")
    })

    it("should return to history menu", async () => {
      await wizard.returnToContext(chatId, userId, "history")
      expect(showHistoryMenu).toHaveBeenCalledWith(wizard, chatId, userId, "en")
    })

    it("should return to analytics menu", async () => {
      await wizard.returnToContext(chatId, userId, "analytics")
      expect(showStatsMenu).toHaveBeenCalledWith(bot, chatId, "en")
    })

    it("should return to budgets menu", async () => {
      await wizard.returnToContext(chatId, userId, "budgets")
      expect(showBudgetMenu).toHaveBeenCalledWith(wizard, chatId, userId, "en")
    })

    it("should return to reports menu", async () => {
      await wizard.returnToContext(chatId, userId, "reports")
      expect(showAnalyticsReportsMenu).toHaveBeenCalledWith(
        wizard,
        chatId,
        userId,
        "en"
      )
    })

    it("should return to automation menu", async () => {
      await wizard.returnToContext(chatId, userId, "automation")
      expect(showAutomationMenu).toHaveBeenCalledWith(
        wizard,
        chatId,
        userId,
        "en"
      )
    })

    it("should return to advanced menu", async () => {
      await wizard.returnToContext(chatId, userId, "advanced")
      expect(showAdvancedMenu).toHaveBeenCalledWith(
        wizard,
        chatId,
        userId,
        "en"
      )
    })

    it("should return to recurring menu", async () => {
      ;(handlers.handleRecurringMenu as jest.Mock).mockResolvedValue(true)
      await wizard.returnToContext(chatId, userId, "recurring")
      expect(handlers.handleRecurringMenu).toHaveBeenCalledWith(
        wizard,
        chatId,
        userId,
        "en"
      )
    })

    it("should return to main menu by default", async () => {
      await wizard.returnToContext(chatId, userId, undefined)
      expect(showMainMenu).toHaveBeenCalledWith(bot, chatId, "en")
    })

    it("should return to main menu for unknown context", async () => {
      await wizard.returnToContext(chatId, userId, "unknown")
      expect(showMainMenu).toHaveBeenCalledWith(bot, chatId, "en")
    })

    it("should use state language when returning to context", async () => {
      wizard.setState(userId, {
        step: "TEST",
        lang: "ru",
      })

      ;(db.getUserLanguage as jest.Mock).mockResolvedValue("ru")

      await wizard.returnToContext(chatId, userId, "debts")

      // Uses the state language (ru) since it matches resolved language
      expect(showDebtsMenu).toHaveBeenCalledWith(bot, chatId, userId, "ru")
    })
  })

  describe("goToStep edge cases", () => {
    it("should create new state if none exists", async () => {
      expect(wizard.getState(userId)).toBeUndefined()

      await wizard.goToStep(userId, "TX_AMOUNT", { txType: "EXPENSE" })

      const state = wizard.getState(userId)
      expect(state).toBeDefined()
      expect(state?.step).toBe("TX_AMOUNT")
      expect(state?.data?.txType).toBe("EXPENSE")
      expect(state?.history).toEqual([])
    })

    it("should push current step to history when changing steps", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        history: [],
        lang: "en",
      })

      await wizard.goToStep(userId, "TX_CATEGORY", {})

      const state = wizard.getState(userId)
      expect(state?.step).toBe("TX_CATEGORY")
      expect(state?.history).toEqual(["TX_AMOUNT"])
    })

    it("should not push to history if step is the same", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        history: [],
        lang: "en",
      })

      await wizard.goToStep(userId, "TX_AMOUNT", {})

      const state = wizard.getState(userId)
      expect(state?.step).toBe("TX_AMOUNT")
      expect(state?.history).toEqual([])
    })

    it("should clear accountsShown when changing flow", async () => {
      wizard.setState(userId, {
        step: "TX_ACCOUNT",
        data: { accountsShown: true, topCategoriesShown: true },
        history: ["TX_AMOUNT"],
        lang: "en",
      })

      await wizard.goToStep(userId, "DEBT_MENU", {})

      const state = wizard.getState(userId)
      expect(state?.data?.accountsShown).toBeUndefined()
      expect(state?.data?.topCategoriesShown).toBeUndefined()
    })

    it("should preserve returnTo when transitioning steps", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        history: [],
        returnTo: "balances",
        lang: "en",
      })

      await wizard.goToStep(userId, "TX_CATEGORY", {})

      const state = wizard.getState(userId)
      expect(state?.returnTo).toBe("balances")
    })

    it("should merge data when provided", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: { amount: 100, currency: "USD" },
        history: [],
        lang: "en",
      })

      await wizard.goToStep(userId, "TX_CATEGORY", { category: "Food" })

      const state = wizard.getState(userId)
      expect(state?.data?.amount).toBe(100)
      expect(state?.data?.currency).toBe("USD")
      expect(state?.data?.category).toBe("Food")
    })

    it("should handle empty prevStep in history", async () => {
      wizard.setState(userId, {
        step: "TX_CATEGORY",
        data: { accountsShown: true },
        history: ["TX_AMOUNT", ""], // empty string in history
        lang: "en",
      })

      await wizard.goToStep(userId, "TX_ACCOUNT", {})

      const state = wizard.getState(userId)
      expect(state?.step).toBe("TX_ACCOUNT")
    })
  })

  describe("toTitleCase method", () => {
    it("should capitalize first letter", () => {
      const wizard = new WizardManager(bot)
      const result = (wizard as any).toTitleCase("test")
      expect(result).toBe("Test")
    })

    it("should handle empty string", () => {
      const wizard = new WizardManager(bot)
      const result = (wizard as any).toTitleCase("")
      expect(result).toBe("")
    })

    it("should handle whitespace", () => {
      const wizard = new WizardManager(bot)
      const result = (wizard as any).toTitleCase("   ")
      expect(result).toBe("")
    })

    it("should trim and capitalize", () => {
      const wizard = new WizardManager(bot)
      const result = (wizard as any).toTitleCase("  hello  ")
      expect(result).toBe("Hello")
    })
  })

  describe("resolveUserLang method", () => {
    it("should resolve user language", async () => {
      ;(db.getUserLanguage as jest.Mock).mockResolvedValue("ru")
      const result = await (wizard as any).resolveUserLang("user1")
      expect(result).toBe("ru")
    })

    it("should return en on error", async () => {
      ;(db.getUserLanguage as jest.Mock).mockRejectedValue(
        new Error("DB error")
      )
      const result = await (wizard as any).resolveUserLang("user1")
      expect(result).toBe("en")
    })
  })
})
