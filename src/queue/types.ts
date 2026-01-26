/**
 * Queue job types and data structures
 */

import { Currency, TransactionCategory, TransactionType } from "../types"

/**
 * Job names
 */
export enum JobName {
  RECURRING_TRANSACTION = "recurring-transaction",
  REMINDER = "reminder",
  DEBT_PAYMENT = "debt-payment",
  GOAL_DEPOSIT = "goal-deposit",
  DATA_CLEANUP = "data-cleanup",
  CACHE_WARMUP = "cache-warmup",
}

/**
 * Recurring transaction job data
 */
export interface RecurringTransactionJobData {
  userId: string
  recurringTransactionId: string
  amount: number
  currency: Currency
  type: TransactionType
  category: TransactionCategory | null
  description: string
  fromAccountId?: string
  toAccountId?: string
}

/**
 * Reminder job data
 */
export interface ReminderJobData {
  userId: string
  reminderId: string
  type: "debt" | "goal" | "custom"
  title: string
  message: string
  entityId?: string // debt/goal ID
}

/**
 * Debt payment job data
 */
export interface DebtPaymentJobData {
  userId: string
  debtId: string
  amount: number
  currency: Currency
  accountId: string
  description: string
}

/**
 * Goal deposit job data
 */
export interface GoalDepositJobData {
  userId: string
  goalId: string
  amount: number
  currency: Currency
  accountId: string
  description: string
}

/**
 * Data cleanup job data
 */
export interface DataCleanupJobData {
  type: "old-transactions" | "expired-reminders" | "completed-goals"
  olderThanDays: number
}

/**
 * Cache warmup job data
 */
export interface CacheWarmupJobData {
  keys: string[]
}

/**
 * Union type for all job data
 */
export type JobData =
  | RecurringTransactionJobData
  | ReminderJobData
  | DebtPaymentJobData
  | GoalDepositJobData
  | DataCleanupJobData
  | CacheWarmupJobData

/**
 * Job options
 */
export interface QueueJobOptions {
  attempts?: number
  backoff?: {
    type: "exponential" | "fixed"
    delay: number
  }
  delay?: number
  priority?: number
  removeOnComplete?: boolean | number
  removeOnFail?: boolean | number
  repeat?:
    | {
        cron?: string
        limit?: number
      }
    | {
        every?: number
        limit?: number
      }
}

/**
 * Job result
 */
export interface JobResult {
  success: boolean
  message?: string

  data?: any
  error?: string
}
