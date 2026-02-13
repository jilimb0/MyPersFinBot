/**
 * Notification types
 */

import type { Currency, TransactionCategory } from "../types"

export type NotificationType =
  | "BUDGET_EXCEEDED"
  | "BUDGET_WARNING"
  | "UNUSUAL_EXPENSE"
  | "FREQUENT_SPENDING"
  | "SPENDING_SPIKE"
  | "GOAL_AT_RISK"
  | "GOAL_ACHIEVED"
  | "MONTHLY_SUMMARY"
  | "WEEKLY_SUMMARY"
  | "CUSTOM_TRIGGER"

export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

export interface NotificationConfig {
  enabled: boolean
  budgetAlerts: {
    enabled: boolean
    warningThreshold: number // e.g., 80 = warn at 80% of budget
    exceededAlert: boolean
  }
  smartAlerts: {
    enabled: boolean
    unusualExpenseMultiplier: number // e.g., 2 = alert if 2x average
    frequentSpendingDays: number // e.g., 3 = alert if spent 3 days in a row
  }
  analyticsAlerts: {
    enabled: boolean
    monthlyComparison: boolean
    goalRiskDays: number // warn N days before goal deadline
  }
  scheduledReports: {
    enabled: boolean
    weekly: boolean
    monthly: boolean
    dayOfWeek?: number // 0-6, Sunday-Saturday
    dayOfMonth?: number // 1-31
  }
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  priority: NotificationPriority
  title: string
  message: string

  data?: any
  createdAt: Date
  sent: boolean
  sentAt?: Date
}

export interface BudgetAlert {
  budgetId: string
  category: TransactionCategory
  limit: number
  spent: number
  percentage: number
  currency: Currency
  remaining: number
}

export interface UnusualExpense {
  transactionId: string
  amount: number
  category: TransactionCategory
  averageAmount: number
  multiplier: number
  currency: Currency
}

export interface SpendingPattern {
  category: TransactionCategory
  consecutiveDays: number
  totalAmount: number
  averageDailyAmount: number
  currency: Currency
}

export interface GoalRisk {
  goalId: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: Date
  daysRemaining: number
  requiredDailyAmount: number
  currency: Currency
}

export interface CustomTrigger {
  id: string
  userId: string
  name: string
  enabled: boolean
  conditions: TriggerCondition[]
  action: TriggerAction
  createdAt: Date
}

export interface TriggerCondition {
  field: "amount" | "category" | "type" | "balance" | "budget_percentage"
  operator: "gt" | "lt" | "eq" | "gte" | "lte"
  value: number | string
}

export interface TriggerAction {
  type: "NOTIFY"
  message: string
  priority: NotificationPriority
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  budgetAlerts: {
    enabled: true,
    warningThreshold: 80,
    exceededAlert: true,
  },
  smartAlerts: {
    enabled: true,
    unusualExpenseMultiplier: 2,
    frequentSpendingDays: 3,
  },
  analyticsAlerts: {
    enabled: true,
    monthlyComparison: true,
    goalRiskDays: 7,
  },
  scheduledReports: {
    enabled: true,
    weekly: true,
    monthly: true,
    dayOfWeek: 0, // Sunday
    dayOfMonth: 1, // 1st of month
  },
}
