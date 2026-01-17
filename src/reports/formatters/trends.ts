/**
 * Trends formatting (analytics)
 */

import { Transaction } from "../../types"
import { dbStorage as db } from "../../database/storage-db"
import { formatMoney } from "../../utils"

/**
 * Formats trends comparing current month to last month
 * @param userId - User ID
 * @returns Formatted trends string
 */
export async function formatTrends(userId: string): Promise<string> {
  const now = new Date()

  const thisMonth = await db.getTransactionsByMonth(
    userId,
    now.getFullYear(),
    now.getMonth() + 1
  )
  const lastMonth = await db.getTransactionsByMonth(
    userId,
    now.getFullYear(),
    now.getMonth()
  )

  const thisIncome = thisMonth
    .filter((t: Transaction) => t.type === "INCOME")
    .reduce((s: number, t: Transaction) => s + t.amount, 0)
  const lastIncome = lastMonth
    .filter((t: Transaction) => t.type === "INCOME")
    .reduce((s: number, t: Transaction) => s + t.amount, 0)

  const thisExpense = thisMonth
    .filter((t: Transaction) => t.type === "EXPENSE")
    .reduce((s: number, t: Transaction) => s + t.amount, 0)
  const lastExpense = lastMonth
    .filter((t: Transaction) => t.type === "EXPENSE")
    .reduce((s: number, t: Transaction) => s + t.amount, 0)

  const incomeChange =
    lastIncome > 0
      ? Math.round(((thisIncome - lastIncome) / lastIncome) * 100)
      : 0

  const expenseChange =
    lastExpense > 0
      ? Math.round(((thisExpense - lastExpense) / lastExpense) * 100)
      : 0

  const userData = await db.getUserData(userId)
  const defaultCurrency = userData.defaultCurrency

  return `
📈 *Trends (vs last month)*

💰 *Income:* ${formatMoney(thisIncome, defaultCurrency)}
   ${incomeChange >= 0 ? "📈" : "📉"} ${incomeChange >= 0 ? "+" : ""}${incomeChange}%

📉 *Expenses:* ${formatMoney(thisExpense, defaultCurrency)}
   ${expenseChange >= 0 ? "📈" : "📉"} ${expenseChange >= 0 ? "+" : ""}${expenseChange}%

*Transactions:* ${thisMonth.length}
  `
}
