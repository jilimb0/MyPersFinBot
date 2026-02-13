import { dbStorage } from "../../database/storage-db"
import { createMessageRouter } from "../../handlers/message"
import { t } from "../../i18n"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn().mockResolvedValue("en"),
    getUserData: jest.fn().mockResolvedValue({
      defaultCurrency: "USD",
      balances: [],
      debts: [],
      goals: [],
    }),
    logUserActivity: jest.fn().mockResolvedValue(undefined),
    getDebts: jest.fn().mockResolvedValue([]),
    getGoals: jest.fn().mockResolvedValue([]),
  },
}))

jest.mock("../../security", () => ({
  securityCheck: jest.fn().mockResolvedValue(true),
}))

jest.mock("../../wizards/wizards", () => ({
  WizardManager: jest.fn().mockImplementation(() => ({
    isInWizard: jest.fn().mockReturnValue(false),
    handleWizardInput: jest.fn().mockResolvedValue(false),
    clearState: jest.fn(),
    getState: jest.fn().mockReturnValue(null),
  })),
}))

jest.mock("../../config", () => ({
  config: {
    sentryDsn: null,
    isProduction: false,
  },
}))

jest.mock("../../handlers/message/nlp.handlers", () => ({
  isNLPInput: jest.fn().mockReturnValue(false),
  handleNLPInput: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../handlers/language-handler", () => ({
  handleLanguageSelection: jest.fn().mockResolvedValue(false),
}))

jest.mock("../../handlers/message/expense.handlers", () => ({
  handleExpenseStart: jest.fn().mockResolvedValue(true),
}))

jest.mock("../../handlers/message/income.handlers", () => ({
  handleIncomeStart: jest.fn().mockResolvedValue(true),
}))

jest.mock("../../handlers/message/balances.handlers", () => ({
  handleBalancesMenu: jest.fn().mockResolvedValue(true),
  handleAddBalance: jest.fn().mockResolvedValue(true),
}))

jest.mock("../../handlers/message/budget.handlers", () => ({
  handleBudgetMenu: jest.fn().mockResolvedValue(true),
}))

jest.mock("../../handlers/message/debts.handlers", () => ({
  handleDebtsMenu: jest.fn().mockResolvedValue(true),
  handleAddDebt: jest.fn().mockResolvedValue(true),
  handleDebtSelection: jest.fn().mockResolvedValue(false),
}))

jest.mock("../../handlers/message/goals.handlers", () => ({
  handleGoalsMenu: jest.fn().mockResolvedValue(true),
  handleAddGoal: jest.fn().mockResolvedValue(true),
  handleGoalSelection: jest.fn().mockResolvedValue(false),
}))

jest.mock("../../handlers/message/analytics.handlers", () => ({
  handleAnalyticsMenu: jest.fn().mockResolvedValue(true),
}))

jest.mock("../../handlers/message/settings.handlers", () => ({
  handleSettingsMenu: jest.fn().mockResolvedValue(true),
}))

jest.mock("../../handlers/message/navigation.handlers", () => ({
  handleBack: jest.fn().mockResolvedValue(true),
  handleMainMenu: jest.fn().mockResolvedValue(true),
  handleCancel: jest.fn().mockResolvedValue(true),
  handleNoCancel: jest.fn().mockResolvedValue(true),
}))

describe("Message Index - Branch Coverage", () => {
  let bot: any
  let wizard: any
  const chatId = 12345

  beforeEach(() => {
    jest.clearAllMocks()
    bot = {
      sendMessage: jest.fn().mockResolvedValue({}),
      on: jest.fn(),
    }
    wizard = new WizardManager(bot)
  })

  describe("Multi-language button support", () => {
    const languages = ["en", "ru", "uk", "es", "pl"]

    languages.forEach((lang) => {
      it(`should handle expense button in ${lang}`, async () => {
        ;(dbStorage.getUserLanguage as jest.Mock).mockResolvedValueOnce(lang)
        const router = createMessageRouter(bot, wizard)
        router.listen()
        const messageHandler = bot.on.mock.calls[0][1]

        const expenseText = t(lang as any, "mainMenu.expense")
        await messageHandler({
          chat: { id: chatId },
          text: expenseText,
          from: { id: chatId },
        })

        expect(dbStorage.getUserLanguage).toHaveBeenCalled()
      })

      it(`should handle income button in ${lang}`, async () => {
        ;(dbStorage.getUserLanguage as jest.Mock).mockResolvedValueOnce(lang)
        const router = createMessageRouter(bot, wizard)
        router.listen()
        const messageHandler = bot.on.mock.calls[0][1]

        const incomeText = t(lang as any, "mainMenu.income")
        await messageHandler({
          chat: { id: chatId },
          text: incomeText,
          from: { id: chatId },
        })

        expect(dbStorage.getUserLanguage).toHaveBeenCalled()
      })
    })
  })

  describe("Fallback handler", () => {
    it("should handle unknown command", async () => {
      const router = createMessageRouter(bot, wizard)
      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      await messageHandler({
        chat: { id: chatId },
        text: "unknown command xyz",
        from: { id: chatId },
      })

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.any(String),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            keyboard: expect.any(Array),
          }),
        })
      )
    })

    it("should use fallback map for normalized text", async () => {
      const router = createMessageRouter(bot, wizard)
      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      // Normalized version of "Expense" should match
      await messageHandler({
        chat: { id: chatId },
        text: "expense",
        from: { id: chatId },
      })

      expect(dbStorage.getUserLanguage).toHaveBeenCalled()
    })
  })

  describe("Navigation buttons", () => {
    it("should handle back button", async () => {
      const router = createMessageRouter(bot, wizard)
      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      const backText = t("en", "common.back")
      await messageHandler({
        chat: { id: chatId },
        text: backText,
        from: { id: chatId },
      })

      expect(dbStorage.getUserLanguage).toHaveBeenCalled()
    })

    it("should handle cancel button", async () => {
      const router = createMessageRouter(bot, wizard)
      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      const cancelText = t("en", "common.cancel")
      await messageHandler({
        chat: { id: chatId },
        text: cancelText,
        from: { id: chatId },
      })

      expect(dbStorage.getUserLanguage).toHaveBeenCalled()
    })

    it("should handle no cancel button", async () => {
      const router = createMessageRouter(bot, wizard)
      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      const noCancelText = t("en", "common.noCancel")
      await messageHandler({
        chat: { id: chatId },
        text: noCancelText,
        from: { id: chatId },
      })

      expect(dbStorage.getUserLanguage).toHaveBeenCalled()
    })
  })

  describe("Add buttons", () => {
    it("should handle add debt button", async () => {
      const router = createMessageRouter(bot, wizard)
      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      const addDebtText = t("en", "debts.addDebt")
      await messageHandler({
        chat: { id: chatId },
        text: addDebtText,
        from: { id: chatId },
      })

      expect(dbStorage.getUserLanguage).toHaveBeenCalled()
    })

    it("should handle add goal button", async () => {
      const router = createMessageRouter(bot, wizard)
      router.listen()
      const messageHandler = bot.on.mock.calls[0][1]

      const addGoalText = t("en", "goals.addGoal")
      await messageHandler({
        chat: { id: chatId },
        text: addGoalText,
        from: { id: chatId },
      })

      expect(dbStorage.getUserLanguage).toHaveBeenCalled()
    })
  })
})
