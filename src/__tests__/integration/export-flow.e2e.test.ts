import TelegramBot from "node-telegram-bot-api"
import { WizardManager } from "../../wizards/wizards"
import { TransactionType } from "../../types"
import { t } from "../../i18n"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getBalancesList: jest.fn(),
    getCurrencyDenominations: jest.fn(),
    getTransactions: jest.fn(),
    getUserData: jest.fn(),
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
const mockGetTransactions = dbStorage.getTransactions as jest.MockedFunction<
  typeof dbStorage.getTransactions
>
const mockGetUserData = dbStorage.getUserData as jest.MockedFunction<
  typeof dbStorage.getUserData
>

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("E2E export flow", () => {
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
    ])
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

  test("analytics reports menu -> export csv", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    const userId = "user-1"
    const chatId = 200

    wizard.setState(userId, {
      step: "ANALYTICS_MENU",
      data: {},
      returnTo: "analytics",
      lang: "uk",
    })

    await wizard.handleWizardInput(chatId, userId, t("uk", "analytics.reports"))

    const lastCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    expect(lastCall).toBeTruthy()

    // Ensure reports menu was rendered
    const options = lastCall?.[2]
    expect(
      options.reply_markup?.keyboard || options.reply_markup?.inline_keyboard
    ).toBeDefined()
  })

  test("export flow handles empty transactions", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    const userId = "user-1"
    const chatId = 201

    wizard.setState(userId, {
      step: "ANALYTICS_REPORTS_MENU",
      data: {},
      returnTo: "reports",
      lang: "uk",
    })

    await wizard.handleWizardInput(
      chatId,
      userId,
      t("uk", "analytics.exportCSV")
    )

    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("export flow ignores when not in reports menu", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    const userId = "user-1"
    const chatId = 202

    wizard.setState(userId, {
      step: "TX_AMOUNT",
      txType: TransactionType.EXPENSE,
      data: {},
      returnTo: "main",
      lang: "uk",
    })

    const handled = await wizard.handleWizardInput(
      chatId,
      userId,
      t("uk", "analytics.exportCSV")
    )
    expect(handled).toBe(true)
  })
})
