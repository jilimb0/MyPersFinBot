import { dbStorage } from "../../database/storage-db"
import {
  handleReminderDone,
  handleReminderSnooze,
} from "../../handlers/reminder-callback-handlers"
import { reminderManager } from "../../services/reminder-manager"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn().mockResolvedValue("en"),
  },
}))

jest.mock("../../services/reminder-manager", () => ({
  reminderManager: {
    snoozeReminder: jest.fn().mockResolvedValue(true),
    completeReminder: jest.fn().mockResolvedValue(true),
  },
}))

describe("Reminder Callback Handlers - Branch Coverage", () => {
  let bot: any
  const userId = "user123"
  const chatId = 12345

  beforeEach(() => {
    jest.clearAllMocks()
    bot = {
      answerCallbackQuery: jest.fn().mockResolvedValue(true),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(true),
    }
  })

  describe("handleReminderSnooze", () => {
    const query: any = {
      id: "query123",
      message: {
        message_id: 456,
      },
    }

    it("should handle missing reminderId", async () => {
      await handleReminderSnooze(
        bot,
        query,
        userId,
        chatId,
        "reminder_snooze|" // Missing reminderId
      )

      expect(bot.answerCallbackQuery).toHaveBeenCalledWith(
        "query123",
        expect.objectContaining({
          show_alert: true,
        })
      )
    })

    it("should handle missing duration", async () => {
      await handleReminderSnooze(
        bot,
        query,
        userId,
        chatId,
        "reminder_snooze|rem123|" // Missing duration
      )

      expect(bot.answerCallbackQuery).toHaveBeenCalledWith(
        "query123",
        expect.objectContaining({
          show_alert: true,
        })
      )
    })

    it("should handle snooze failure", async () => {
      ;(reminderManager.snoozeReminder as jest.Mock).mockResolvedValueOnce(
        false
      )

      await handleReminderSnooze(
        bot,
        query,
        userId,
        chatId,
        "reminder_snooze|rem123|1h"
      )

      expect(bot.answerCallbackQuery).toHaveBeenCalledWith(
        "query123",
        expect.objectContaining({
          show_alert: true,
        })
      )
    })

    it("should handle successful snooze", async () => {
      await handleReminderSnooze(
        bot,
        query,
        userId,
        chatId,
        "reminder_snooze|rem123|1h"
      )

      expect(reminderManager.snoozeReminder).toHaveBeenCalledWith(
        "rem123",
        "1h"
      )
      expect(bot.answerCallbackQuery).toHaveBeenCalledWith(
        "query123",
        expect.objectContaining({
          show_alert: false,
        })
      )
      expect(bot.editMessageReplyMarkup).toHaveBeenCalled()
    })

    it("should handle snooze without message", async () => {
      const queryNoMsg = { ...query, message: undefined }

      await handleReminderSnooze(
        bot,
        queryNoMsg,
        userId,
        chatId,
        "reminder_snooze|rem123|1d"
      )

      expect(bot.answerCallbackQuery).toHaveBeenCalled()
      expect(bot.editMessageReplyMarkup).not.toHaveBeenCalled()
    })

    it("should handle getUserLanguage error", async () => {
      ;(dbStorage.getUserLanguage as jest.Mock).mockRejectedValueOnce(
        new Error("DB error")
      )

      await handleReminderSnooze(
        bot,
        query,
        userId,
        chatId,
        "reminder_snooze|rem123|1h"
      )

      // Should fallback to "en" and continue
      expect(bot.answerCallbackQuery).toHaveBeenCalled()
    })
  })

  describe("handleReminderDone", () => {
    const query: any = {
      id: "query123",
      message: {
        message_id: 456,
      },
    }

    it("should handle missing reminderId", async () => {
      await handleReminderDone(
        bot,
        query,
        userId,
        chatId,
        "reminder_done|" // Missing reminderId
      )

      expect(bot.answerCallbackQuery).toHaveBeenCalledWith(
        "query123",
        expect.objectContaining({
          show_alert: true,
        })
      )
    })

    it("should handle complete failure", async () => {
      ;(reminderManager.completeReminder as jest.Mock).mockResolvedValueOnce(
        false
      )

      await handleReminderDone(
        bot,
        query,
        userId,
        chatId,
        "reminder_done|rem123"
      )

      expect(bot.answerCallbackQuery).toHaveBeenCalledWith(
        "query123",
        expect.objectContaining({
          show_alert: true,
        })
      )
    })

    it("should handle successful complete", async () => {
      await handleReminderDone(
        bot,
        query,
        userId,
        chatId,
        "reminder_done|rem123"
      )

      expect(reminderManager.completeReminder).toHaveBeenCalledWith("rem123")
      expect(bot.answerCallbackQuery).toHaveBeenCalledWith(
        "query123",
        expect.objectContaining({
          show_alert: false,
        })
      )
      expect(bot.editMessageReplyMarkup).toHaveBeenCalled()
    })

    it("should handle done without message", async () => {
      const queryNoMsg = { ...query, message: undefined }

      await handleReminderDone(
        bot,
        queryNoMsg,
        userId,
        chatId,
        "reminder_done|rem123"
      )

      expect(bot.answerCallbackQuery).toHaveBeenCalled()
      expect(bot.editMessageReplyMarkup).not.toHaveBeenCalled()
    })

    it("should handle getUserLanguage error in done", async () => {
      ;(dbStorage.getUserLanguage as jest.Mock).mockRejectedValueOnce(
        new Error("DB error")
      )

      await handleReminderDone(
        bot,
        query,
        userId,
        chatId,
        "reminder_done|rem123"
      )

      // Should fallback to "en" and continue
      expect(bot.answerCallbackQuery).toHaveBeenCalled()
    })
  })
})
