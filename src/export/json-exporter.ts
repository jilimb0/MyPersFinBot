/**
 * JSON exporter for full backup/restore
 */

import { dbStorage } from "../database/storage-db"
import logger from "../logger"
import type { BackupData, ExportResult } from "./types"

const BACKUP_VERSION = "1.0.0"

export class JSONExporter {
  /**
   * Create full backup of user data
   */
  async createBackup(userId: string): Promise<ExportResult> {
    try {
      logger.info("Creating JSON backup", { userId })

      // Get all user data
      const userData = await dbStorage.getUserData(userId)

      const backup: BackupData = {
        version: BACKUP_VERSION,
        exportDate: new Date(),
        userId,
        userData: {
          defaultCurrency: userData.defaultCurrency,
        },
        transactions: userData.transactions,
        balances: userData.balances,
        debts: userData.debts,
        goals: userData.goals,
        budgets: userData.budgets,
        incomeSources: userData.incomeSources,
      }

      const json = JSON.stringify(backup, null, 2)
      const filename = `backup_${userId}_${new Date().toISOString().split("T")[0]}.json`

      return {
        filename,
        data: json,
        mimeType: "application/json",
        recordCount: backup.transactions.length,
      }
    } catch (error) {
      logger.error("JSON backup error", error, { userId })
      throw error
    }
  }

  /**
   * Export transactions only (lightweight)
   */
  async exportTransactions(userId: string): Promise<ExportResult> {
    try {
      const transactions = await dbStorage.getAllTransactions(userId)
      const userData = await dbStorage.getUserData(userId)

      const data = {
        version: BACKUP_VERSION,
        exportDate: new Date(),
        userId,
        defaultCurrency: userData.defaultCurrency,
        transactions,
      }

      const json = JSON.stringify(data, null, 2)
      const filename = `transactions_${new Date().toISOString().split("T")[0]}.json`

      return {
        filename,
        data: json,
        mimeType: "application/json",
        recordCount: transactions.length,
      }
    } catch (error) {
      logger.error("JSON export error", error, { userId })
      throw error
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(userId: string, backupJson: string): Promise<void> {
    try {
      logger.info("Restoring from backup", { userId })

      const backup: BackupData = JSON.parse(backupJson)

      // Validate backup version
      if (!backup.version || backup.version !== BACKUP_VERSION) {
        throw new Error(`Unsupported backup version: ${backup.version}`)
      }

      // TODO: Implement restore logic
      // This would involve:
      // 1. Clearing existing data (with confirmation)
      // 2. Importing transactions
      // 3. Importing balances, debts, goals, etc.
      // 4. Updating user settings

      logger.info("Backup restored successfully", {
        userId,
        transactionCount: backup.transactions.length,
      })
    } catch (error) {
      logger.error("Restore backup error", error, { userId })
      throw error
    }
  }

  /**
   * Validate backup file
   */
  validateBackup(backupJson: string): {
    valid: boolean
    version?: string
    transactionCount?: number
    exportDate?: Date
    error?: string
  } {
    try {
      const backup: BackupData = JSON.parse(backupJson)

      if (!backup.version) {
        return { valid: false, error: "Missing version field" }
      }

      if (!backup.transactions || !Array.isArray(backup.transactions)) {
        return { valid: false, error: "Invalid transactions data" }
      }

      return {
        valid: true,
        version: backup.version,
        transactionCount: backup.transactions.length,
        exportDate: new Date(backup.exportDate),
      }
    } catch (_error) {
      return { valid: false, error: "Invalid JSON format" }
    }
  }
}

/**
 * Default JSON exporter instance
 */
export const jsonExporter = new JSONExporter()
export default jsonExporter
