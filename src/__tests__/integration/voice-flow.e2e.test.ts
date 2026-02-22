import type TelegramBot from "node-telegram-bot-api"
import { handleNLPCallback, handleNLPInput } from "../../handlers/voice-handler"
import { TransactionType } from "../../types"
import { WizardManager } from "../../wizards/wizards"
import { MockBot } from "../helpers/mock-bot"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn().mockResolvedValue("USD"),
    getBalancesList: jest
      .fn()
      .mockResolvedValue([
        { accountId: "Card", amount: 1000, currency: "USD", lastUpdated: "" },
      ]),
    addTransaction: jest.fn().mockResolvedValue("tx-voice-1"),
  },
}))

jest.mock("../../services/nlp-parser", () => ({
  nlpParser: {
    parse: jest.fn().mockReturnValue({
      amount: 15,
      type: "EXPENSE",
      category: "FOOD_DINING",
      description: "coffee",
      confidence: 0.91,
    }),
  },
}))

import { dbStorage } from "../../database/storage-db"

describe("E2E voice flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("voice NLP confirm saves expense transaction", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const userId = "501"
    const chatId = 501

    wizard.setState(userId, {
      step: "TX_AMOUNT",
      txType: TransactionType.EXPENSE,
      data: {},
      returnTo: "main",
      lang: "en",
    })

    await handleNLPInput(bot, chatId, userId, "spent 15 coffee", wizard)

    const sendCall = (bot.sendMessage as jest.Mock).mock.calls.at(-1)
    expect(sendCall).toBeDefined()
    expect(sendCall?.[2]?.reply_markup?.inline_keyboard).toBeDefined()

    const callbackQuery = {
      id: "cb1",
      from: { id: 501 },
      data: "nlp_confirm|15|EXPENSE|FOOD_DINING|coffee",
      message: { chat: { id: chatId }, message_id: 777 },
    } as unknown as TelegramBot.CallbackQuery

    await handleNLPCallback(bot, callbackQuery, wizard)

    expect(dbStorage.addTransaction).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        amount: 15,
        type: TransactionType.EXPENSE,
        category: "FOOD_DINING",
        fromAccountId: "Card",
      })
    )
    expect(bot.editMessageText).toHaveBeenCalled()
    expect(bot.answerCallbackQuery).toHaveBeenCalled()
  })
})
