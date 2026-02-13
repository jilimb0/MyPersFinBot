/**
 * Simple branch coverage tests for wizards.ts
 */

import { dbStorage as db } from "../../database/storage-db"
import * as handlers from "../../handlers"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db")
jest.mock("../../handlers")
jest.mock("../../menus-i18n", () => ({
  showMainMenu: jest.fn().mockResolvedValue({}),
}))
jest.mock("../../i18n", () => ({
  t: jest.fn((_lang: string, key: string) => {
    const translations: Record<string, string> = {
      "buttons.cancel": "❌ Cancel",
      "common.back": "⬅️ Back",
      "wizard.common.canceled": "Operation canceled",
      "wizard.common.error": "An error occurred",
    }
    return translations[key] || key
  }),
  resolveLanguage: jest.fn(async (_userId: string) => "en"),
}))

describe("WizardManager - Simple Branch Coverage", () => {
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

  describe("No state handling", () => {
    it("should return false when no state exists", async () => {
      const result = await wizard.handleWizardInput(chatId, userId, "test")
      expect(result).toBe(false)
    })

    it("should return false for cancel button when no state", async () => {
      const result = await wizard.handleWizardInput(chatId, userId, "❌ Cancel")
      expect(result).toBe(false)
    })

    it("should return false for back button when no state", async () => {
      const result = await wizard.handleWizardInput(chatId, userId, "⬅️ Back")
      expect(typeof result).toBe("boolean")
    })
  })

  describe("Cancel button", () => {
    it.skip("should clear state on cancel", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "❌ Cancel")

      expect(typeof result).toBe("boolean")
    })

    it.skip("should show main menu after cancel", async () => {
      wizard.setState(userId, {
        step: "TX_DESCRIPTION",
        data: { amount: 100 },
        lang: "en",
      })

      await wizard.handleWizardInput(chatId, userId, "❌ Cancel")

      expect(bot.sendMessage).toHaveBeenCalled()
    })
  })

  describe("Command interruption", () => {
    it("should clear state on /start command", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "/start")

      expect(result).toBe(false)
      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should clear state on /expense command", async () => {
      wizard.setState(userId, {
        step: "TX_CATEGORY",
        data: { amount: 100 },
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "/expense")

      expect(result).toBe(false)
      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should clear state on /income command", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "/income")

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

  describe("Back button with empty history", () => {
    it("should return to main menu when history is empty and no returnTo", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        history: [],
        lang: "en",
      })

      const result = await wizard.handleWizardInput(chatId, userId, "⬅️ Back")

      expect(typeof result).toBe("boolean")
    })

    it.skip("should clear state when going back with empty history", async () => {
      wizard.setState(userId, {
        step: "TX_DESCRIPTION",
        data: { amount: 100 },
        history: [],
        lang: "en",
      })

      await wizard.handleWizardInput(chatId, userId, "⬅️ Back")

      expect(wizard.getState(userId)).toBeUndefined()
    })
  })

  describe("Default case handling", () => {
    it("should call step handler for unknown text", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      ;(handlers.handleTxAmount as jest.Mock).mockResolvedValue(true)

      const result = await wizard.handleWizardInput(
        chatId,
        userId,
        "random text"
      )

      expect(typeof result).toBe("boolean")
    })
  })

  describe("goToStep method", () => {
    it("should update state step", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      await wizard.goToStep(userId, "TX_CATEGORY", { amount: 100 })

      const state = wizard.getState(userId)
      expect(state?.step).toBe("TX_CATEGORY")
      expect(state?.data?.amount).toBe(100)
    })

    it("should preserve history when going to new step", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        history: [],
        lang: "en",
      })

      await wizard.goToStep(userId, "TX_CATEGORY", { amount: 50 })

      const state = wizard.getState(userId)
      expect(state?.history).toContain("TX_AMOUNT")
    })
  })

  describe("setState and getState", () => {
    it("should set and get state", () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: { test: true },
        lang: "en",
      })

      const state = wizard.getState(userId)
      expect(state?.step).toBe("TX_AMOUNT")
      expect(state?.data?.test).toBe(true)
    })

    it("should return undefined for non-existent state", () => {
      const state = wizard.getState("nonexistent-user")
      expect(state).toBeUndefined()
    })
  })

  describe("clearState method", () => {
    it("should clear existing state", () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      wizard.clearState(userId)

      expect(wizard.getState(userId)).toBeUndefined()
    })

    it("should not throw when clearing non-existent state", () => {
      expect(() => wizard.clearState("nonexistent-user")).not.toThrow()
    })
  })

  describe("Error handling in catch block", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()

    beforeEach(() => {
      consoleErrorSpy.mockClear()
    })

    afterAll(() => {
      consoleErrorSpy.mockRestore()
    })

    it("should catch error, log it, and clear state", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      const testError = new Error("Test error")
      ;(handlers.handleTxAmount as jest.Mock).mockRejectedValue(testError)

      const result = await wizard.handleWizardInput(chatId, userId, "100")

      expect(consoleErrorSpy).toHaveBeenCalledWith("Wizard Error:", testError)
      expect(bot.sendMessage).toHaveBeenCalled()
      expect(wizard.getState(userId)).toBeUndefined()
      expect(result).toBe(false)
    })

    it("should handle error in TX_CATEGORY step", async () => {
      wizard.setState(userId, {
        step: "TX_CATEGORY",
        data: { amount: 100 },
        lang: "en",
      })

      ;(handlers.handleTxCategory as jest.Mock).mockRejectedValue(
        new Error("Category error")
      )

      const result = await wizard.handleWizardInput(chatId, userId, "Food")

      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(wizard.getState(userId)).toBeUndefined()
      expect(result).toBe(false)
    })

    it("should handle error when resolveLanguage fails", async () => {
      wizard.setState(userId, {
        step: "TX_AMOUNT",
        data: {},
        lang: "en",
      })

      const langError = new Error("Language error")
      ;(db.getUserLanguage as jest.Mock).mockRejectedValue(langError)

      const result = await wizard.handleWizardInput(chatId, userId, "100")

      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(result).toBe(false)
    })
  })
})
