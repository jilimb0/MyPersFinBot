import type TelegramBot from "node-telegram-bot-api"
import { TransactionType } from "../../types"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getTopCategories: jest.fn(),
    getBalancesList: jest.fn(),
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
const mockGetBalancesList = dbStorage.getBalancesList as jest.MockedFunction<
  typeof dbStorage.getBalancesList
>
const mockGetCurrencyDenominations =
  dbStorage.getCurrencyDenominations as jest.MockedFunction<
    typeof dbStorage.getCurrencyDenominations
  >

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("E2E income flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDefaultCurrency.mockResolvedValue("USD")
    mockGetTopCategories.mockResolvedValue([])
    mockGetBalancesList.mockResolvedValue([
      {
        accountId: "Cash",
        amount: 0,
        currency: "USD",
        lastUpdated: "2026-01-01",
      },
    ])
    mockGetCurrencyDenominations.mockReturnValue([5, 10, 20])
  })

  test("amount -> category -> account selection", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    const userId = "user-1"
    const chatId = 102

    wizard.setState(userId, {
      step: "TX_AMOUNT",
      txType: TransactionType.INCOME,
      data: {},
      returnTo: "main",
      lang: "uk",
    })

    await wizard.handleWizardInput(chatId, userId, "100")

    const lastCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    const categoryOptions = lastCall?.[2]
    expect(categoryOptions.reply_markup.inline_keyboard).toBeDefined()

    const inline = categoryOptions.reply_markup.inline_keyboard as Array<
      Array<{ text: string; callback_data: string }>
    >
    const chosen = inline.flat()[0]
    expect(chosen).toBeDefined()

    await wizard.handleWizardInput(chatId, userId, chosen!.text)

    const afterCategoryCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    const accountOptions = afterCategoryCall?.[2]
    expect(accountOptions.reply_markup.keyboard).toBeDefined()
  })
})
