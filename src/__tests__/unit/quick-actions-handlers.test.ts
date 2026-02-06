import TelegramBot from "node-telegram-bot-api"
import { QuickActionsHandlers } from "../../handlers/quick-actions-handlers"
import { TransactionType } from "../../types"
import type { Language } from "../../i18n"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getTopCategories: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetTopCategories = dbStorage.getTopCategories as jest.MockedFunction<
  typeof dbStorage.getTopCategories
>

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("QuickActionsHandlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("handleQuickCategory sends inline keyboard for top categories", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const userId = "user-1"
    const chatId = 123

    mockGetTopCategories.mockResolvedValue([])

    const state = {
      step: "TX_CATEGORY",
      txType: TransactionType.EXPENSE,
      data: {},
      lang: "uk" as Language,
    }

    const result = await QuickActionsHandlers.handleQuickCategory(
      bot,
      chatId,
      userId,
      "",
      state
    )

    expect(result.handled).toBe(true)
    expect(bot.sendMessage).toHaveBeenCalledTimes(1)

    const [, , options] = (bot.sendMessage as jest.Mock).mock.calls[0]
    expect(options.reply_markup.inline_keyboard).toBeDefined()

    const inline = options.reply_markup.inline_keyboard as Array<
      Array<{ text: string; callback_data: string }>
    >
    const flat = inline.flat()
    expect(flat.length).toBeGreaterThan(0)
    expect(flat[0]).toBeDefined()
    expect(flat[0]!.callback_data.startsWith("tx_cat|")).toBe(true)
  })

  test("showAllCategories sends inline keyboard for all categories", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const chatId = 456

    await QuickActionsHandlers.showAllCategories(
      bot,
      chatId,
      TransactionType.INCOME,
      "uk"
    )

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)

    const [, , options] = (bot.sendMessage as jest.Mock).mock.calls[0]
    expect(options.reply_markup.inline_keyboard).toBeDefined()

    const inline = options.reply_markup.inline_keyboard as Array<
      Array<{ text: string; callback_data: string }>
    >
    const flat = inline.flat()
    expect(flat.length).toBeGreaterThan(0)
    expect(flat[0]).toBeDefined()
    expect(flat[0]!.callback_data.startsWith("tx_cat|")).toBe(true)
  })
})
