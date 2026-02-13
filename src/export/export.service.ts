/**
 * Main export service
 * Coordinates all export operations
 */

import logger from "../logger"
import { TransactionType } from "../types"
import { csvExporter } from "./csv-exporter"
import { excelExporter } from "./excel-exporter"
import { jsonExporter } from "./json-exporter"
import type { ExportFormat, ExportOptions, ExportResult } from "./types"

export class ExportService {
  /**
   * Export data based on options
   */
  async export(userId: string, options: ExportOptions): Promise<ExportResult> {
    try {
      logger.info("Export started", { userId, format: options.format })

      let result: ExportResult

      switch (options.format) {
        case "csv":
          result = await csvExporter.exportTransactions(
            userId,
            options.filter,
            options.convertToCurrency
          )
          break

        case "xlsx":
          if (options.groupByCategory) {
            result = await excelExporter.exportWithBreakdown(
              userId,
              options.filter
            )
          } else {
            result = await excelExporter.exportTransactions(
              userId,
              options.filter,
              options.convertToCurrency
            )
          }
          break

        case "json":
          if (
            options.includeBalance ||
            options.includeDebts ||
            options.includeGoals
          ) {
            result = await jsonExporter.createBackup(userId)
          } else {
            result = await jsonExporter.exportTransactions(userId)
          }
          break

        default:
          throw new Error(`Unsupported export format: ${options.format}`)
      }

      logger.info("Export completed", {
        userId,
        format: options.format,
        recordCount: result.recordCount,
      })

      return result
    } catch (error) {
      logger.error("Export failed", error, { userId, options })
      throw error
    }
  }

  /**
   * Quick export presets
   */
  async quickExport(
    userId: string,
    preset:
      | "all"
      | "expenses"
      | "income"
      | "this_month"
      | "last_month"
      | "backup",
    format: ExportFormat = "csv"
  ): Promise<ExportResult> {
    const now = new Date()
    const options: ExportOptions = { format }

    switch (preset) {
      case "all":
        // Export everything
        break

      case "expenses":
        options.filter = { type: TransactionType.EXPENSE }
        break

      case "income":
        options.filter = { type: TransactionType.INCOME }
        break

      case "this_month":
        options.filter = {
          startDate: new Date(now.getFullYear(), now.getMonth(), 1),
          endDate: now,
        }
        break

      case "last_month": {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
        options.filter = {
          startDate: lastMonth,
          endDate: lastMonthEnd,
        }
        break
      }

      case "backup":
        options.format = "json"
        options.includeBalance = true
        options.includeDebts = true
        options.includeGoals = true
        break
    }

    return this.export(userId, options)
  }

  /**
   * Export expenses only (CSV)
   */
  async exportExpenses(userId: string): Promise<ExportResult> {
    return csvExporter.exportExpenses(userId)
  }

  /**
   * Export income only (CSV)
   */
  async exportIncome(userId: string): Promise<ExportResult> {
    return csvExporter.exportIncome(userId)
  }

  /**
   * Export by category (multiple CSV files)
   */
  async exportByCategory(userId: string): Promise<Map<string, ExportResult>> {
    return csvExporter.exportByCategory(userId)
  }

  /**
   * Create full backup (JSON)
   */
  async createBackup(userId: string): Promise<ExportResult> {
    return jsonExporter.createBackup(userId)
  }

  /**
   * Restore from backup
   */
  async restoreBackup(userId: string, backupJson: string): Promise<void> {
    return jsonExporter.restoreBackup(userId, backupJson)
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): ExportFormat[] {
    return ["csv", "xlsx", "json"]
  }

  /**
   * Get available presets
   */
  getPresets(): string[] {
    return ["all", "expenses", "income", "this_month", "last_month", "backup"]
  }
}

/**
 * Default export service instance
 */
export const exportService = new ExportService()
export default exportService
