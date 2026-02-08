/**
 * JSON backup and restore
 */

import { dbStorage as db } from "../../database/storage-db"
import { ExpenseCategory, UserData } from "../../types"
import { normalizeCategoryValue } from "../../i18n/categories"

export interface BackupData {
  version: string
  exportDate: string
  userId: string
  userData: UserData
}

export interface RestoreResult {
  success: boolean
  message: string
  stats?: {
    transactions: number
    balances: number
    debts: number
    goals: number
    budgets: number
  }
}

/**
 * Create full backup of user data
 */
export async function createBackup(userId: string): Promise<string> {
  const userData = await db.getUserData(userId)

  const backup: BackupData = {
    version: "1.0.0",
    exportDate: new Date().toISOString(),
    userId,
    userData,
  }

  return JSON.stringify(backup, null, 2)
}

/**
 * Restore user data from backup
 */
export async function restoreBackup(
  userId: string,
  backupJson: string
): Promise<RestoreResult> {
  try {
    const backup: BackupData = JSON.parse(backupJson)

    // Validate backup format
    if (!backup.version || !backup.userData) {
      return {
        success: false,
        message: "Invalid backup format",
      }
    }

    // Version check (for future migrations)
    if (backup.version !== "1.0.0") {
      return {
        success: false,
        message: `Unsupported backup version: ${backup.version}`,
      }
    }

    // Restore transactions
    let transactionCount = 0
    for (const tx of backup.userData.transactions) {
      const normalizedCategory = tx.category
        ? normalizeCategoryValue(tx.category)
        : null
      await db.addTransaction(userId, {
        ...tx,
        category: (normalizedCategory || tx.category) as any,
      })
      transactionCount++
    }

    // Restore balances
    let balanceCount = 0
    for (const balance of backup.userData.balances) {
      await db.addBalance(userId, balance)
      balanceCount++
    }

    // Restore debts
    let debtCount = 0
    for (const debt of backup.userData.debts) {
      await db.addDebt(userId, debt)
      debtCount++
    }

    // Restore goals
    let goalCount = 0
    for (const goal of backup.userData.goals) {
      await db.addGoal(userId, goal)
      goalCount++
    }

    // Restore budgets
    let budgetCount = 0
    for (const budget of backup.userData.budgets) {
      const normalizedCategory = normalizeCategoryValue(budget.category)
      await db.setCategoryBudget(
        userId,
        (normalizedCategory || budget.category) as ExpenseCategory,
        budget.amount,
        budget.currency,
        budget.period
      )
      budgetCount++
    }

    return {
      success: true,
      message: "Backup restored successfully",
      stats: {
        transactions: transactionCount,
        balances: balanceCount,
        debts: debtCount,
        goals: goalCount,
        budgets: budgetCount,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to restore backup: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Create minimal export (transactions only)
 */
export async function createTransactionsBackup(
  userId: string
): Promise<string> {
  const transactions = await db.getAllTransactions(userId)

  const backup = {
    version: "1.0.0",
    exportDate: new Date().toISOString(),
    userId,
    transactions,
  }

  return JSON.stringify(backup, null, 2)
}

/**
 * Validate backup file
 */
export function validateBackup(backupJson: string): {
  valid: boolean
  message: string
  info?: {
    version: string
    exportDate: string
    transactionCount: number
  }
} {
  try {
    const backup: BackupData = JSON.parse(backupJson)

    if (!backup.version) {
      return { valid: false, message: "Missing version field" }
    }

    if (!backup.userData) {
      return { valid: false, message: "Missing userData field" }
    }

    return {
      valid: true,
      message: "Valid backup file",
      info: {
        version: backup.version,
        exportDate: backup.exportDate,
        transactionCount: backup.userData.transactions.length,
      },
    }
  } catch (error) {
    return {
      valid: false,
      message: `Invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}
