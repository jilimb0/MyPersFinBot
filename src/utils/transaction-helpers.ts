/**
 * Transaction helper functions
 */

import { Transaction, TransactionType } from "../types"

/**
 * Match transaction against filters
 */
export function matchTransaction(
  tx: Transaction,
  type?: TransactionType,
  accountId?: string,
  category?: string
): boolean {
  if (type && tx.type !== type) return false

  if (accountId) {
    const isMatch =
      tx.fromAccountId === accountId || tx.toAccountId === accountId
    if (!isMatch) return false
  }

  if (category && tx.category !== category) return false

  return true
}

/**
 * Get transaction sign (+ - or ↔)
 */
export const getTransactionSign = (type: TransactionType): string => {
  return type === TransactionType.EXPENSE
    ? "-"
    : type === TransactionType.INCOME
      ? "+"
      : "↔"
}

/**
 * Get transaction label (with special handling for goals and debts)
 */
export const getTransactionLabel = (tx: Transaction): string => {
  if (
    tx.category === "Goal 🎯" &&
    tx.description?.startsWith("Goal Deposit:")
  ) {
    const goalName = tx.description.replace("Goal Deposit: ", "").trim()
    return `Goal: ${goalName}`
  }

  if (
    tx.category === "Debt 📉" &&
    tx.description?.startsWith("Debt repayment:")
  ) {
    const debtName = tx.description.replace("Debt repayment: ", "").trim()
    return `Debt: ${debtName}`
  }

  return tx.category as unknown as string
}
