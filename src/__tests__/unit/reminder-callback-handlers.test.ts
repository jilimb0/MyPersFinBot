import type TelegramBot from "node-telegram-bot-api"
import {
  handleReminderDone,
  handleReminderSnooze,
} from "../../handlers/reminder-callback-handlers"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn().mockResolvedValue("en"),
  },
}))

jest.mock("../../services/reminder-manager", () => ({
  reminderManager: {
    snoozeReminder: jest.fn(),
    completeReminder: jest.fn(),
  },
}))

jest.mock("../../utils", () => ({
  safeAnswerCallback: jest.fn().mockResolvedValue(undefined),
}))

import { reminderManager } from "../../services/reminder-manager"
import { safeAnswerCallback } from "../../utils"

const mockSnooze = reminderManager.snoozeReminder as jest.MockedFunction<
  typeof reminderManager.snoozeReminder
>
const mockComplete = reminderManager.completeReminder as jest.MockedFunction<
  typeof reminderManager.completeReminder
>

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
  editMessageReplyMarkup = jest.fn().mockResolvedValue({})
}

describe("Reminder callback handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("handleReminderSnooze marks reminder and clears buttons", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    mockSnooze.mockResolvedValue(true)

    await handleReminderSnooze(
      bot,
      {
        id: "cb-1",
        data: "reminder_snooze|rem-1|1h",
        message: { message_id: 10, chat: { id: 100 } },
      } as TelegramBot.CallbackQuery,
      "100",
      100,
      "reminder_snooze|rem-1|1h"
    )

    expect(mockSnooze).toHaveBeenCalledWith("rem-1", "1h")
    expect(safeAnswerCallback).toHaveBeenCalled()
    expect(bot.editMessageReplyMarkup).toHaveBeenCalled()
  })

  test("handleReminderDone completes reminder and clears buttons", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    mockComplete.mockResolvedValue(true)

    await handleReminderDone(
      bot,
      {
        id: "cb-2",
        data: "reminder_done|rem-2",
        message: { message_id: 11, chat: { id: 101 } },
      } as TelegramBot.CallbackQuery,
      "101",
      101,
      "reminder_done|rem-2"
    )

    expect(mockComplete).toHaveBeenCalledWith("rem-2")
    expect(safeAnswerCallback).toHaveBeenCalled()
    expect(bot.editMessageReplyMarkup).toHaveBeenCalled()
  })
})
