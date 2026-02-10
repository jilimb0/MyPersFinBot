/**
 * Advanced CSV exporter with filters
 */

import { dbStorage } from "../database/storage-db"
import { convertSync } from "../fx"
import { getCategoryLabel } from "../i18n"
import logger from "../logger"
import { type Currency, type Transaction, TransactionType } from "../types"
import type { ExportFilter, ExportResult } from "./types"

export class CSVExporter {
  /**
   * Export transactions to CSV with filters
   */
  async exportTransactions(
    userId: string,
    filter?: ExportFilter,
    convertToCurrency?: Currency
  ): Promise<ExportResult> {
    try {
      // Get transactions with filter
      const transactions = await this.getFilteredTransactions(userId, filter)

      if (transactions.length === 0) {
        throw new Error("No transactions found matching filters")
      }

      // Generate CSV
      const lang = await dbStorage.getUserLanguage(userId)
      const csv = this.generateCSV(transactions, lang, convertToCurrency)
      const filename = this.generateFilename("transactions", filter)

      return {
        filename,
        data: csv,
        mimeType: "text/csv",
        recordCount: transactions.length,
      }
    } catch (error) {
      logger.error("CSV export error", error, { userId, filter })
      throw error
    }
  }

  /**
   * Export by category (separate CSV for each)
   */
  async exportByCategory(
    userId: string,
    filter?: ExportFilter
  ): Promise<Map<string, ExportResult>> {
    const transactions = await this.getFilteredTransactions(userId, filter)
    const lang = await dbStorage.getUserLanguage(userId)
    const results = new Map<string, ExportResult>()

    // Group by category
    const byCategory = new Map<string, Transaction[]>()

    transactions.forEach((tx) => {
      const category = tx.category || "OTHER"
      if (!byCategory.has(category)) {
        byCategory.set(category, [])
      }
      byCategory.get(category)?.push(tx)
    })

    // Generate CSV for each category
    byCategory.forEach((txs, category) => {
      const csv = this.generateCSV(txs, lang)
      const filename = `${category.toLowerCase()}_transactions.csv`

      results.set(category, {
        filename,
        data: csv,
        mimeType: "text/csv",
        recordCount: txs.length,
      })
    })

    return results
  }

  /**
   * Export expenses only
   */
  async exportExpenses(
    userId: string,
    filter?: ExportFilter,
    convertToCurrency?: Currency
  ): Promise<ExportResult> {
    return this.exportTransactions(
      userId,
      { ...filter, type: TransactionType.EXPENSE },
      convertToCurrency
    )
  }

  /**
   * Export income only
   */
  async exportIncome(
    userId: string,
    filter?: ExportFilter,
    convertToCurrency?: Currency
  ): Promise<ExportResult> {
    return this.exportTransactions(
      userId,
      { ...filter, type: TransactionType.INCOME },
      convertToCurrency
    )
  }

  /**
   * Get filtered transactions
   */
  private async getFilteredTransactions(
    userId: string,
    filter?: ExportFilter
  ): Promise<Transaction[]> {
    let transactions: Transaction[]

    if (filter?.startDate || filter?.endDate) {
      const start = filter.startDate || new Date("1970-01-01")
      const end = filter.endDate || new Date()
      transactions = await dbStorage.getTransactionsByDateRange(
        userId,
        start,
        end
      )
    } else {
      transactions = await dbStorage.getAllTransactions(userId)
    }

    // Apply additional filters
    return transactions.filter((tx) => {
      if (filter?.type && tx.type !== filter.type) return false
      if (filter?.category && tx.category !== filter.category) return false
      if (filter?.currency && tx.currency !== filter.currency) return false
      if (filter?.minAmount && tx.amount < filter.minAmount) return false
      if (filter?.maxAmount && tx.amount > filter.maxAmount) return false
      return true
    })
  }

  /**
   * Generate CSV content
   */
  private generateCSV(
    transactions: Transaction[],
    lang: string,
    convertToCurrency?: Currency
  ): string {
    const headers = [
      "Date",
      "Type",
      "Category",
      "Amount",
      "Currency",
      "Description",
      "From Account",
      "To Account",
    ]

    if (convertToCurrency) {
      headers.push("Converted Amount", "Converted Currency", "Exchange Rate")
    }

    const rows = [headers.join(",")]

    transactions.forEach((tx) => {
      const date = new Date(tx.date).toISOString().split("T")[0]
      const description = this.escapeCsvValue(tx.description || "")
      const fromAccount = tx.fromAccountId || ""
      const toAccount = tx.toAccountId || ""

      const row = [
        date,
        tx.type,
        tx.category ? getCategoryLabel(lang as any, tx.category) : "OTHER",
        tx.amount.toFixed(2),
        tx.currency,
        description,
        fromAccount,
        toAccount,
      ]

      // Add conversion if requested
      if (convertToCurrency && tx.currency !== convertToCurrency) {
        const converted = convertSync(tx.amount, tx.currency, convertToCurrency)
        const rate = converted / tx.amount
        row.push(converted.toFixed(2), convertToCurrency, rate.toFixed(4))
      } else if (convertToCurrency) {
        row.push(tx.amount.toFixed(2), tx.currency, "1.0000")
      }

      rows.push(row.join(","))
    })

    return rows.join("\n")
  }

  /**
   * Escape CSV value (handle commas, quotes, newlines)
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  /**
   * Generate filename based on filter
   */
  private generateFilename(prefix: string, filter?: ExportFilter): string {
    const timestamp = new Date().toISOString().split("T")[0]
    let filename = `${prefix}_${timestamp}`

    if (filter?.type) {
      filename += `_${filter.type.toLowerCase()}`
    }

    if (filter?.category) {
      filename += `_${filter.category.toLowerCase()}`
    }

    if (filter?.startDate && filter?.endDate) {
      const start = filter.startDate.toISOString().split("T")[0]
      const end = filter.endDate.toISOString().split("T")[0]
      filename += `_${start}_to_${end}`
    }

    return `${filename}.csv`
  }
}

/**
 * Default CSV exporter instance
 */
export const csvExporter = new CSVExporter()
export default csvExporter
