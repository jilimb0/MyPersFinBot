/**
 * Advanced CSV export with filters
 */

import { TransactionType, Currency } from "../../types"
import { dbStorage as db } from "../../database/storage-db"

export interface CSVExportOptions {
  startDate?: Date
  endDate?: Date
  type?: TransactionType
  category?: string
  currency?: Currency
  includeHeaders?: boolean
  separator?: string
}

/**
 * Generate advanced CSV with filters
 */
export async function generateAdvancedCSV(
  userId: string,
  options: CSVExportOptions = {}
): Promise<string> {
  let transactions = await db.getAllTransactions(userId)

  // Apply filters
  if (options.startDate) {
    transactions = transactions.filter(
      (tx) => new Date(tx.date) >= options.startDate!
    )
  }

  if (options.endDate) {
    transactions = transactions.filter(
      (tx) => new Date(tx.date) <= options.endDate!
    )
  }

  if (options.type) {
    transactions = transactions.filter((tx) => tx.type === options.type)
  }

  if (options.category) {
    transactions = transactions.filter((tx) => tx.category === options.category)
  }

  if (options.currency) {
    transactions = transactions.filter((tx) => tx.currency === options.currency)
  }

  if (transactions.length === 0) {
    return ""
  }

  const separator = options.separator || ","
  const includeHeaders = options.includeHeaders !== false

  let csv = ""

  // Headers
  if (includeHeaders) {
    csv +=
      [
        "Date",
        "Type",
        "Category",
        "Amount",
        "Currency",
        "From Account",
        "To Account",
        "Description",
      ].join(separator) + "\n"
  }

  // Rows
  transactions.forEach((tx) => {
    const date = new Date(tx.date).toISOString().split("T")[0]
    const description = (tx.description || "")
      .replace(/,/g, " ")
      .replace(/"/g, "''")

    csv +=
      [
        date,
        tx.type,
        tx.category,
        tx.amount.toFixed(2),
        tx.currency,
        tx.fromAccountId || "",
        tx.toAccountId || "",
        `"${description}"`,
      ].join(separator) + "\n"
  })

  return csv
}

/**
 * Generate separate CSV files by type
 */
export async function generateCSVByType(
  userId: string,
  options: Omit<CSVExportOptions, "type"> = {}
): Promise<{
  expenses: string
  income: string
  transfers: string
}> {
  const [expenses, income, transfers] = await Promise.all([
    generateAdvancedCSV(userId, { ...options, type: TransactionType.EXPENSE }),
    generateAdvancedCSV(userId, { ...options, type: TransactionType.INCOME }),
    generateAdvancedCSV(userId, { ...options, type: TransactionType.TRANSFER }),
  ])

  return { expenses, income, transfers }
}

/**
 * Generate CSV by category
 */
export async function generateCSVByCategory(
  userId: string,
  options: Omit<CSVExportOptions, "category"> = {}
): Promise<Map<string, string>> {
  const transactions = await db.getAllTransactions(userId)
  const categories = new Set(transactions.map((tx) => tx.category))

  const result = new Map<string, string>()

  for (const category of categories) {
    const csv = await generateAdvancedCSV(userId, { ...options, category })
    if (csv) {
      result.set(category, csv)
    }
  }

  return result
}

/**
 * Generate monthly CSV files
 */
export async function generateMonthlyCSV(
  userId: string,
  year: number,
  month: number
): Promise<string> {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  return generateAdvancedCSV(userId, { startDate, endDate })
}
