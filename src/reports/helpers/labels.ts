/**
 * Transaction label and sign utilities
 */

import { Transaction, TransactionType } from "../../types"

/**
 * Gets the sign for a transaction type
 * @param type - Transaction type
 * @returns Sign string ("+" for income, "-" for expense, "↔" for transfer)
 */
export function getTransactionSign(type: TransactionType): string {
  switch (type) {
    case TransactionType.EXPENSE:
      return "-"
    case TransactionType.INCOME:
      return "+"
    case TransactionType.TRANSFER:
      return "↔"
    default:
      return "?"
  }
}

/**
 * Gets a formatted label for a transaction
 * Handles special cases for Goal and Debt transactions
 * @param tx - Transaction object
 * @returns Formatted label string
 */
export function getTransactionLabel(tx: Transaction): string {
  // Handle Goal deposits
  if (
    tx.category === "Goal 🎯" &&
    tx.description?.startsWith("Goal Deposit:")
  ) {
    const goalName = tx.description.replace("Goal Deposit: ", "").trim()
    return `Goal: ${goalName}`
  }

  // Handle Debt repayments
  if (
    tx.category === "Debt 📉" &&
    tx.description?.startsWith("Debt repayment:")
  ) {
    const debtName = tx.description.replace("Debt repayment: ", "").trim()
    return `Debt: ${debtName}`
  }

  // Default: return category as-is
  return tx.category as unknown as string
}

/**
 * Gets the account name from a transaction
 * @param tx - Transaction object
 * @returns Account name or "N/A" if not found
 */
export function getTransactionAccount(tx: Transaction): string {
  return tx.fromAccountId || tx.toAccountId || "N/A"
}
