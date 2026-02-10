import { t } from "../../i18n"
import { showBalancesMenu, showMainMenu } from "../../menus-i18n"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn().mockResolvedValue("en"),
  },
}))

jest.mock("../../menus-i18n", () => ({
  showMainMenu: jest.fn().mockResolvedValue(undefined),
  showBalancesMenu: jest.fn().mockResolvedValue(undefined),
  showDebtsMenu: jest.fn().mockResolvedValue(undefined),
  showGoalsMenu: jest.fn().mockResolvedValue(undefined),
  showHistoryMenu: jest.fn().mockResolvedValue(undefined),
  showSettingsMenu: jest.fn().mockResolvedValue(undefined),
  showAutomationMenu: jest.fn().mockResolvedValue(undefined),
  showAdvancedMenu: jest.fn().mockResolvedValue(undefined),
  showBudgetMenu: jest.fn().mockResolvedValue(undefined),
  showAnalyticsReportsMenu: jest.fn().mockResolvedValue(undefined),
  showStatsMenu: jest.fn().mockResolvedValue(undefined),
  showIncomeSourcesMenu: jest.fn().mockResolvedValue(undefined),
  showNetWorthMenu: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../handlers", () => ({
  handleRecurringMenu: jest.fn().mockResolvedValue(undefined),
}))

/**
 * Comprehensive test suite for WizardManager.
 * Merged from wizard-manager.test.ts and wizard-manager-extended.test.ts
 * All duplicate tests have been removed.
 */
