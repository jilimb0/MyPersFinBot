/**
 * Trends formatting (analytics)
 */

import { Transaction } from "../../types"
import { dbStorage as db } from "../../database/storage-db"
import { formatMoney } from "../../utils"
import { t } from "../../i18n"

/**
 * Formats trends comparing current month to last month
 * @param userId - User ID
 * @returns Formatted trends string
 */
export async function formatTrends(userId: string): Promise<string> {
  const lang = await db.getUserLanguage(userId)
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

  const incomeTrendEmoji = incomeChange >= 0 ? "📈" : "📉"
  const expenseTrendEmoji = expenseChange >= 0 ? "📈" : "📉"
  const incomeSign = incomeChange >= 0 ? "+" : ""
  const expenseSign = expenseChange >= 0 ? "+" : ""

  return (
    `${t(lang, "reports.trends.title")}\n\n` +
    `${t(lang, "reports.trends.income", {
      amount: formatMoney(thisIncome, defaultCurrency),
    })}\n` +
    `   ${incomeTrendEmoji} ${incomeSign}${incomeChange}%\n\n` +
    `${t(lang, "reports.trends.expenses", {
      amount: formatMoney(thisExpense, defaultCurrency),
    })}\n` +
    `   ${expenseTrendEmoji} ${expenseSign}${expenseChange}%\n\n` +
    `${t(lang, "reports.trends.transactions", { count: thisMonth.length })}\n`
  )
}
