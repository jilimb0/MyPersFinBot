import type { BotClient } from "@jilimb0/tgwrapper"
import { getExpenseCategoryLabel } from "../../i18n"
import { ExpenseCategory } from "../../types"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../security", () => ({
  securityCheck: jest.fn().mockResolvedValue(true),
}))

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn().mockResolvedValue("en"),
  },
}))

class MockBot {
  handlers: Record<string, (msg: any) => void> = {}
  on = jest.fn((event: string, handler: (msg: any) => void) => {
    this.handlers[event] = handler
  })
  sendMessage = jest.fn().mockResolvedValue({})
  answerCallbackQuery = jest.fn().mockResolvedValue({})
}

jest.mock("../../utils", () => ({
  safeAnswerCallback: jest.fn().mockResolvedValue(undefined),
}))

import { safeAnswerCallback } from "../../utils"

// Inline recreation of the callback handler registered in src/index.ts
function registerTxCatCallback(bot: BotClient, wizardManager: WizardManager) {
  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id
    if (!chatId) return
    const userId = chatId.toString()
    const data = query.data || ""

    if (data.startsWith("tx_cat|")) {
      const category = data.replace("tx_cat|", "")
      await safeAnswerCallback(bot, { callback_query_id: query.id })
      await wizardManager.handleWizardInput(chatId, userId, category)
    }
  })
}

describe("Callback query tx_cat handler", () => {
  test("routes category selection into wizard", async () => {
    const bot = new MockBot() as unknown as BotClient
    const wizard = new WizardManager(bot)

    const handleWizardInput = jest.spyOn(wizard, "handleWizardInput")
    registerTxCatCallback(bot, wizard)

    const label = getExpenseCategoryLabel(
      "en",
      ExpenseCategory.FOOD_DINING,
      "short"
    )

    await (bot as any).handlers.callback_query({
      id: "cb-1",
      data: `tx_cat|${label}`,
      message: { chat: { id: 10 } },
    })

    expect(safeAnswerCallback).toHaveBeenCalled()
    expect(handleWizardInput).toHaveBeenCalledWith(10, "10", label)
  })
})
