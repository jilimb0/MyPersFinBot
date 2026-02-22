import type TelegramBot from "@telegram-api"
import { dbStorage as db } from "../database/storage-db"
import { type Language, resolveLanguage, t } from "../i18n"
import { reminderManager } from "../services/reminder-manager"
import { safeAnswerCallback } from "../utils"

async function resolveLang(userId: string): Promise<Language> {
  try {
    const lang = await db.getUserLanguage(userId)
    return resolveLanguage(lang)
  } catch {
    return "en"
  }
}

export async function handleReminderSnooze(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  userId: string,
  chatId: number,
  data: string
) {
  const lang = await resolveLang(userId)
  const parts = data.split("|")
  const reminderId = parts[1]
  const duration = parts[2] as "1h" | "1d"

  if (!reminderId || !duration) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "errors.failedSnoozeReminder"),
      show_alert: true,
    })
    return
  }

  const success = await reminderManager.snoozeReminder(reminderId, duration)

  if (success) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "common.done"),
      show_alert: false,
    })

    if (query.message) {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        }
      )
    }
  } else {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "errors.failedSnoozeReminder"),
      show_alert: true,
    })
  }
}

export async function handleReminderDone(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  userId: string,
  chatId: number,
  data: string
) {
  const lang = await resolveLang(userId)
  const reminderId = data.replace("reminder_done|", "")

  if (!reminderId) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "errors.failedMarkReminderDone"),
      show_alert: true,
    })
    return
  }

  const success = await reminderManager.completeReminder(reminderId)

  if (success) {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "success.reminderMarkedDone"),
      show_alert: false,
    })

    if (query.message) {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: chatId,
          message_id: query.message.message_id,
        }
      )
    }
  } else {
    await safeAnswerCallback(bot, {
      callback_query_id: query.id,
      text: t(lang, "errors.failedMarkReminderDone"),
      show_alert: true,
    })
  }
}
