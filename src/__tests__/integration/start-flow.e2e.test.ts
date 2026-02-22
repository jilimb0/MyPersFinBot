import type { BotClient } from "@jilimb0/tgwrapper"
import { createMessageRouter } from "../../handlers/message"
import { t } from "../../i18n"
import { WizardManager } from "../../wizards/wizards"
import { MockRouterBot } from "../helpers/mock-bot"

jest.mock("../../security", () => ({
  securityCheck: jest.fn().mockResolvedValue(true),
}))

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn(),
    setUserLanguage: jest.fn(),
    getUserData: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetUserLanguage = dbStorage.getUserLanguage as jest.MockedFunction<
  typeof dbStorage.getUserLanguage
>
const mockGetUserData = dbStorage.getUserData as jest.MockedFunction<
  typeof dbStorage.getUserData
>

describe("E2E start flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUserLanguage.mockResolvedValue("uk")
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

  test("/start shows welcome for empty user", async () => {
    const bot = new MockRouterBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const router = createMessageRouter(bot, wizard)
    router.listen()

    await (bot as any).handlers.message({
      chat: { id: 1401 },
      text: "/start",
    })

    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("start tracking button responds with quick start", async () => {
    const bot = new MockRouterBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const router = createMessageRouter(bot, wizard)
    router.listen()

    const lang = "uk"
    await (bot as any).handlers.message({
      chat: { id: 1402 },
      text: t(lang, "buttons.startTracking"),
    })

    expect(bot.sendMessage).toHaveBeenCalled()
  })
})
