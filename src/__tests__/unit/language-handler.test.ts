import TelegramBot from "node-telegram-bot-api"
import {
  handleLanguageSelection,
  showLanguageMenu,
} from "../../handlers/language-handler"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn(),
    setUserLanguage: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetUserLanguage = dbStorage.getUserLanguage as jest.MockedFunction<
  typeof dbStorage.getUserLanguage
>
const mockSetUserLanguage = dbStorage.setUserLanguage as jest.MockedFunction<
  typeof dbStorage.setUserLanguage
>

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("Language handler", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUserLanguage.mockResolvedValue("en")
  })

  test("showLanguageMenu uses current language", async () => {
    const bot = new MockBot() as unknown as TelegramBot

    await showLanguageMenu(bot, 123, "user-1")

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    const [, message, options] = (bot.sendMessage as jest.Mock).mock.calls[0]
    expect(message).toContain("English")
    expect(options.reply_markup?.keyboard).toBeDefined()
  })

  test("handleLanguageSelection persists new language", async () => {
    const bot = new MockBot() as unknown as TelegramBot

    const handled = await handleLanguageSelection(
      bot,
      123,
      "user-1",
      "🇺🇦 Українська"
    )

    expect(handled).toBe(true)
    expect(mockSetUserLanguage).toHaveBeenCalledWith("user-1", "uk")
    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
  })
})
