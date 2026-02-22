import type TelegramBot from "@telegram-api"
import { handleTxAmount } from "../../handlers/transaction-handlers"
import { TransactionType } from "../../types"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getTopCategories: jest.fn(),
    getTopTransactionAmounts: jest.fn(),
    getCurrencyDenominations: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetDefaultCurrency =
  dbStorage.getDefaultCurrency as jest.MockedFunction<
    typeof dbStorage.getDefaultCurrency
  >
const mockGetTopCategories = dbStorage.getTopCategories as jest.MockedFunction<
  typeof dbStorage.getTopCategories
>

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("Transaction handlers - Expense flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDefaultCurrency.mockResolvedValue("USD")
    mockGetTopCategories.mockResolvedValue([])
  })

  test("handleTxAmount triggers category prompt with inline keyboard", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    const userId = "user-123"
    const chatId = 1001

    wizard.setState(userId, {
      step: "TX_AMOUNT",
      txType: TransactionType.EXPENSE,
      data: {},
      returnTo: "main",
      lang: "uk",
    })

    const handled = await handleTxAmount(wizard, chatId, userId, "50")

    expect(handled).toBe(true)
    expect(bot.sendMessage).toHaveBeenCalled()

    const lastCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    expect(lastCall).toBeTruthy()

    const options = lastCall?.[2]
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
