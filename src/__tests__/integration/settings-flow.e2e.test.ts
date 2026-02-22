import type TelegramBot from "node-telegram-bot-api"
import { createMessageRouter } from "../../handlers/message"
import { t } from "../../i18n"
import { WizardManager } from "../../wizards/wizards"
import { MockRouterBot } from "../helpers/mock-bot"

jest.mock("../../security", () => ({
  securityCheck: jest.fn().mockResolvedValue(true),
}))

jest.mock("../../handlers", () => ({
  handleNotificationsMenu: jest.fn().mockResolvedValue(true),
  handleRecurringMenu: jest.fn().mockResolvedValue(true),
  handleCustomMessagesMenu: jest.fn().mockResolvedValue(true),
}))

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn(),
    getDefaultCurrency: jest.fn(),
    getBalancesList: jest.fn(),
    setDefaultCurrency: jest.fn(),
    convertAllBalancesToCurrency: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetUserLanguage = dbStorage.getUserLanguage as jest.MockedFunction<
  typeof dbStorage.getUserLanguage
>
const mockGetDefaultCurrency =
  dbStorage.getDefaultCurrency as jest.MockedFunction<
    typeof dbStorage.getDefaultCurrency
  >
const mockGetBalancesList = dbStorage.getBalancesList as jest.MockedFunction<
  typeof dbStorage.getBalancesList
>
const mockSetDefaultCurrency =
  dbStorage.setDefaultCurrency as jest.MockedFunction<
    typeof dbStorage.setDefaultCurrency
  >
const mockConvertAllBalancesToCurrency =
  dbStorage.convertAllBalancesToCurrency as jest.MockedFunction<
    typeof dbStorage.convertAllBalancesToCurrency
  >

describe("E2E settings flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUserLanguage.mockResolvedValue("uk")
    mockGetDefaultCurrency.mockResolvedValue("USD")
    mockGetBalancesList.mockResolvedValue([
      {
        accountId: "Cash",
        amount: 100,
        currency: "USD",
        lastUpdated: new Date().toISOString(),
      },
    ])
  })

  test("settings -> change currency -> confirm -> execute", async () => {
    const bot = new MockRouterBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const router = createMessageRouter(bot, wizard)
    router.listen()

    const chatId = 601
    const lang = "uk"

    await (bot as any).handlers.message({
      chat: { id: chatId },
      text: t(lang, "mainMenu.settings"),
    })

    await (bot as any).handlers.message({
      chat: { id: chatId },
      text: t(lang, "settings.changeCurrency"),
    })

    let state = wizard.getState(chatId.toString())
    expect(state?.step).toBe("CURRENCY_SELECT")

    await (bot as any).handlers.message({
      chat: { id: chatId },
      text: t(lang, "settings.currencyOptions.eur"),
    })

    state = wizard.getState(chatId.toString())
    expect(state?.step).toBe("SETTINGS_CURRENCY_CONFIRM")

    await (bot as any).handlers.message({
      chat: { id: chatId },
      text: t(lang, "settings.yesChange"),
    })

    expect(mockSetDefaultCurrency).toHaveBeenCalledWith(
      chatId.toString(),
      "EUR"
    )
    expect(mockConvertAllBalancesToCurrency).toHaveBeenCalledWith(
      chatId.toString(),
      "EUR"
    )
  })

  test("settings -> notifications opens menu state", async () => {
    const bot = new MockRouterBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const router = createMessageRouter(bot, wizard)
    router.listen()

    const chatId = 602
    const lang = "uk"

    await (bot as any).handlers.message({
      chat: { id: chatId },
      text: t(lang, "settings.notifications"),
    })

    const state = wizard.getState(chatId.toString())
    expect(state?.step).toBe("NOTIFICATIONS_MENU")
  })
})
