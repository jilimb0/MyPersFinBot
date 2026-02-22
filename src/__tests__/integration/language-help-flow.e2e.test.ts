import type TelegramBot from "node-telegram-bot-api"
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
const mockSetUserLanguage = dbStorage.setUserLanguage as jest.MockedFunction<
  typeof dbStorage.setUserLanguage
>
const mockGetUserData = dbStorage.getUserData as jest.MockedFunction<
  typeof dbStorage.getUserData
>

describe("E2E language/help flow", () => {
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

  test("language menu -> select UA updates language", async () => {
    const bot = new MockRouterBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const router = createMessageRouter(bot, wizard)
    router.listen()

    const chatId = 1301
    const lang = "uk"

    await (bot as any).handlers.message({
      chat: { id: chatId },
      text: t(lang, "settings.language"),
    })

    await (bot as any).handlers.message({
      chat: { id: chatId },
      text: "🇺🇦 Українська",
    })

    expect(mockSetUserLanguage).toHaveBeenCalledWith(chatId.toString(), "uk")
  })

  test("help menu opens view state", async () => {
    const bot = new MockRouterBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const router = createMessageRouter(bot, wizard)
    router.listen()

    const chatId = 1302
    const lang = "uk"

    await (bot as any).handlers.message({
      chat: { id: chatId },
      text: t(lang, "settings.help"),
    })

    const state = wizard.getState(chatId.toString())
    expect(state?.step).toBe("HELP_VIEW")
  })
})
