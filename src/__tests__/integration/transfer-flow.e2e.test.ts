import type TelegramBot from "node-telegram-bot-api"
import { TransactionType } from "../../types"
import { WizardManager } from "../../wizards/wizards"
import { MockBot } from "../helpers/mock-bot"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getBalancesList: jest.fn(),
    getCurrencyDenominations: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetDefaultCurrency =
  dbStorage.getDefaultCurrency as jest.MockedFunction<
    typeof dbStorage.getDefaultCurrency
  >
const mockGetBalancesList = dbStorage.getBalancesList as jest.MockedFunction<
  typeof dbStorage.getBalancesList
>
const mockGetCurrencyDenominations =
  dbStorage.getCurrencyDenominations as jest.MockedFunction<
    typeof dbStorage.getCurrencyDenominations
  >

describe("E2E transfer flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDefaultCurrency.mockResolvedValue("USD")
    mockGetCurrencyDenominations.mockReturnValue([5, 10, 20])
    mockGetBalancesList.mockResolvedValue([
      {
        accountId: "Cash",
        amount: 100,
        currency: "USD",
        lastUpdated: "2026-01-01",
      },
      {
        accountId: "Card",
        amount: 50,
        currency: "USD",
        lastUpdated: "2026-01-01",
      },
    ])
  })

  test("amount -> from account selection", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    const userId = "user-1"
    const chatId = 103

    wizard.setState(userId, {
      step: "TX_AMOUNT",
      txType: TransactionType.TRANSFER,
      data: {},
      returnTo: "main",
      lang: "uk",
    })

    await wizard.handleWizardInput(chatId, userId, "20")

    const lastCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    const accountOptions = lastCall?.[2]
    expect(accountOptions.reply_markup.keyboard).toBeDefined()
  })
})
