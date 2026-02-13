/**
 * Export types
 */

import type {
  Balance,
  Budget,
  Currency,
  Debt,
  Goal,
  IncomeSource,
  Transaction,
  TransactionCategory,
  TransactionType,
} from "../types"

export type ExportFormat = "csv" | "xlsx" | "json"

export interface ExportFilter {
  startDate?: Date
  endDate?: Date
  type?: TransactionType
  category?: TransactionCategory
  currency?: Currency
  minAmount?: number
  maxAmount?: number
}

export interface ExportOptions {
  format: ExportFormat
  filter?: ExportFilter
  includeBalance?: boolean
  includeDebts?: boolean
  includeGoals?: boolean
  groupByCategory?: boolean
  convertToCurrency?: Currency
}

export interface ExportResult {
  filename: string
  data: Buffer | string
  mimeType: string
  recordCount: number
}

export interface BackupData {
  version: string
  exportDate: Date
  userId: string
  userData: {
    defaultCurrency: Currency
    language?: string
  }
  transactions: Transaction[]
  balances?: Balance[]
  debts?: Debt[]
  goals?: Goal[]
  budgets?: Budget[]
  incomeSources?: IncomeSource[]
}
