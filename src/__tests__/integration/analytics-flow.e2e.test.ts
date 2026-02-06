import TelegramBot from "node-telegram-bot-api"
import { WizardManager } from "../../wizards/wizards"
import { t } from "../../i18n"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserData: jest.fn(),
    getTransactionsPaginated: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetUserData = dbStorage.getUserData as jest.MockedFunction<
  typeof dbStorage.getUserData
>
const mockGetTransactionsPaginated =
  dbStorage.getTransactionsPaginated as jest.MockedFunction<
    typeof dbStorage.getTransactionsPaginated
  >

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("E2E analytics flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUserData.mockResolvedValue({
      balances: [],
      transactions: [],
      debts: [],
      goals: [],
      budgets: [],
      incomeSources: [],
      templates: [],
      defaultCurrency: "USD",
    })
    mockGetTransactionsPaginated.mockResolvedValue({
      transactions: [],
      total: 0,
      hasMore: false,
    })
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
