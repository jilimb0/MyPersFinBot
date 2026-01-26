/**
 * Analytics types
 */

import { Currency, TransactionCategory } from "../types"

export interface PeriodStats {
  income: number
  expense: number
  balance: number
  transactions: number
  averageTransaction: number
}

export interface CategoryStats {
  category: TransactionCategory
  total: number
  count: number
  percentage: number
  trend?: "up" | "down" | "stable"
}

export interface DailyStats {
  date: string
  income: number
  expense: number
  balance: number
}

export interface MonthlyStats {
  month: string
  income: number
  expense: number
  balance: number
  transactions: number
}

export interface AnalyticsSummary {
  period: AnalyticsPeriod
  startDate: Date
  endDate: Date
  currency: Currency
  stats: PeriodStats
  categories: CategoryStats[]
  daily?: DailyStats[]
  topExpenses: Array<{
    description: string
    amount: number
    category: TransactionCategory
    date: Date
  }>
  insights: string[]
}

export interface ComparisonResult {
  current: PeriodStats
  previous: PeriodStats
  change: {
    income: number
    expense: number
    balance: number
    incomePercent: number
    expensePercent: number
    balancePercent: number
  }
}

export interface SpendingPattern {
  dayOfWeek: string
  averageAmount: number
  transactionCount: number
}

export interface BudgetAnalysis {
  category: TransactionCategory
  spent: number
  budget: number
  remaining: number
  percentUsed: number
  status: "ok" | "warning" | "exceeded"
  daysRemaining: number
  projectedTotal?: number
}

export type AnalyticsPeriod = "today" | "week" | "month" | "year" | "all"

export interface AnalyticsFilter {
  period: AnalyticsPeriod
  startDate?: Date
  endDate?: Date
  category?: TransactionCategory
  currency?: Currency
}
