import { Job } from "bull"
import TelegramBot from "node-telegram-bot-api"
import logger from "../../logger"
import { dbStorage } from "../../database/storage-db"
import { ReminderJobData, JobResult } from "../types"
import { Language, t } from "../../i18n"
import { formatDateDisplay } from "../../utils"

/**
 * Process reminder job
 * Sends reminder notification to user
 */
export async function processReminder(
  job: Job<ReminderJobData>,
  bot: TelegramBot
): Promise<JobResult> {
  const data = job.data
  const { userId, reminderId, type, title, message, entityId } = data

  try {
    logger.info("Processing reminder", {
      userId,
      reminderId,
      type,
    })

    // Check if reminder still exists
    const reminder = await dbStorage.getReminderById(userId, reminderId)

    if (!reminder) {
      logger.warn("Reminder not found", { reminderId })
      return {
        success: false,
        message: "Reminder not found",
      }
    }

    if (reminder.isProcessed) {
      logger.info("Reminder already processed", { reminderId })
      return {
        success: false,
        message: "Reminder already processed",
      }
    }

    let lang: Language = "en"
    try {
      lang = await dbStorage.getUserLanguage(userId)
    } catch {
      lang = "en"
    }

    // Build reminder message
    let fullMessage = `🔔 *${title}*\n\n${message}`

    // Add entity-specific information
    if (type === "debt" && entityId) {
      const debt = await dbStorage.getDebtById(userId, entityId)
      if (debt) {
        const remaining = debt.amount - debt.paidAmount
        fullMessage += `\n\n${t(lang, "reminders.details.remainingLine", {
          amount: remaining.toFixed(2),
          currency: debt.currency,
        })}`
        fullMessage += `\n${t(lang, "reminders.details.dueLine", {
          date: debt.dueDate
            ? formatDateDisplay(debt.dueDate)
            : t(lang, "common.notAvailable"),
        })}`
      }
    } else if (type === "goal" && entityId) {
      const goal = await dbStorage.getGoalById(userId, entityId)
      if (goal) {
        const progress = (goal.currentAmount / goal.targetAmount) * 100
        fullMessage += `\n\n${t(lang, "reminders.details.progressLine", {
          current: goal.currentAmount.toFixed(2),
          target: goal.targetAmount.toFixed(2),
          currency: goal.currency,
        })}`
        fullMessage += `\n${t(lang, "reminders.details.progressPercentLine", {
          percent: progress.toFixed(1),
        })}`
        fullMessage += `\n${t(lang, "reminders.details.deadlineLine", {
          date: goal.deadline
            ? formatDateDisplay(goal.deadline)
            : t(lang, "common.notAvailable"),
        })}`
      }
    }

    // Add action buttons
    const keyboard: TelegramBot.InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text: t(lang, "reminders.actions.snoozeHour"),
            callback_data: `reminder_snooze|${reminderId}|1h`,
          },
          {
            text: t(lang, "reminders.actions.snoozeTomorrow"),
            callback_data: `reminder_snooze|${reminderId}|1d`,
          },
        ],
        [
          {
            text: t(lang, "reminders.actions.done"),
            callback_data: `reminder_done|${reminderId}`,
          },
        ],
      ],
    }

    // Send notification
    await bot.sendMessage(userId, fullMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    })

    // Mark reminder as processed
    await dbStorage.updateReminderLastSent(userId, reminderId)

    logger.info("Reminder sent successfully", {
      userId,
      reminderId,
      type,
    })

    return {
      success: true,
      message: "Reminder sent successfully",
      data: {
        reminderId,
        type,
        sentAt: new Date().toISOString(),
      },
    }
  } catch (error: any) {
    logger.error("Error processing reminder", {
      userId,
      reminderId,
      error: error.message,
      stack: error.stack,
    })

    return {
      success: false,
      message: error.message,
      error: error.stack,
    }
  }
}
