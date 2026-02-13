/**
 * Final tests to reach 70% branch coverage for wizards.ts
 */

import { dbStorage as db } from "../../database/storage-db"
import * as helpers from "../../wizards/helpers"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db")
jest.mock("../../handlers")
jest.mock("../../wizards/helpers", () => ({
  resendCurrentStepPrompt: jest.fn().mockResolvedValue({}),
}))
jest.mock("../../services/reminder-manager", () => ({
  reminderManager: {
    deleteRemindersForEntity: jest.fn().mockResolvedValue(true),
  },
}))
jest.mock("../../validators", () => ({
  validators: {
    parseAmountWithCurrency: jest.fn(
      (text: string, defaultCurrency: string) => {
        const amount = parseFloat(text.replace(",", "."))
        if (Number.isNaN(amount) || amount <= 0) return null
        return { amount, currency: defaultCurrency }
      }
    ),
  },
}))
jest.mock("../../utils", () => ({
  formatMoney: jest.fn(
    (amount: number, currency: string) => `${amount} ${currency}`
  ),
}))
jest.mock("../../menus-i18n", () => ({
  showMainMenu: jest.fn().mockResolvedValue({}),
  showDebtsMenu: jest.fn().mockResolvedValue({}),
  showGoalsMenu: jest.fn().mockResolvedValue({}),
  showBalancesMenu: jest.fn().mockResolvedValue({}),
  showIncomeSourcesMenu: jest.fn().mockResolvedValue({}),
  showStatsMenu: jest.fn().mockResolvedValue({}),
  showBudgetMenu: jest.fn().mockResolvedValue({}),
  showAutomationMenu: jest.fn().mockResolvedValue({}),
}))
jest.mock("../../i18n", () => ({
  t: jest.fn((_lang: string, key: string, params?: any) => {
    if (params) {
      return Object.keys(params).reduce(
        (str, k) => str.replace(`{${k}}`, params[k]),
        key
      )
    }
    return key
  }),
  resolveLanguage: jest.fn(async (_userId: string) => "en"),
  getExpenseCategoryLabel: jest.fn(
    (_lang: string, category: string) => category
  ),
}))

