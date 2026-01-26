/**
 * Queue module entry point
 */

import TelegramBot from "node-telegram-bot-api"
import { getQueueService } from "./queue.service"
import { JobName } from "./types"
import { processRecurringTransaction, processReminder } from "./processors"
import logger from "../logger"
import { dbStorage } from "../database/storage-db"

export * from "./queue.service"
export * from "./types"
export * from "./processors"

/**
 * Initialize queue with processors
 */
export async function initializeQueue(bot: TelegramBot): Promise<void> {
  const queueService = getQueueService()

  // Register recurring transaction processor
  queueService.registerProcessor(
    JobName.RECURRING_TRANSACTION,
    processRecurringTransaction,
    2 // Process 2 jobs concurrently
  )

  // Register reminder processor (needs bot instance)
  queueService.registerProcessor(
    JobName.REMINDER,
    async (job) => {
      return await processReminder(job, bot)
    },
    3 // Process 3 reminders concurrently
  )

  logger.info("Queue initialized with processors")
}

/**
 * Schedule recurring transaction
 * Converts frequency to cron expression
 */
export async function scheduleRecurringTransaction(
  recurringTransactionId: string,
  userId: string,
  data: any,
  frequency: "daily" | "weekly" | "monthly" | "yearly"
): Promise<void> {
  const queueService = getQueueService()

  // Convert frequency to cron
  const cronMap: Record<typeof frequency, string> = {
    daily: "0 9 * * *", // 9 AM every day
    weekly: "0 9 * * 1", // 9 AM every Monday
    monthly: "0 9 1 * *", // 9 AM on 1st of every month
    yearly: "0 9 1 1 *", // 9 AM on January 1st
  }

  const cron = cronMap[frequency]

  await dbStorage.updateRecurringTransactionCron(
    userId,
    recurringTransactionId,
    cron
  )

  await queueService.addRecurringJob(
    JobName.RECURRING_TRANSACTION,
    {
      recurringTransactionId,
      userId,
      ...data,
    },
    cron
  )

  logger.info("Recurring transaction scheduled", {
    recurringTransactionId,
    frequency,
    cron,
  })
}

/**
 * Schedule reminder
 */
export async function scheduleReminder(
  reminderId: string,
  userId: string,
  data: any,
  scheduledAt: Date
): Promise<void> {
  const queueService = getQueueService()
  const delayMs = scheduledAt.getTime() - Date.now()

  if (delayMs < 0) {
    logger.warn("Reminder scheduled in the past", {
      reminderId,
      scheduledAt,
    })
    return
  }

  await queueService.addDelayedJob(
    JobName.REMINDER,
    {
      reminderId,
      userId,
      ...data,
    },
    delayMs
  )

  logger.info("Reminder scheduled", {
    reminderId,
    scheduledAt,
    delayMs,
  })
}

/**
 * Cancel recurring transaction
 */
export async function cancelRecurringTransaction(
  recurringTransactionId: string,
  cron: string
): Promise<void> {
  const queueService = getQueueService()
  // Remove repeating job
  await queueService.removeRepeatingJob(JobName.RECURRING_TRANSACTION, { cron })
  logger.info("Recurring transaction cancelled", {
    recurringTransactionId,
    cron,
  })
}

/**
 * Cancel reminder
 */
export async function cancelReminder(reminderId: string): Promise<void> {
  const queueService = getQueueService()
  await queueService.removeJob(JobName.REMINDER, reminderId)
  logger.info("Reminder cancelled", { reminderId })
}
