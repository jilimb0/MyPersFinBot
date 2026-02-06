import TelegramBot from "node-telegram-bot-api"
import { registerCallbackRouter } from "../../handlers/callback-router"
import { WizardManager } from "../../wizards/wizards"

jest.mock("../../handlers/reminder-callback-handlers", () => ({
  handleReminderSnooze: jest.fn(),
  handleReminderDone: jest.fn(),
}))

jest.mock("../../utils", () => ({
  safeAnswerCallback: jest.fn().mockResolvedValue(undefined),
}))

import {
  handleReminderDone,
  handleReminderSnooze,
} from "../../handlers/reminder-callback-handlers"
import { safeAnswerCallback } from "../../utils"

class MockBot {
  handlers: Record<string, (msg: any) => void> = {}
  on = jest.fn((event: string, handler: (msg: any) => void) => {
    this.handlers[event] = handler
  })
  sendMessage = jest.fn().mockResolvedValue({})
}

describe("Callback router", () => {
  test("routes tx_cat to wizard", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)
    const spy = jest.spyOn(wizard, "handleWizardInput")

    registerCallbackRouter(bot, wizard)

    await (bot as any).handlers.callback_query({
      id: "cb-1",
      data: "tx_cat|Food & dining 🍔",
      message: { chat: { id: 10 } },
    })

    expect(safeAnswerCallback).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(10, "10", "Food & dining 🍔")
  })

  test("routes reminder callbacks", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    const wizard = new WizardManager(bot)

    registerCallbackRouter(bot, wizard)

    await (bot as any).handlers.callback_query({
      id: "cb-2",
      data: "reminder_snooze|rem-1|1h",
      message: { chat: { id: 11 } },
    })

    await (bot as any).handlers.callback_query({
      id: "cb-3",
      data: "reminder_done|rem-2",
      message: { chat: { id: 12 } },
    })

    expect(handleReminderSnooze).toHaveBeenCalled()
    expect(handleReminderDone).toHaveBeenCalled()
  })
})
