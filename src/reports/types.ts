/**
 * Type definitions for reports
 */

import type { Currency, IncomeSource, Transaction } from "../types"

export interface CategoryTotals {
  [category: string]: {
    [currency: string]: number
  }
}

export interface MonthlyTrends {
  prevIncome: number
  prevExpense: number
  currentIncome: number
  currentExpense: number
  incomeChange: number
  expenseChange: number
}

export interface StatsSection {
  title: string
  content: string
}

export interface MonthlyStatsData {
  transactions: Transaction[]
  incomeSources: IncomeSource[]
  defaultCurrency: Currency
  year: number
  month: number
}
