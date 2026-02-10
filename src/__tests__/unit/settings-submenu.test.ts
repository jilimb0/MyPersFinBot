/**
 * Extended tests for settings submenu handlers
 */

import * as settingsHandlers from "../../handlers/message/settings-submenu.handlers"
import type { MessageContext } from "../../handlers/message/types"

jest.mock("../../handlers/language-handler", () => ({
  showLanguageMenu: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../menus-i18n", () => ({
  showAutomationMenu: jest.fn().mockResolvedValue(undefined),
  showAdvancedMenu: jest.fn().mockResolvedValue(undefined),
  showIncomeSourcesMenu: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../handlers", () => ({
  handleNotificationsMenu: jest.fn().mockResolvedValue(undefined),
  handleRecurringMenu: jest.fn().mockResolvedValue(undefined),
  handleCustomMessagesMenu: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../queue", () => ({
  cancelReminder: jest.fn().mockResolvedValue(undefined),
  cancelRecurringTransaction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../services/user-context", () => ({
  userContext: {
    clearContext: jest.fn(),
  },
}))

jest.mock("../../i18n/keyboards", () => ({
  getSettingsKeyboard: jest.fn().mockReturnValue({
    keyboard: [[{ text: "Settings" }]],
    resize_keyboard: true,
  }),
}))

import * as handlers from "../../handlers"
import { showLanguageMenu } from "../../handlers/language-handler"
import { getSettingsKeyboard } from "../../i18n/keyboards"
import * as menus from "../../menus-i18n"
import { cancelRecurringTransaction, cancelReminder } from "../../queue"
import { userContext } from "../../services/user-context"

const createMockContext = (overrides = {}): MessageContext => ({
  bot: {
    sendMessage: jest.fn().mockResolvedValue({}),
  } as any,
  msg: {
    message_id: 1,
    date: Date.now(),
    chat: { id: 12345, type: "private" },
    from: { id: 123, is_bot: false, first_name: "Test" },
  } as any,
  chatId: 12345,
  userId: "user123",
  lang: "en",
  text: "",
  db: {
    getDefaultCurrency: jest.fn().mockResolvedValue("USD"),
    setDefaultCurrency: jest.fn().mockResolvedValue(undefined),
    getAllReminders: jest.fn().mockResolvedValue([]),
    getAllRecurringTransactions: jest.fn().mockResolvedValue([]),
    clearAllUserData: jest.fn().mockResolvedValue(undefined),
    getBalancesList: jest.fn().mockResolvedValue([]),
    convertAllBalancesToCurrency: jest.fn().mockResolvedValue(undefined),
  } as any,
  wizardManager: {
    getState: jest.fn(),
    setState: jest.fn(),
    clearState: jest.fn(),
    goToStep: jest.fn(),
  } as any,
  ...overrides,
})

