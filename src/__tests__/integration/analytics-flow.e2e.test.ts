import type TelegramBot from "node-telegram-bot-api"
import { t } from "../../i18n"
import { WizardManager } from "../../wizards/wizards"
import { setupAnalyticsFixtures } from "../helpers/e2e-fixtures"
import { MockBot } from "../helpers/mock-bot"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserData: jest.fn(),
    getTransactionsPaginated: jest.fn(),
  },
}))

describe("E2E analytics flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupAnalyticsFixtures()
  })

  test("analytics menu -> net worth", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    const userId = "user-1"
    const chatId = 300

    wizard.setState(userId, {
      step: "ANALYTICS_MENU",
      data: {},
      returnTo: "analytics",
      lang: "uk",
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t("uk", "analytics.netWorth")
    )

    const lastCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    expect(lastCall).toBeTruthy()
  })

  test("analytics menu -> history", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    const userId = "user-1"
    const chatId = 301

    wizard.setState(userId, {
      step: "ANALYTICS_MENU",
      data: {},
      returnTo: "analytics",
      lang: "uk",
    })

    await wizard.handleWizardInput(chatId, userId, t("uk", "analytics.history"))

    const lastCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    expect(lastCall).toBeTruthy()
  })
})
