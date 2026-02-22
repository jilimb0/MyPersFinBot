import type { BotClient } from "@jilimb0/tgwrapper"
import { t } from "../../i18n"
import { WizardManager } from "../../wizards/wizards"
import { MockBot } from "../helpers/mock-bot"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getTransactions: jest.fn(),
    getUserData: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetTransactions = dbStorage.getTransactions as jest.MockedFunction<
  typeof dbStorage.getTransactions
>
const mockGetUserData = dbStorage.getUserData as jest.MockedFunction<
  typeof dbStorage.getUserData
>

describe("E2E analytics filters", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTransactions.mockResolvedValue([])
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

  test("analytics reports menu -> filters", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const userId = "user-1"
    const chatId = 500

    wizard.setState(userId, {
      step: "ANALYTICS_REPORTS_MENU",
      data: {},
      returnTo: "reports",
      lang: "uk",
    })

    await wizard.handleWizardInput(chatId, userId, t("uk", "buttons.filters"))

    const lastCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    expect(lastCall).toBeTruthy()
  })
})