describe("Settings submenu handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("handleLanguageSettings", () => {
    test("shows language menu", async () => {
      const context = createMockContext()
      const result = await settingsHandlers.handleLanguageSettings(context)

      expect(showLanguageMenu).toHaveBeenCalledWith(
        context.bot,
        12345,
        "user123"
      )
      expect(result).toBe(true)
    })

    test("works with different userId", async () => {
      const context = createMockContext({ userId: "user456" })
      await settingsHandlers.handleLanguageSettings(context)

      expect(showLanguageMenu).toHaveBeenCalledWith(
        expect.any(Object),
        12345,
        "user456"
      )
    })
  })

  describe("handleAutomationMenu", () => {
    test("shows automation menu", async () => {
      const context = createMockContext()
      const result = await settingsHandlers.handleAutomationMenu(context)

      expect(menus.showAutomationMenu).toHaveBeenCalledWith(
        context.wizardManager,
        12345,
        "user123",
        "en"
      )
      expect(result).toBe(true)
    })

    test("works with different language", async () => {
      const context = createMockContext({ lang: "ru" })
      await settingsHandlers.handleAutomationMenu(context)

      expect(menus.showAutomationMenu).toHaveBeenCalledWith(
        expect.any(Object),
        12345,
        "user123",
        "ru"
      )
    })
  })

  describe("handleAdvancedMenu", () => {
    test("shows advanced menu", async () => {
      const context = createMockContext()
      const result = await settingsHandlers.handleAdvancedMenu(context)

      expect(menus.showAdvancedMenu).toHaveBeenCalledWith(
        context.wizardManager,
        12345,
        "user123",
        "en"
      )
      expect(result).toBe(true)
    })
  })

  describe("handleHelp", () => {
    test("sets wizard state and shows help", async () => {
      const context = createMockContext()
      const result = await settingsHandlers.handleHelp(context)

      expect(context.wizardManager.setState).toHaveBeenCalledWith("user123", {
        step: "HELP_VIEW",
        data: {},
        returnTo: "settings",
        lang: "en",
      })
      expect(context.bot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.any(String),
        expect.objectContaining({
          parse_mode: "Markdown",
          reply_markup: expect.objectContaining({
            resize_keyboard: true,
          }),
        })
      )
      expect(result).toBe(true)
    })

    test("works with different language", async () => {
      const context = createMockContext({ lang: "uk" })
      await settingsHandlers.handleHelp(context)

      expect(context.wizardManager.setState).toHaveBeenCalledWith(
        "user123",
        expect.objectContaining({
          lang: "uk",
        })
      )
    })
  })

  describe("handleIncomeSourcesMenu", () => {
    test("sets state and shows income sources menu", async () => {
      const context = createMockContext()
      const result = await settingsHandlers.handleIncomeSourcesMenu(context)

      expect(context.wizardManager.setState).toHaveBeenCalledWith("user123", {
        step: "INCOME_VIEW",
        data: {},
        returnTo: "settings",
        lang: "en",
      })
      expect(menus.showIncomeSourcesMenu).toHaveBeenCalledWith(
        context.bot,
        12345,
        "user123",
        "en"
      )
      expect(result).toBe(true)
    })
  })

  describe("handleClearDataConfirm", () => {
    test("shows clear data warning", async () => {
      const context = createMockContext()
      const result = await settingsHandlers.handleClearDataConfirm(context)

      expect(context.wizardManager.setState).toHaveBeenCalledWith("user123", {
        step: "CONFIRM_CLEAR_DATA",
        data: {},
        returnTo: "advanced",
        lang: "en",
      })
      expect(context.bot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.any(String),
        expect.objectContaining({
          parse_mode: "Markdown",
        })
      )
      expect(result).toBe(true)
    })
  })

  describe("handleClearDataExecute", () => {
    test("clears all user data successfully", async () => {
      const context = createMockContext()
      const result = await settingsHandlers.handleClearDataExecute(context)

      expect(context.db.getAllReminders).toHaveBeenCalledWith("user123")
      expect(context.db.getAllRecurringTransactions).toHaveBeenCalledWith(
        "user123"
      )
      expect(context.db.clearAllUserData).toHaveBeenCalledWith("user123")
      expect(userContext.clearContext).toHaveBeenCalledWith("user123")
      expect(context.wizardManager.clearState).toHaveBeenCalledWith("user123")
      expect(context.bot.sendMessage).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    test("cancels reminders before clearing", async () => {
      const context = createMockContext()
      ;(context.db.getAllReminders as jest.Mock).mockResolvedValue([
        { id: "r1" },
        { id: "r2" },
      ])

      await settingsHandlers.handleClearDataExecute(context)

      expect(cancelReminder).toHaveBeenCalledTimes(2)
      expect(cancelReminder).toHaveBeenCalledWith("r1")
      expect(cancelReminder).toHaveBeenCalledWith("r2")
    })

    test("cancels recurring transactions before clearing", async () => {
      const context = createMockContext()
      ;(context.db.getAllRecurringTransactions as jest.Mock).mockResolvedValue([
        { id: "rt1", cronExpression: "0 0 * * *" },
        { id: "rt2", cronExpression: "0 12 * * *" },
      ])

      await settingsHandlers.handleClearDataExecute(context)

      expect(cancelRecurringTransaction).toHaveBeenCalledTimes(2)
      expect(cancelRecurringTransaction).toHaveBeenCalledWith(
        "rt1",
        "0 0 * * *"
      )
    })

    test("handles cleanup errors gracefully", async () => {
      const context = createMockContext()
      ;(context.db.getAllReminders as jest.Mock).mockRejectedValue(
        new Error("DB error")
      )
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()

      await settingsHandlers.handleClearDataExecute(context)

      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(context.db.clearAllUserData).toHaveBeenCalled()
      consoleWarnSpy.mockRestore()
    })

    test("handles clear data error", async () => {
      const context = createMockContext()
      ;(context.db.clearAllUserData as jest.Mock).mockRejectedValue(
        new Error("Clear error")
      )
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()

      await settingsHandlers.handleClearDataExecute(context)

      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(getSettingsKeyboard).toHaveBeenCalledWith("en")
      consoleErrorSpy.mockRestore()
    })
  })

  describe("handleNotificationsMenu", () => {
    test("sets state and shows notifications menu", async () => {
      const context = createMockContext()
      const result = await settingsHandlers.handleNotificationsMenu(context)

      expect(context.wizardManager.setState).toHaveBeenCalledWith("user123", {
        step: "NOTIFICATIONS_MENU",
        data: {},
        returnTo: "automation",
        lang: "en",
      })
      expect(handlers.handleNotificationsMenu).toHaveBeenCalledWith(
        context.wizardManager,
        12345,
        "user123"
      )
      expect(result).toBe(true)
    })
  })

  describe("handleRecurringMenu", () => {
    test("shows recurring menu", async () => {
      const context = createMockContext()
      const result = await settingsHandlers.handleRecurringMenu(context)

      expect(handlers.handleRecurringMenu).toHaveBeenCalledWith(
        context.wizardManager,
        12345,
        "user123",
        "en"
      )
      expect(result).toBe(true)
    })
  })

  describe("handleCustomMessagesMenu", () => {
    test("shows custom messages menu", async () => {
      const context = createMockContext()
      const result = await settingsHandlers.handleCustomMessagesMenu(context)

      expect(handlers.handleCustomMessagesMenu).toHaveBeenCalledWith(
        context.wizardManager,
        12345,
        "user123"
      )
      expect(result).toBe(true)
    })
  })

  describe("handleUploadStatement", () => {
    test("sets state and shows upload instructions", async () => {
      const context = createMockContext()
      const result = await settingsHandlers.handleUploadStatement(context)

      expect(context.wizardManager.setState).toHaveBeenCalledWith("user123", {
        step: "UPLOAD_STATEMENT",
        data: {},
        returnTo: "advanced",
        lang: "en",
      })
      expect(context.bot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.any(String),
        expect.objectContaining({
          parse_mode: "Markdown",
        })
      )
      expect(result).toBe(true)
    })
  })

  describe("handleChangeCurrency", () => {
    test("shows currency selection", async () => {
      const context = createMockContext()
      ;(context.db.getDefaultCurrency as jest.Mock).mockResolvedValue("EUR")

      const result = await settingsHandlers.handleChangeCurrency(context)

      expect(context.db.getDefaultCurrency).toHaveBeenCalledWith("user123")
      expect(context.wizardManager.setState).toHaveBeenCalledWith("user123", {
        step: "CURRENCY_SELECT",
        data: {},
        returnTo: "settings",
        lang: "en",
      })
      expect(context.bot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining("EUR"),
        expect.any(Object)
      )
      expect(result).toBe(true)
    })

    test("shows all currency options", async () => {
      const context = createMockContext()
      await settingsHandlers.handleChangeCurrency(context)

      const callArgs = (context.bot.sendMessage as jest.Mock).mock.calls[0]
      const keyboard = callArgs[2].reply_markup.keyboard

      expect(keyboard.length).toBeGreaterThan(0)
      expect(keyboard[keyboard.length - 1]).toContainEqual({
        text: expect.any(String),
      })
    })
  })

  describe("handleCurrencyChangeConfirm", () => {
    test("returns false for non-currency text", async () => {
      const context = createMockContext({ text: "Random text" })
      const result = await settingsHandlers.handleCurrencyChangeConfirm(context)

      expect(result).toBe(false)
    })

    test("shows confirmation when currency differs", async () => {
      const context = createMockContext({ text: "EUR 🇪🇺" })
      ;(context.db.getDefaultCurrency as jest.Mock).mockResolvedValue("USD")
      ;(context.db.getBalancesList as jest.Mock).mockResolvedValue([
        { accountId: "A" },
      ])

      const result = await settingsHandlers.handleCurrencyChangeConfirm(context)

      expect(context.wizardManager.goToStep).toHaveBeenCalledWith(
        "user123",
        "SETTINGS_CURRENCY_CONFIRM",
        {
          newCurrency: "EUR",
          balancesCount: 1,
        }
      )
      expect(context.bot.sendMessage).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    test("shows different message with no balances", async () => {
      const context = createMockContext({ text: "GEL 🇬🇪" })
      ;(context.db.getDefaultCurrency as jest.Mock).mockResolvedValue("USD")
      ;(context.db.getBalancesList as jest.Mock).mockResolvedValue([])

      await settingsHandlers.handleCurrencyChangeConfirm(context)

      const message = (context.bot.sendMessage as jest.Mock).mock.calls[0][1]
      expect(message).toBeDefined()
    })

    test("shows message when currency is already current", async () => {
      const context = createMockContext({ text: "USD 💵" })
      ;(context.db.getDefaultCurrency as jest.Mock).mockResolvedValue("USD")

      const result = await settingsHandlers.handleCurrencyChangeConfirm(context)

      expect(context.bot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.any(String),
        expect.objectContaining({
          reply_markup: expect.any(Object),
        })
      )
      expect(getSettingsKeyboard).toHaveBeenCalledWith("en")
      expect(result).toBe(true)
    })

    test("handles different currencies", async () => {
      const currencies = ["RUB", "UAH", "PLN"]

      for (const curr of currencies) {
        const context = createMockContext({ text: `${curr} ` })
        ;(context.db.getDefaultCurrency as jest.Mock).mockResolvedValue("USD")
        ;(context.db.getBalancesList as jest.Mock).mockResolvedValue([])

        await settingsHandlers.handleCurrencyChangeConfirm(context)

        expect(context.wizardManager.goToStep).toHaveBeenCalledWith(
          "user123",
          "SETTINGS_CURRENCY_CONFIRM",
          expect.objectContaining({ newCurrency: curr })
        )
      }
    })
  })

  describe("handleCurrencyChangeExecute", () => {
    test("returns false when not in correct step", async () => {
      const context = createMockContext()
      ;(context.wizardManager.getState as jest.Mock).mockReturnValue({
        step: "WRONG_STEP",
        data: {},
      })

      const result = await settingsHandlers.handleCurrencyChangeExecute(context)

      expect(result).toBe(false)
    })

    test("returns false when no data", async () => {
      const context = createMockContext()
      ;(context.wizardManager.getState as jest.Mock).mockReturnValue({
        step: "SETTINGS_CURRENCY_CONFIRM",
        data: null,
      })

      const result = await settingsHandlers.handleCurrencyChangeExecute(context)

      expect(result).toBe(false)
    })

    test("changes currency with balances", async () => {
      const context = createMockContext()
      ;(context.wizardManager.getState as jest.Mock).mockReturnValue({
        step: "SETTINGS_CURRENCY_CONFIRM",
        data: {
          newCurrency: "EUR",
          balancesCount: 3,
        },
      })

      const result = await settingsHandlers.handleCurrencyChangeExecute(context)

      expect(context.db.setDefaultCurrency).toHaveBeenCalledWith(
        "user123",
        "EUR"
      )
      expect(context.db.convertAllBalancesToCurrency).toHaveBeenCalledWith(
        "user123",
        "EUR"
      )
      expect(context.bot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining("EUR"),
        expect.any(Object)
      )
      expect(context.wizardManager.clearState).toHaveBeenCalledWith("user123")
      expect(result).toBe(true)
    })

    test("changes currency without balances", async () => {
      const context = createMockContext()
      ;(context.wizardManager.getState as jest.Mock).mockReturnValue({
        step: "SETTINGS_CURRENCY_CONFIRM",
        data: {
          newCurrency: "GEL",
          balancesCount: 0,
        },
      })

      await settingsHandlers.handleCurrencyChangeExecute(context)

      expect(context.db.setDefaultCurrency).toHaveBeenCalledWith(
        "user123",
        "GEL"
      )
      expect(context.db.convertAllBalancesToCurrency).not.toHaveBeenCalled()
      expect(context.bot.sendMessage).toHaveBeenCalled()
    })

    test("clears wizard state after execution", async () => {
      const context = createMockContext()
      ;(context.wizardManager.getState as jest.Mock).mockReturnValue({
        step: "SETTINGS_CURRENCY_CONFIRM",
        data: { newCurrency: "PLN", balancesCount: 1 },
      })

      await settingsHandlers.handleCurrencyChangeExecute(context)

      expect(context.wizardManager.clearState).toHaveBeenCalledWith("user123")
    })
  })
})
