import { randomUUID } from "node:crypto"
import type { Job } from "bull"
import { balanceService } from "../../database/services/balance.service"
import { dbStorage } from "../../database/storage-db"
import { type Language, t } from "../../i18n"
import logger from "../../logger"
import { TransactionType } from "../../types"
import { escapeMarkdown } from "../../utils"
import type { JobResult, RecurringTransactionJobData } from "../types"

/**
 * Calculate next execution date based on frequency
 */
function calculateNextExecutionDate(frequency: string): Date {
  const now = new Date()
  const next = new Date(now)

  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1)
      break
    case "WEEKLY":
      next.setDate(next.getDate() + 7)
      break
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1)
      break
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1)
      break
    default:
      // Default to monthly if unknown
      next.setMonth(next.getMonth() + 1)
  }

  return next
}

/**
 * Process recurring transaction job
 * Creates a new transaction based on recurring schedule
 */
export async function processRecurringTransaction(
  job: Job<RecurringTransactionJobData>
): Promise<JobResult> {
  const data = job.data
  const {
    userId,
    recurringTransactionId,
    amount,
    currency,
    type,
    category,
    description,
  } = data

  let lang: Language = "en"
  try {
    lang = await dbStorage.getUserLanguage(userId)
  } catch {
    lang = "en"
  }

  if (!category) {
    throw new Error(t(lang, "queue.recurring.missingCategory"))
  }

  try {
    logger.info("Processing recurring transaction", {
      userId,
      recurringTransactionId,
      type,
      amount,
    })

    // Check if recurring transaction still exists and is active
    const recurringTx = await dbStorage.getRecurringTransactionById(
      userId,
      recurringTransactionId
    )

    if (!recurringTx) {
      logger.warn("Recurring transaction not found", { recurringTransactionId })
      return {
        success: false,
        message: t(lang, "queue.recurring.notFound"),
      }
    }

    if (!recurringTx.isActive) {
      logger.info("Recurring transaction is inactive", {
        recurringTransactionId,
      })
      return {
        success: false,
        message: t(lang, "queue.recurring.inactive"),
      }
    }

    // For expenses and income, check account exists
    if (type === TransactionType.EXPENSE || type === TransactionType.INCOME) {
      const accountId =
        type === TransactionType.EXPENSE ? data.fromAccountId : data.toAccountId

      if (!accountId) {
        throw new Error(t(lang, "queue.recurring.accountRequired", { type }))
      }

      // Check balance exists
      const balance = await dbStorage.getBalance(userId, accountId, currency)
      if (!balance) {
        throw new Error(
          t(lang, "queue.recurring.balanceNotFound", {
            account: escapeMarkdown(accountId),
          })
        )
      }

      // For expenses, check sufficient funds
      if (type === TransactionType.EXPENSE && balance.amount < amount) {
        logger.warn("Insufficient funds for recurring expense", {
          userId,
          accountId,
          required: amount,
          available: balance.amount,
        })
        return {
          success: false,
          message: t(lang, "queue.recurring.insufficientFunds", {
            available: balance.amount,
            required: amount,
          }),
        }
      }
    }

    // Create transaction
    const transaction = await dbStorage.addTransaction(userId, {
      id: randomUUID(),
      type,
      amount,
      currency,
      category,
      description: `${description} ${t(lang, "queue.recurring.recurringSuffix")}`,
      fromAccountId: data.fromAccountId,
      toAccountId: data.toAccountId,
      date: new Date(),
    })

    // Update balance using balanceService for safety
    if (type === TransactionType.EXPENSE && data.fromAccountId) {
      await balanceService.safeUpdateBalance(
        userId,
        data.fromAccountId,
        -amount,
        currency
      )
    } else if (type === TransactionType.INCOME && data.toAccountId) {
      await balanceService.safeUpdateBalance(
        userId,
        data.toAccountId,
        amount,
        currency
      )
    } else if (
      type === TransactionType.TRANSFER &&
      data.fromAccountId &&
      data.toAccountId
    ) {
      await balanceService.safeTransfer(
        userId,
        data.fromAccountId,
        data.toAccountId,
        amount,
        currency,
        description
      )
    }

    // Calculate next execution date based on frequency
    const nextExecutionDate = calculateNextExecutionDate(recurringTx.frequency)

    // Update last executed timestamp
    await dbStorage.updateRecurringTransactionLastExecuted(
      userId,
      recurringTransactionId,
      nextExecutionDate
    )

    logger.info("Recurring transaction processed successfully", {
      userId,
      recurringTransactionId,
      transactionId: transaction,
      amount,
    })

    return {
      success: true,
      message: t(lang, "queue.recurring.created"),
      data: {
        transactionId: transaction,
        amount,
        type,
      },
    }
  } catch (error: any) {
    logger.error("Error processing recurring transaction", {
      userId,
      recurringTransactionId,
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
