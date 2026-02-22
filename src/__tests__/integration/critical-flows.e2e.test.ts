import type { BotClient, TgTypes as Tg } from "@jilimb0/tgwrapper"
import { handleNLPCallback, handleNLPInput } from "../../handlers/voice-handler"
import { t } from "../../i18n"
import { TransactionType } from "../../types"
import { WizardManager } from "../../wizards/wizards"
import { MockBot } from "../helpers/mock-bot"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn().mockResolvedValue("USD"),
    getTopCategories: jest.fn().mockResolvedValue([]),
    getBalancesList: jest
      .fn()
      .mockResolvedValue([
        { accountId: "Card", amount: 1000, currency: "USD", lastUpdated: "" },
      ]),
    getCurrencyDenominations: jest.fn().mockReturnValue([5, 10, 20, 50]),
    addTransaction: jest.fn().mockResolvedValue("tx-critical-1"),
    getUserData: jest.fn().mockResolvedValue({
      balances: [],
      transactions: [],
      debts: [],
      goals: [],
      budgets: [],
      incomeSources: [],
      templates: [],
      defaultCurrency: "USD",
    }),
    getTransactionsPaginated: jest.fn().mockResolvedValue({
      transactions: [],
      total: 0,
      hasMore: false,
    }),
  },
}))

jest.mock("../../services/nlp-parser", () => ({
  nlpParser: {
    parse: jest.fn().mockReturnValue({
      amount: 25,
      type: "EXPENSE",
      category: "FOOD_DINING",
      description: "coffee",
      confidence: 0.95,
    }),
  },
}))

import { dbStorage } from "../../database/storage-db"

describe("E2E critical flows", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("add expense flow: amount -> category -> account", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const userId = "critical-user-expense"
    const chatId = 7001

    wizard.setState(userId, {
      step: "TX_AMOUNT",
      txType: TransactionType.EXPENSE,
      data: {},
      returnTo: "main",
      lang: "en",
    })

    await wizard.handleWizardInput(chatId, userId, "42")

    const amountStepCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    const categoryInline = amountStepCall?.[2]?.reply_markup
      ?.inline_keyboard as Array<Array<{ text: string }>>
    const chosenCategory = categoryInline?.flat()?.[0]?.text
    expect(chosenCategory).toBeDefined()
    if (!chosenCategory) throw new Error("Category button is missing")

    await wizard.handleWizardInput(chatId, userId, chosenCategory)

    const accountStepCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    expect(accountStepCall?.[2]?.reply_markup?.keyboard).toBeDefined()
  })

  test("add income flow: amount -> category -> account", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const userId = "critical-user-income"
    const chatId = 7002

    wizard.setState(userId, {
      step: "TX_AMOUNT",
      txType: TransactionType.INCOME,
      data: {},
      returnTo: "main",
      lang: "en",
    })

    await wizard.handleWizardInput(chatId, userId, "100")

    const amountStepCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    const categoryInline = amountStepCall?.[2]?.reply_markup
      ?.inline_keyboard as Array<Array<{ text: string }>>
    const chosenCategory = categoryInline?.flat()?.[0]?.text
    expect(chosenCategory).toBeDefined()
    if (!chosenCategory) throw new Error("Category button is missing")

    await wizard.handleWizardInput(chatId, userId, chosenCategory)

    const accountStepCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    expect(accountStepCall?.[2]?.reply_markup?.keyboard).toBeDefined()
  })

  test("voice message flow: NLP parse -> confirm -> save transaction", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const userId = "critical-user-voice"
    const chatId = 7003

    await handleNLPInput(bot, chatId, userId, "spent 25 coffee", wizard)

    const callbackQuery = {
      id: "critical-cb-voice",
      from: { id: 7003 },
      data: "nlp_confirm|25|EXPENSE|FOOD_DINING|coffee",
      message: { chat: { id: chatId }, message_id: 321 },
    } as unknown as Tg.CallbackQuery

    await handleNLPCallback(bot, callbackQuery, wizard)

    expect(dbStorage.addTransaction).toHaveBeenCalledWith(
      "7003",
      expect.objectContaining({
        amount: 25,
        type: TransactionType.EXPENSE,
        category: "FOOD_DINING",
      })
    )
    expect(bot.answerCallbackQuery).toHaveBeenCalled()
  })

  test("analytics flow: menu -> history and net worth", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    const userId = "critical-user-analytics"
    const chatId = 7004

    wizard.setState(userId, {
      step: "ANALYTICS_MENU",
      data: {},
      returnTo: "analytics",
      lang: "en",
    })

    await wizard.handleWizardInput(chatId, userId, t("en", "analytics.history"))
    expect(wizard.getState(userId)?.step).toBe("HISTORY_LIST")

    await wizard.goToStep(userId, "ANALYTICS_MENU", {})
    await wizard.handleWizardInput(
      chatId,
      userId,
      t("en", "analytics.netWorth")
    )
    expect(wizard.getState(userId)?.step).toBe("NET_WORTH_VIEW")
  })
})