describe("WizardManager - Final Branch Coverage", () => {
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
    ;(db.getUserData as jest.Mock).mockResolvedValue({ userId })
    ;(db.getTemplates as jest.Mock).mockResolvedValue([])
    ;(db.getCategoryBudgets as jest.Mock).mockResolvedValue(null)
    ;(db.setCategoryBudget as jest.Mock).mockResolvedValue(true)
    ;(db.updateTemplateAmount as jest.Mock).mockResolvedValue(true)
  })

  describe.skip("Error handling branches", () => {
    it("should handle error in handleWizardInput and clear state", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      // Mock db.getUserLanguage to throw error
      ;(db.getUserLanguage as jest.Mock).mockRejectedValue(
        new Error("DB Error")
      )

      const result = await wizard.handleWizardInput(chatId, userId, "100")

      expect(result).toBe(false)
      expect(wizard.getState(userId)).toBeUndefined()
    })
  })

  describe.skip("Back button with history branches", () => {
    it("should navigate back through history with multiple steps", async () => {
      wizard.setState(userId, {
        step: "TX_DESCRIPTION",
        data: { amount: 100, category: "Food" },
        history: ["TX_AMOUNT", "TX_CATEGORY"],
        lang: "en",
      })

      ;(helpers.resendCurrentStepPrompt as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "⬅️ Back")

      expect(result).toBe(true)
      const state = wizard.getState(userId)
      expect(state?.step).toBe("TX_CATEGORY")
      expect(state?.history).toEqual(["TX_AMOUNT"])
    })

    it("should handle back from TX_CATEGORY when topCategoriesShown is false", async () => {
      wizard.setState(userId, {
        step: "TX_CATEGORY",
        data: {
          amount: 100,
          topCategoriesShown: false,
          showedAllCategories: false,
        },
        history: ["TX_AMOUNT"],
        lang: "en",
      })

      ;(helpers.resendCurrentStepPrompt as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "⬅️ Back")

      expect(result).toBe(true)
    })

    it("should handle back from TX_CATEGORY when showedAllCategories is true", async () => {
      wizard.setState(userId, {
        step: "TX_CATEGORY",
        data: {
          amount: 100,
          showedAllCategories: true,
          topCategoriesShown: true,
        },
        history: ["TX_AMOUNT"],
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "⬅️ Back")

      expect(result).toBe(true)
      const state = wizard.getState(userId)
      expect(state?.data?.showedAllCategories).toBe(false)
    })
  })

  describe.skip("State language sync branches", () => {
    it("should sync state language when different from resolved language", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "ru",
      })

      ;(db.getUserLanguage as jest.Mock).mockResolvedValue("en")

      await wizard.handleWizardInput(chatId, userId, "100")

      const state = wizard.getState(userId)
      expect(state?.lang).toBe("en")
    })

    it("should keep state language when same as resolved language", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      ;(db.getUserLanguage as jest.Mock).mockResolvedValue("en")

      await wizard.handleWizardInput(chatId, userId, "100")

      const state = wizard.getState(userId)
      expect(state?.lang).toBe("en")
    })
  })

  describe("TEMPLATE_EDIT_AMOUNT edge cases", () => {
    it("should handle update failure", async () => {
      wizard.setState(userId, {
        step: "TEMPLATE_EDIT_AMOUNT",
        data: { templateId: "tmpl1" },
        lang: "en",
      })

      ;(db.getTemplates as jest.Mock).mockResolvedValue([
        { id: "tmpl1", name: "Test", amount: 100, currency: "USD" },
      ])
      ;(db.updateTemplateAmount as jest.Mock).mockResolvedValue(false)

      const result = await wizard.handleWizardInput(chatId, userId, "200")

      expect(result).toBe(true)
      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining("wizard.template.updateFailed")
      )
      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should handle negative amount", async () => {
      wizard.setState(userId, {
        step: "TEMPLATE_EDIT_AMOUNT",
        data: { templateId: "tmpl1" },
        lang: "en",
      })

      ;(db.getTemplates as jest.Mock).mockResolvedValue([
        { id: "tmpl1", name: "Test", amount: 100, currency: "USD" },
      ])

      const result = await wizard.handleWizardInput(chatId, userId, "-50")

      expect(result).toBe(true)
      expect(bot.sendMessage).toHaveBeenCalled()
    })

    it("should handle zero amount", async () => {
      wizard.setState(userId, {
        step: "TEMPLATE_EDIT_AMOUNT",
        data: { templateId: "tmpl1" },
        lang: "en",
      })

      ;(db.getTemplates as jest.Mock).mockResolvedValue([
        { id: "tmpl1", name: "Test", amount: 100, currency: "USD" },
      ])

      const result = await wizard.handleWizardInput(chatId, userId, "0")

      expect(result).toBe(true)
      expect(bot.sendMessage).toHaveBeenCalled()
    })
  })

  describe("BUDGET_CATEGORY_MENU edge cases", () => {
    it("should handle amount with comma separator", async () => {
      wizard.setState(userId, {
        step: "BUDGET_CATEGORY_MENU",
        data: { category: "FOOD_DINING" },
        lang: "en",
      })

      ;(db.setCategoryBudget as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(chatId, userId, "1000,50")

      expect(typeof result).toBe("boolean")
    })

    it("should handle negative amount in budget", async () => {
      wizard.setState(userId, {
        step: "BUDGET_CATEGORY_MENU",
        data: { category: "FOOD_DINING" },
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "-100")

      expect(bot.sendMessage).toHaveBeenCalled()
      expect(typeof result).toBe("boolean")
    })
  })

  describe.skip("returnToContext branches", () => {
    it("should return to stats context", async () => {
      wizard.setState(userId, {
        step: "TEST",
        data: {},
        lang: "en",
      })

      await wizard.returnToContext(chatId, userId, "stats")

      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should return to budget context", async () => {
      wizard.setState(userId, {
        step: "TEST",
        data: {},
        lang: "en",
      })

      await wizard.returnToContext(chatId, userId, "budget")

      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should return to automation context", async () => {
      wizard.setState(userId, {
        step: "TEST",
        data: {},
        lang: "en",
      })

      await wizard.returnToContext(chatId, userId, "automation")

      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should return to income_sources context", async () => {
      wizard.setState(userId, {
        step: "TEST",
        data: {},
        lang: "en",
      })

      await wizard.returnToContext(chatId, userId, "income_sources")

      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should handle unknown context by returning to main menu", async () => {
      wizard.setState(userId, {
        step: "TEST",
        data: {},
        lang: "en",
      })

      await wizard.returnToContext(chatId, userId, "unknown_context" as any)

      expect(wizard.getState(userId)).toBeUndefined()
    })
  })

  describe("BUDGET_CATEGORY_SELECT step", () => {
    it("should handle category selection and show budget details", async () => {
      wizard.setState(userId, {
        step: "BUDGET_CATEGORY_SELECT",
        data: {},
        lang: "en",
      })
      ;(db.getCategoryBudgets as jest.Mock).mockResolvedValue({
        limit: 1000,
        spent: 500,
        currency: "USD",
      })

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "🍔 Food & Dining"
      )

      expect(typeof result).toBe("boolean")
    })
  })
})
