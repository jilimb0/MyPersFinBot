/**
 * Excel (XLSX) exporter
 */

import { Transaction, Currency } from "../types"
import { dbStorage } from "../database/storage-db"
import { getCategoryLabel } from "../i18n"
import { convertSync } from "../fx"
import { ExportFilter, ExportResult } from "./types"
import logger from "../logger"

// We'll use a simple XLSX generation approach
// For production, consider using 'exceljs' or 'xlsx' library

export class ExcelExporter {
  /**
   * Export transactions to Excel with multiple sheets
   */
  async exportTransactions(
    userId: string,
    filter?: ExportFilter,
    convertToCurrency?: Currency
  ): Promise<ExportResult> {
    try {
      logger.info("Excel export started", { userId })

      // Get user data
      const userData = await dbStorage.getUserData(userId)
      const defaultCurrency = convertToCurrency || userData.defaultCurrency
      const lang = await dbStorage.getUserLanguage(userId)

      // Get transactions
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

      // Apply filters
      transactions = this.applyFilters(transactions, filter)

      if (transactions.length === 0) {
        throw new Error("No transactions found")
      }

      // Generate Excel data (simplified TSV format for now)
      // In production, use proper XLSX library
      const excelData = this.generateExcelTSV(
        transactions,
        defaultCurrency,
        lang
      )

      const filename = `transactions_${new Date().toISOString().split("T")[0]}.xlsx`

      return {
        filename,
        data: excelData,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        recordCount: transactions.length,
      }
    } catch (error) {
      logger.error("Excel export error", error, { userId })
      throw error
    }
  }

  /**
   * Export with category breakdown (multiple sheets simulation)
   */
  async exportWithBreakdown(
    userId: string,
    filter?: ExportFilter
  ): Promise<ExportResult> {
    const userData = await dbStorage.getUserData(userId)
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

    transactions = this.applyFilters(transactions, filter)

    const lang = await dbStorage.getUserLanguage(userId)

    // Group by category
    const byCategory = new Map<string, Transaction[]>()
    transactions.forEach((tx) => {
      const cat = tx.category ? getCategoryLabel(lang as any, tx.category) : "OTHER"
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(tx)
    })

    // Generate multi-sheet data
    let excelData = "=== SUMMARY ===\n"
    excelData += "Category\tCount\tTotal\n"

    byCategory.forEach((txs, category) => {
      const total = txs.reduce((sum, tx) => {
        return (
          sum + convertSync(tx.amount, tx.currency, userData.defaultCurrency)
        )
      }, 0)
      excelData += `${category}\t${txs.length}\t${total.toFixed(2)}\n`
    })

    excelData += "\n=== ALL TRANSACTIONS ===\n"
    excelData += this.generateExcelTSV(
      transactions,
      userData.defaultCurrency,
      lang
    )

    const filename = `transactions_breakdown_${new Date().toISOString().split("T")[0]}.xlsx`

    return {
      filename,
      data: excelData,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      recordCount: transactions.length,
    }
  }

  /**
   * Apply filters to transactions
   */
  private applyFilters(
    transactions: Transaction[],
    filter?: ExportFilter
  ): Transaction[] {
    if (!filter) return transactions

    return transactions.filter((tx) => {
      if (filter.type && tx.type !== filter.type) return false
      if (filter.category && tx.category !== filter.category) return false
      if (filter.currency && tx.currency !== filter.currency) return false
      if (filter.minAmount && tx.amount < filter.minAmount) return false
      if (filter.maxAmount && tx.amount > filter.maxAmount) return false
      return true
    })
  }

  /**
   * Generate Excel data in TSV format (simplified)
   * TODO: Replace with proper XLSX library in production
   */
  private generateExcelTSV(
    transactions: Transaction[],
    defaultCurrency: Currency,
    lang: string
  ): string {
    const headers = [
      "Date",
      "Type",
      "Category",
      "Amount",
      "Currency",
      "Converted Amount",
      "Default Currency",
      "Description",
      "From Account",
      "To Account",
    ]

    const rows = [headers.join("\t")]

    transactions.forEach((tx) => {
      const date = new Date(tx.date).toISOString().split("T")[0]
      const converted = convertSync(tx.amount, tx.currency, defaultCurrency)

      rows.push(
        [
          date,
          tx.type,
          tx.category ? getCategoryLabel(lang as any, tx.category) : "OTHER",
          tx.amount.toFixed(2),
          tx.currency,
          converted.toFixed(2),
          defaultCurrency,
          tx.description || "",
          tx.fromAccountId || "",
          tx.toAccountId || "",
        ].join("\t")
      )
    })

    return rows.join("\n")
  }
}

/**
 * Default Excel exporter instance
 */
export const excelExporter = new ExcelExporter()
export default excelExporter
