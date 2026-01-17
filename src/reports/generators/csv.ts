/**
 * CSV generation utilities
 */

import { Transaction } from "../../types"
import { dbStorage as db } from "../../database/storage-db"

/**
 * Generates CSV export of all transactions
 * @param userId - User ID
 * @returns CSV string with all transactions
 */
export async function generateCSV(userId: string): Promise<string> {
  const transactions = await db.getAllTransactions(userId)

  if (transactions.length === 0) {
    return ""
  }

  const header =
    "Date,Type,Category,Amount,Currency,FromAccount,ToAccount,Description\n"

  const rows = transactions.map((tx: Transaction) => {
    const date = new Date(tx.date).toISOString().split("T")[0]
    const cleanDesc = (tx.description || "").replace(/,/g, " ") // escape commas

    return [
      date,
      tx.type,
      tx.category,
      tx.amount,
      tx.currency,
      tx.fromAccountId || "",
      tx.toAccountId || "",
      cleanDesc,
    ].join(",")
  })

  return header + rows.join("\n")
}
