/**
 * Top expenses formatting
 */

import { Transaction, TransactionType, Currency } from "../../types"
import { dbStorage as db } from "../../database/storage-db"
import { formatMoney, formatAmount } from "../../utils"
import { convertBatchSync } from "../../fx"
import { createProgressBar } from "../helpers"
import { CategoryTotals } from "../types"

/**
 * Formats top expenses for the current month
 * @param userId - User ID
 * @param limit - Number of top categories to show (default: 5)
 * @returns Formatted top expenses string
 */
export async function formatTopExpenses(
  userId: string,
  limit: number = 5
): Promise<string> {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()

  const transactions = await db.getTransactionsByMonth(userId, year, month)
  const userData = await db.getUserData(userId)
  const defaultCurrency = userData.defaultCurrency

  const expenses = transactions.filter(
    (tx: Transaction) => tx.type === TransactionType.EXPENSE
  )

  if (expenses.length === 0) {
    return "📉 *Top Expenses*\n\nNo expenses this month."
  }

  const categoryTotals: CategoryTotals = {}

  expenses.forEach((tx: Transaction) => {
    if (!categoryTotals[tx.category]) categoryTotals[tx.category] = {}
    if (!categoryTotals[tx.category][tx.currency])
      categoryTotals[tx.category][tx.currency] = 0
    categoryTotals[tx.category][tx.currency] += tx.amount
  })

  const categoryAmounts: Array<{ category: string; amount: number }> = []

  Object.entries(categoryTotals).forEach(([category, currencies]) => {
    const amounts = Object.entries(currencies).map(([cur, amt]) => ({
      amount: amt,
      from: cur as Currency,
      to: defaultCurrency,
    }))

    const converted = convertBatchSync(amounts)
    const total = converted.reduce((sum, val) => sum + val, 0)

    categoryAmounts.push({ category, amount: total })
  })

  categoryAmounts.sort((a, b) => b.amount - a.amount)

  const topN = categoryAmounts.slice(0, limit)
  const totalExpenses = categoryAmounts.reduce((sum, c) => sum + c.amount, 0)

  let msg = `📉 *Top ${topN.length} Expenses (${month + 1}/${year})*\n\n`

  topN.forEach((item, index) => {
    const percentage = (item.amount / totalExpenses) * 100
    const bar = createProgressBar(item.amount, totalExpenses, 10)

    msg += `${index + 1}. *${item.category}*\n`
    msg += `   ${formatMoney(item.amount, defaultCurrency)} (${formatAmount(percentage)}%)\n`
    msg += `   ${bar}\n\n`
  })

  msg += `──────────────\n`
  msg += `Total: ${formatMoney(totalExpenses, defaultCurrency)}`

  return msg
}
