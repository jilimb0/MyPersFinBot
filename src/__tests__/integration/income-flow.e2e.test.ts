import type { BotClient } from "@jilimb0/tgwrapper"
import { TransactionType } from "../../types"
import { WizardManager } from "../../wizards/wizards"
import { setupExpenseIncomeFixtures } from "../helpers/e2e-fixtures"
import { MockBot } from "../helpers/mock-bot"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getTopCategories: jest.fn(),
    getBalancesList: jest.fn(),
    getCurrencyDenominations: jest.fn(),
  },
}))

describe("E2E income flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupExpenseIncomeFixtures(0)
  })

  test("amount -> category -> account selection", async () => {
    const bot = new MockBot() as unknown as BotClient
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
