/**
 * Unified export service
 */

import { promises as fs } from "fs"
import path from "path"
import logger from "../../logger"
import {
  generateAdvancedCSV,
  generateCSVByType,
  CSVExportOptions,
} from "./csv-advanced"
import { generateExcel } from "./excel"
import { createBackup, createTransactionsBackup } from "./json-backup"

export type ExportFormat = "csv" | "excel" | "json"

export interface ExportOptions extends CSVExportOptions {
  format: ExportFormat
  splitByType?: boolean // For CSV: create separate files
  includeMetadata?: boolean // For JSON: include full user data
}

export interface ExportResult {
  success: boolean
  format: ExportFormat
  filePath?: string
  buffer?: Buffer
  error?: string
  size?: number
}

const EXPORT_DIR = path.resolve(__dirname, "../../../data/exports")

/**
 * Main export function
 */
export async function exportData(
  userId: string,
  options: ExportOptions
): Promise<ExportResult> {
  try {
    // Ensure export directory exists
    await fs.mkdir(EXPORT_DIR, { recursive: true })

    switch (options.format) {
      case "csv":
        return await exportCSV(userId, options)

      case "excel":
        return await exportExcel(userId, options)

      case "json":
        return await exportJSON(userId, options)

      default:
        return {
          success: false,
          format: options.format,
          error: `Unsupported format: ${options.format}`,
        }
    }
  } catch (error) {
    logger.error("Export failed", error, { userId, options })
    return {
      success: false,
      format: options.format,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Export as CSV
 */
async function exportCSV(
  userId: string,
  options: ExportOptions
): Promise<ExportResult> {
  const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0]

  if (options.splitByType) {
    // Create separate files for each type
    const files = await generateCSVByType(userId, options)

    const expensesPath = path.join(
      EXPORT_DIR,
      `expenses_${userId}_${timestamp}.csv`
    )
    const incomePath = path.join(
      EXPORT_DIR,
      `income_${userId}_${timestamp}.csv`
    )
    const transfersPath = path.join(
      EXPORT_DIR,
      `transfers_${userId}_${timestamp}.csv`
    )

    await Promise.all([
      fs.writeFile(expensesPath, files.expenses, "utf-8"),
      fs.writeFile(incomePath, files.income, "utf-8"),
      fs.writeFile(transfersPath, files.transfers, "utf-8"),
    ])

    logger.info("CSV export completed (split by type)", { userId, timestamp })

    return {
      success: true,
      format: "csv",
      filePath: EXPORT_DIR,
    }
  } else {
    // Single file
    const csv = await generateAdvancedCSV(userId, options)
    const filePath = path.join(
      EXPORT_DIR,
      `transactions_${userId}_${timestamp}.csv`
    )

    await fs.writeFile(filePath, csv, "utf-8")

    const stats = await fs.stat(filePath)

    logger.info("CSV export completed", { userId, timestamp, size: stats.size })

    return {
      success: true,
      format: "csv",
      filePath,
      size: stats.size,
    }
  }
}

/**
 * Export as Excel
 */
async function exportExcel(
  userId: string,
  options: ExportOptions
): Promise<ExportResult> {
  const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0]
  const filePath = path.join(
    EXPORT_DIR,
    `transactions_${userId}_${timestamp}.xlsx`
  )

  const buffer = await generateExcel(userId, options)

  await fs.writeFile(filePath, buffer)

  const stats = await fs.stat(filePath)

  logger.info("Excel export completed", { userId, timestamp, size: stats.size })

  return {
    success: true,
    format: "excel",
    filePath,
    buffer,
    size: stats.size,
  }
}

/**
 * Export as JSON
 */
async function exportJSON(
  userId: string,
  options: ExportOptions
): Promise<ExportResult> {
  const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0]
  const filePath = path.join(EXPORT_DIR, `backup_${userId}_${timestamp}.json`)

  const json = options.includeMetadata
    ? await createBackup(userId)
    : await createTransactionsBackup(userId)

  await fs.writeFile(filePath, json, "utf-8")

  const stats = await fs.stat(filePath)

  logger.info("JSON export completed", { userId, timestamp, size: stats.size })

  return {
    success: true,
    format: "json",
    filePath,
    size: stats.size,
  }
}

/**
 * Clean old export files (older than 7 days)
 */
export async function cleanOldExports(): Promise<number> {
  try {
    const files = await fs.readdir(EXPORT_DIR)
    const now = Date.now()
    const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days

    let cleaned = 0

    for (const file of files) {
      const filePath = path.join(EXPORT_DIR, file)
      const stats = await fs.stat(filePath)

      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filePath)
        cleaned++
      }
    }

    logger.info("Old exports cleaned", { count: cleaned })

    return cleaned
  } catch (error) {
    logger.error("Failed to clean old exports", error)
    return 0
  }
}

/**
 * Get export file info
 */
export async function getExportInfo(filePath: string): Promise<{
  exists: boolean
  size?: number
  created?: Date
}> {
  try {
    const stats = await fs.stat(filePath)
    return {
      exists: true,
      size: stats.size,
      created: stats.birthtime,
    }
  } catch (error) {
    return { exists: false }
  }
}
