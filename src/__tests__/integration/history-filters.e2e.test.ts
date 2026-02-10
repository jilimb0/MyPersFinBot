import type TelegramBot from "node-telegram-bot-api"
import { t } from "../../i18n"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getTransactionsPaginated: jest.fn(),
    getUserData: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetTransactionsPaginated =
  dbStorage.getTransactionsPaginated as jest.MockedFunction<
    typeof dbStorage.getTransactionsPaginated
  >
const mockGetUserData = dbStorage.getUserData as jest.MockedFunction<
  typeof dbStorage.getUserData
>

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("E2E history filters", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTransactionsPaginated.mockResolvedValue({
      transactions: [],
      total: 0,
      hasMore: false,
    })
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
  })

  test("history list -> filters menu", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    const userId = "user-1"
    const chatId = 400

    wizard.setState(userId, {
      step: "HISTORY_LIST",
      data: {},
      returnTo: "history",
      lang: "uk",
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t("uk", "transactions.historyFilters")
    )

    const lastCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    expect(lastCall).toBeTruthy()
  })
})
