import { Job } from "bull"
import TelegramBot from "node-telegram-bot-api"
import logger from "../../logger"
import { dbStorage } from "../../database/storage-db"
import { ReminderJobData, JobResult } from "../types"

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

    // Build reminder message
    let fullMessage = `🔔 *${title}*\n\n${message}`

    // Add entity-specific information
    if (type === "debt" && entityId) {
      const debt = await dbStorage.getDebtById(userId, entityId)
      if (debt) {
        const remaining = debt.amount - debt.paidAmount
        fullMessage += `\n\n💰 Осталось: ${remaining.toFixed(2)} ${debt.currency}`
        fullMessage += `\n📅 Срок: ${debt.dueDate ? new Date(debt.dueDate).toLocaleDateString() : "Не указан"}`
      }
    } else if (type === "goal" && entityId) {
      const goal = await dbStorage.getGoalById(userId, entityId)
      if (goal) {
        const progress = (goal.currentAmount / goal.targetAmount) * 100
        fullMessage += `\n\n💰 Прогресс: ${goal.currentAmount.toFixed(2)} / ${goal.targetAmount.toFixed(2)} ${goal.currency}`
        fullMessage += `\n📊 ${progress.toFixed(1)}%`
        fullMessage += `\n📅 Срок: ${goal.deadline ? new Date(goal.deadline).toLocaleDateString() : "Не указан"}`
      }
    }

    // Add action buttons
    const keyboard: TelegramBot.InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text: "⏰ Напомнить через 1 час",
            callback_data: `reminder_snooze|${reminderId}|1h`,
          },
          {
            text: "📅 Напомнить завтра",
            callback_data: `reminder_snooze|${reminderId}|1d`,
          },
        ],
        [
          {
            text: "✅ Выполнено",
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