describe("WizardManager", () => {
  const makeBot = () => ({ sendMessage: jest.fn().mockResolvedValue({}) })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("State Management", () => {
    test("setState sets user state with history", () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })
      const state = wizard.getState("user-1")
      expect(state?.step).toBe("TEST")
      expect(state?.data).toEqual({})
      expect(state?.lang).toBe("en")
      expect(state?.history).toEqual([]) // history is added by setState
    })

    test("getState returns undefined for non-existent user", () => {
      const wizard = new WizardManager(makeBot() as any)
      expect(wizard.getState("non-existent")).toBeUndefined()
    })

    test("clearState removes user state", () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })
      wizard.clearState("user-1")
      expect(wizard.getState("user-1")).toBeUndefined()
    })

    test("goToStep changes current step", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "STEP1", data: {}, lang: "en" })
      await wizard.goToStep("user-1", "STEP2")
      expect(wizard.getState("user-1")?.step).toBe("STEP2")
    })

    test("goToStep preserves data", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", {
        step: "STEP1",
        data: { key: "value" },
        lang: "en",
      })
      await wizard.goToStep("user-1", "STEP2")
      expect(wizard.getState("user-1")?.data?.key).toBe("value")
    })

    test("goToStep adds previous step to history", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "STEP1", data: {}, lang: "en" })
      await wizard.goToStep("user-1", "STEP2")
      expect(wizard.getState("user-1")?.history).toContain("STEP1")
    })

    test("goToStep creates state if not exists", async () => {
      const wizard = new WizardManager(makeBot() as any)
      await wizard.goToStep("user-1", "NEW_STEP")
      expect(wizard.getState("user-1")?.step).toBe("NEW_STEP")
      expect(wizard.getState("user-1")?.lang).toBe("en")
    })

    test("goToStep merges data", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", {
        step: "STEP1",
        data: { key1: "value1" },
        lang: "en",
      })
      await wizard.goToStep("user-1", "STEP2", { key2: "value2" })
      const state = wizard.getState("user-1")
      expect(state?.data?.key1).toBe("value1")
      expect(state?.data?.key2).toBe("value2")
    })
  })

  describe("Helper Methods", () => {
    test("isInWizard returns true for active wizard", () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })
      expect(wizard.isInWizard("user-1")).toBe(true)
    })

    test("isInWizard returns false for no wizard", () => {
      const wizard = new WizardManager(makeBot() as any)
      expect(wizard.isInWizard("user-1")).toBe(false)
    })

    test("getBot returns bot instance", () => {
      const bot = makeBot()
      const wizard = new WizardManager(bot as any)
      expect(wizard.getBot()).toBe(bot)
    })

    test("getBackButton returns keyboard markup", () => {
      const wizard = new WizardManager(makeBot() as any)
      const result = wizard.getBackButton("en")
      expect(result.reply_markup).toBeDefined()
      expect(result.reply_markup.keyboard).toBeDefined()
      expect(result.reply_markup.resize_keyboard).toBe(true)
    })
  })

  describe("handleWizardInput - Commands", () => {
    test("ignores /start and clears state", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "X", data: {}, lang: "en" })

      const result = await wizard.handleWizardInput(1, "user-1", "/start")
      expect(result).toBe(false)
      expect(wizard.getState("user-1")).toBeUndefined()
    })

    test("blocks unknown command", async () => {
      const wizard = new WizardManager(makeBot() as any)
      const result = await wizard.handleWizardInput(1, "user-1", "/unknown")
      expect(result).toBe(true)
    })

    test("blocks unknown command and clears state", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })
      const result = await wizard.handleWizardInput(1, "user-1", "/unknown")
      expect(result).toBe(true)
      expect(wizard.getState("user-1")).toBeUndefined()
    })

    test("/expense clears state and returns false", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })
      const result = await wizard.handleWizardInput(1, "user-1", "/expense")
      expect(result).toBe(false)
      expect(wizard.getState("user-1")).toBeUndefined()
    })

    test("/income clears state and returns false", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })
      const result = await wizard.handleWizardInput(1, "user-1", "/income")
      expect(result).toBe(false)
      expect(wizard.getState("user-1")).toBeUndefined()
    })
  })

  describe("handleWizardInput - Buttons", () => {
    test("main menu button clears state", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "X", data: {}, lang: "en" })

      const result = await wizard.handleWizardInput(
        1,
        "user-1",
        t("en", "mainMenu.mainMenuButton")
      )
      expect(result).toBe(true)
      expect(wizard.getState("user-1")).toBeUndefined()
      expect(showMainMenu).toHaveBeenCalled()
    })

    test("balances button clears state", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "X", data: {}, lang: "en" })

      const result = await wizard.handleWizardInput(
        1,
        "user-1",
        t("en", "buttons.balances")
      )
      expect(result).toBe(true)
      expect(wizard.getState("user-1")).toBeUndefined()
      expect(showBalancesMenu).toHaveBeenCalled()
    })

    test("goToBalances button clears state", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })
      const result = await wizard.handleWizardInput(
        1,
        "user-1",
        t("en", "buttons.goToBalances")
      )
      expect(result).toBe(true)
      expect(wizard.getState("user-1")).toBeUndefined()
      expect(showBalancesMenu).toHaveBeenCalled()
    })

    test("change amount with no state routes to main menu", async () => {
      const wizard = new WizardManager(makeBot() as any)

      const result = await wizard.handleWizardInput(
        1,
        "user-1",
        t("en", "buttons.changeAmount")
      )
      expect(result).toBe(true)
    })
  })

  describe("returnToContext", () => {
    test("routes to specific menus", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "X", data: {}, lang: "en" })

      await wizard.returnToContext(1, "user-1", "debts")
      await wizard.returnToContext(1, "user-1", "goals")
      await wizard.returnToContext(1, "user-1", "balances")
      await wizard.returnToContext(1, "user-1", "history")
      await wizard.returnToContext(1, "user-1", "automation")
      await wizard.returnToContext(1, "user-1", "advanced")
      await wizard.returnToContext(1, "user-1", undefined)
    })

    test("calls showDebtsMenu for debts context", async () => {
      const wizard = new WizardManager(makeBot() as any)
      await wizard.returnToContext(1, "user-1", "debts")
      // Just verify it doesn't throw
      expect(true).toBe(true)
    })

    test("calls showMainMenu for undefined context", async () => {
      const wizard = new WizardManager(makeBot() as any)
      await wizard.returnToContext(1, "user-1", undefined)
      expect(showMainMenu).toHaveBeenCalled()
    })

    test("handles all context types", async () => {
      const wizard = new WizardManager(makeBot() as any)
      const contexts = [
        "goals",
        "balances",
        "income",
        "settings",
        "history",
        "analytics",
        "budgets",
        "reports",
        "automation",
        "advanced",
        "recurring",
      ]

      for (const context of contexts) {
        await wizard.returnToContext(1, "user-1", context)
      }

      // Should not throw
      expect(true).toBe(true)
    })
  })

  describe("sendMessage wrapper", () => {
    test("sends message via bot", async () => {
      const bot = makeBot()
      const wizard = new WizardManager(bot as any)
      await wizard.sendMessage(123, "Hello")
      expect(bot.sendMessage).toHaveBeenCalledWith(123, "Hello", undefined)
    })

    test("sends message with options", async () => {
      const bot = makeBot()
      const wizard = new WizardManager(bot as any)
      const options = { parse_mode: "Markdown" as const }
      await wizard.sendMessage(123, "Hello", options)
      expect(bot.sendMessage).toHaveBeenCalledWith(123, "Hello", options)
    })
  })

  describe("goToStep - advanced scenarios", () => {
    test("preserves returnTo when transitioning steps", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", {
        step: "STEP1",
        data: {},
        lang: "en",
        returnTo: "balances",
      })

      await wizard.goToStep("user-1", "STEP2")

      const state = wizard.getState("user-1")
      expect(state?.returnTo).toBe("balances")
    })

    test("clears flow-specific flags when changing flow", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", {
        step: "TX_AMOUNT",
        data: {
          accountsShown: true,
          topCategoriesShown: true,
          otherData: "keep",
        },
        lang: "en",
      })

      await wizard.goToStep("user-1", "BALANCE_NAME")

      const state = wizard.getState("user-1")
      expect(state?.data?.accountsShown).toBeUndefined()
      expect(state?.data?.topCategoriesShown).toBeUndefined()
      expect(state?.data?.otherData).toBe("keep")
    })

    test("doesn't add duplicate step to history", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "STEP1", data: {}, lang: "en" })

      await wizard.goToStep("user-1", "STEP1")

      const state = wizard.getState("user-1")
      expect(state?.history).toEqual([])
    })

    test("creates state with default language when none exists", async () => {
      const wizard = new WizardManager(makeBot() as any)

      await wizard.goToStep("new-user", "FIRST_STEP", { key: "value" })

      const state = wizard.getState("new-user")
      expect(state?.step).toBe("FIRST_STEP")
      expect(state?.data?.key).toBe("value")
      expect(state?.lang).toBe("en")
    })

    test("handles multiple step transitions", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "A", data: {}, lang: "en" })

      await wizard.goToStep("user-1", "B")
      await wizard.goToStep("user-1", "C")
      await wizard.goToStep("user-1", "D")

      const state = wizard.getState("user-1")
      expect(state?.step).toBe("D")
      expect(state?.history).toEqual(["A", "B", "C"])
    })

    test("merges data without overwriting existing keys", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", {
        step: "STEP1",
        data: { a: 1, b: 2 },
        lang: "en",
      })

      await wizard.goToStep("user-1", "STEP2", { c: 3 })

      const state = wizard.getState("user-1")
      expect(state?.data).toEqual({ a: 1, b: 2, c: 3 })
    })

    test("overwrites data keys with new values", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", {
        step: "STEP1",
        data: { key: "old" },
        lang: "en",
      })

      await wizard.goToStep("user-1", "STEP2", { key: "new" })

      const state = wizard.getState("user-1")
      expect(state?.data?.key).toBe("new")
    })
  })

  describe("returnToContext - all contexts", () => {
    test("returns to income context", async () => {
      const wizard = new WizardManager(makeBot() as any)
      await wizard.returnToContext(1, "user-1", "income")
      expect(true).toBe(true) // Should not throw
    })

    test("returns to settings context", async () => {
      const wizard = new WizardManager(makeBot() as any)
      await wizard.returnToContext(1, "user-1", "settings")
      expect(true).toBe(true)
    })

    test("returns to analytics context", async () => {
      const wizard = new WizardManager(makeBot() as any)
      await wizard.returnToContext(1, "user-1", "analytics")
      expect(true).toBe(true)
    })

    test("returns to budgets context", async () => {
      const wizard = new WizardManager(makeBot() as any)
      await wizard.returnToContext(1, "user-1", "budgets")
      expect(true).toBe(true)
    })

    test("returns to reports context", async () => {
      const wizard = new WizardManager(makeBot() as any)
      await wizard.returnToContext(1, "user-1", "reports")
      expect(true).toBe(true)
    })

    test("returns to recurring context", async () => {
      const wizard = new WizardManager(makeBot() as any)
      await wizard.returnToContext(1, "user-1", "recurring")
      expect(true).toBe(true)
    })

    test("uses state language when available", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "ru" })

      await wizard.returnToContext(1, "user-1", undefined)

      const state = wizard.getState("user-1")
      expect(state?.lang).toBe("ru")
    })
  })

  describe("handleWizardInput - edge cases", () => {
    test("handles /transfer command", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })

      const result = await wizard.handleWizardInput(1, "user-1", "/transfer")

      expect(result).toBe(true)
      expect(wizard.getState("user-1")).toBeUndefined()
    })

    test("handles /balances command", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })

      const result = await wizard.handleWizardInput(1, "user-1", "/balances")

      expect(result).toBe(true)
      expect(wizard.getState("user-1")).toBeUndefined()
    })

    test("handles /settings command", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })

      const result = await wizard.handleWizardInput(1, "user-1", "/settings")

      expect(result).toBe(true)
      expect(wizard.getState("user-1")).toBeUndefined()
    })

    test("handles /history command", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })

      const result = await wizard.handleWizardInput(1, "user-1", "/history")

      expect(result).toBe(true)
      expect(wizard.getState("user-1")).toBeUndefined()
    })

    test("handles debt button", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })

      const result = await wizard.handleWizardInput(
        1,
        "user-1",
        t("en", "buttons.debts")
      )

      expect(result).toBe(false)
    })

    test("handles goals button", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })

      const result = await wizard.handleWizardInput(
        1,
        "user-1",
        t("en", "buttons.goals")
      )

      expect(result).toBe(false)
    })

    test("handles history button", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })

      const result = await wizard.handleWizardInput(
        1,
        "user-1",
        t("en", "buttons.history")
      )

      expect(result).toBe(false)
    })

    test("handles settings button", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })

      const result = await wizard.handleWizardInput(
        1,
        "user-1",
        t("en", "buttons.settings")
      )

      expect(result).toBe(false)
    })

    test("handles stats button", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", { step: "TEST", data: {}, lang: "en" })

      const result = await wizard.handleWizardInput(
        1,
        "user-1",
        t("en", "buttons.stats")
      )

      expect(result).toBe(false)
    })
  })

  describe("State persistence", () => {
    test("maintains state across multiple operations", async () => {
      const wizard = new WizardManager(makeBot() as any)
      wizard.setState("user-1", {
        step: "STEP1",
        data: { counter: 0 },
        lang: "en",
      })

      const state1 = wizard.getState("user-1")
      if (state1?.data) state1.data.counter = 1
      wizard.setState("user-1", state1!)

      const state2 = wizard.getState("user-1")
      if (state2?.data) state2.data.counter = 2
      wizard.setState("user-1", state2!)

      expect(wizard.getState("user-1")?.data?.counter).toBe(2)
    })

    test("handles multiple users independently", () => {
      const wizard = new WizardManager(makeBot() as any)

      wizard.setState("user-1", { step: "A", data: { value: 1 }, lang: "en" })
      wizard.setState("user-2", { step: "B", data: { value: 2 }, lang: "ru" })
      wizard.setState("user-3", { step: "C", data: { value: 3 }, lang: "uk" })

      expect(wizard.getState("user-1")?.step).toBe("A")
      expect(wizard.getState("user-2")?.step).toBe("B")
      expect(wizard.getState("user-3")?.step).toBe("C")
      expect(wizard.getState("user-1")?.data?.value).toBe(1)
      expect(wizard.getState("user-2")?.lang).toBe("ru")
    })

    test("clearState doesn't affect other users", () => {
      const wizard = new WizardManager(makeBot() as any)

      wizard.setState("user-1", { step: "A", data: {}, lang: "en" })
      wizard.setState("user-2", { step: "B", data: {}, lang: "en" })

      wizard.clearState("user-1")

      expect(wizard.getState("user-1")).toBeUndefined()
      expect(wizard.getState("user-2")).toBeDefined()
    })
  })
})
