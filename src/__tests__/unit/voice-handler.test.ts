import type TelegramBot from "node-telegram-bot-api"
import { dbStorage } from "../../database/storage-db"
import { nlpParser } from "../../services/nlp-parser"

jest.mock("../../services/nlp-parser", () => ({
  nlpParser: {
    parse: jest.fn(),
  },
}))

jest.mock("../../services/assemblyai-service", () => ({
  assemblyAIService: {
    isAvailable: jest.fn(),
    transcribeFile: jest.fn(),
  },
}))

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getBalancesList: jest.fn(),
    addTransaction: jest.fn(),
  },
}))

jest.mock("axios")

jest.mock("fs", () => ({
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  existsSync: jest.fn(),
  statSync: jest.fn(),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn(),
}))

jest.mock("../../logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock("child_process", () => ({
  exec: jest.fn(),
}))

process.env.TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || "test-token-000000000000"

jest.mock("../../reports", () => ({}))

jest.mock("../../wizards/wizards", () => ({
  WizardManager: class MockWizardManager {
    getState() {
      return { lang: "en" }
    }
    clearState() {}
  },
}))

import * as voiceHandlers from "../../handlers/voice-handler"
import { WizardManager } from "../../wizards/wizards"

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
  editMessageText = jest.fn().mockResolvedValue({})
  answerCallbackQuery = jest.fn().mockResolvedValue({})
  getFileLink = jest.fn().mockResolvedValue("http://file")
}

describe("voice handler", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("handleNLPInput invalid/valid", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    ;(dbStorage.getDefaultCurrency as jest.Mock).mockResolvedValue("USD")
    ;(nlpParser.parse as jest.Mock).mockReturnValue(null)
    await voiceHandlers.handleNLPInput(bot, 1, "u1", "bad", wizard)
    ;(nlpParser.parse as jest.Mock).mockReturnValue({
      amount: 10,
      type: "EXPENSE",
      category: "FOOD_DINING",
      description: "coffee",
      confidence: 0.9,
    })
    await voiceHandlers.handleNLPInput(bot, 1, "u1", "ok", wizard)

    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("handleNLPCallback cancel / confirm / edit / set cat", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    // cancel
    await voiceHandlers.handleNLPCallback(
      bot,
      {
        id: "q1",
        from: { id: 1 } as any,
        data: "nlp_cancel",
        message: { chat: { id: 1 }, message_id: 10 } as any,
      } as any,
      wizard
    )

    // confirm with no balances
    ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValueOnce([])
    await voiceHandlers.handleNLPCallback(
      bot,
      {
        id: "q2",
        from: { id: 1 } as any,
        data: "nlp_confirm|10|EXPENSE|FOOD_DINING|coffee",
        message: { chat: { id: 1 }, message_id: 11 } as any,
      } as any,
      wizard
    )

    expect(dbStorage.addTransaction).not.toHaveBeenCalled()

    // confirm with balances
    ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValueOnce([
      { accountId: "Cash" },
    ])
    ;(dbStorage.getDefaultCurrency as jest.Mock).mockResolvedValueOnce("USD")

    await voiceHandlers.handleNLPCallback(
      bot,
      {
        id: "q3",
        from: { id: 1 } as any,
        data: "nlp_confirm|10|EXPENSE|FOOD_DINING|coffee",
        message: { chat: { id: 1 }, message_id: 12 } as any,
      } as any,
      wizard
    )
    expect(dbStorage.addTransaction).toHaveBeenCalled()

    // edit category
    await voiceHandlers.handleNLPCallback(
      bot,
      {
        id: "q4",
        from: { id: 1 } as any,
        data: "nlp_edit_category|10|EXPENSE|coffee",
        message: { chat: { id: 1 }, message_id: 13 } as any,
      } as any,
      wizard
    )

    // set category (routes to confirm)
    ;(dbStorage.getBalancesList as jest.Mock).mockResolvedValueOnce([
      { accountId: "Cash" },
    ])
    ;(dbStorage.getDefaultCurrency as jest.Mock).mockResolvedValueOnce("USD")
    await voiceHandlers.handleNLPCallback(
      bot,
      {
        id: "q5",
        from: { id: 1 } as any,
        data: "nlp_set_cat|10|EXPENSE|Food|coffee",
        message: { chat: { id: 1 }, message_id: 14 } as any,
      } as any,
      wizard
    )

    expect(dbStorage.addTransaction).toHaveBeenCalledTimes(2)
    expect(bot.answerCallbackQuery).toHaveBeenCalled()
  })

  test("handleVoiceMessage early return if no voice", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    await voiceHandlers.handleVoiceMessage(
      bot,
      { chat: { id: 1 } } as any,
      wizard
    )
  })
})
