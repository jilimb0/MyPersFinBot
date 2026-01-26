/**
 * Analytics report generation
 */

import { Transaction, TransactionType, Currency } from "../../types"
import { dbStorage as db } from "../../database/storage-db"
import { formatMoney, formatAmount } from "../../utils"
import { convertBatchSync } from "../../fx"
import { createProgressBar } from "../helpers"
import { CategoryTotals } from "../types"

type AnalyticsPeriod = {
  preset?: "LAST_7_DAYS" | "LAST_30_DAYS"
  startDate?: string
  endDate?: string
}

/**
 * Generate analytics report for a specified period
 * @param userId - User ID
 * @param period - Period configuration (preset or custom dates)
 * @returns Formatted analytics report
 */
export async function generateAnalyticsReport(
  userId: string,
  period: AnalyticsPeriod
): Promise<string> {
  let startDate: Date
  let endDate: Date
  let periodLabel: string

  // Determine date range based on period configuration
  if (period.preset === "LAST_7_DAYS") {
    endDate = new Date()
    startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)
    periodLabel = "Last 7 Days"
  } else if (period.preset === "LAST_30_DAYS") {
    endDate = new Date()
    startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)
    periodLabel = "Last 30 Days"
  } else if (period.startDate && period.endDate) {
    startDate = new Date(period.startDate)
    endDate = new Date(period.endDate)
    periodLabel = `${startDate.toLocaleDateString("en-GB")} - ${endDate.toLocaleDateString("en-GB")}`
  } else {
    throw new Error("Invalid period configuration")
  }

  // Get transactions for date range (SQL-filtered - fast!)
  const transactions = await db.getTransactionsByDateRange(
    userId,
    startDate,
    endDate
  )
  const userData = await db.getUserData(userId)
  const defaultCurrency = userData.defaultCurrency

  if (transactions.length === 0) {
    return `📊 *Analytics Report*\n\n📅 Period: ${periodLabel}\n\n📭 No transactions found for this period.`
  }

  // Separate transactions by type
  const expenses = transactions.filter(
    (tx: Transaction) => tx.type === TransactionType.EXPENSE
  )
  const income = transactions.filter(
    (tx: Transaction) => tx.type === TransactionType.INCOME
  )
  const transfers = transactions.filter(
    (tx: Transaction) => tx.type === TransactionType.TRANSFER
  )

  // Calculate totals
  const totalIncome = calculateTotal(income, defaultCurrency)
  const totalExpenses = calculateTotal(expenses, defaultCurrency)
  const netBalance = totalIncome - totalExpenses

  // Calculate category breakdowns
  const expensesByCategory = groupByCategory(expenses, defaultCurrency)
  const incomeByCategory = groupByCategory(income, defaultCurrency)

  // Build report
  let msg = `📊 *Analytics Report*\n\n`
  msg += `📅 *Period:* ${periodLabel}\n`
  msg += `📝 *Transactions:* ${transactions.length}\n\n`

  msg += `──────────────\n\n`

  // Summary
  msg += `💰 *Income:* ${formatMoney(totalIncome, defaultCurrency)}\n`
  msg += `💸 *Expenses:* ${formatMoney(totalExpenses, defaultCurrency)}\n`
  msg += `💎 *Net:* ${formatMoney(netBalance, defaultCurrency)} ${netBalance >= 0 ? "📈" : "📉"}\n\n`

  msg += `──────────────\n\n`

  // Top Expenses
  if (expensesByCategory.length > 0) {
    msg += `💸 *Top Expense Categories*\n\n`
    const topExpenses = expensesByCategory.slice(0, 5)

    topExpenses.forEach((item, index) => {
      const percentage = (item.amount / totalExpenses) * 100
      const bar = createProgressBar(item.amount, totalExpenses, 10)

      msg += `${index + 1}. *${item.category}*\n`
      msg += `   ${formatMoney(item.amount, defaultCurrency)} (${formatAmount(percentage)}%)\n`
      msg += `   ${bar}\n\n`
    })

    msg += `──────────────\n\n`
  }

  // Income breakdown
  if (incomeByCategory.length > 0) {
    msg += `💰 *Income Sources*\n\n`
    incomeByCategory.forEach((item, index) => {
      const percentage = (item.amount / totalIncome) * 100
      msg += `${index + 1}. *${item.category}*: ${formatMoney(item.amount, defaultCurrency)} (${formatAmount(percentage)}%)\n`
    })

    msg += `\n──────────────\n\n`
  }

  // Daily average
  const daysDiff = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  const avgDailyExpense = daysDiff > 0 ? totalExpenses / daysDiff : 0
  const avgDailyIncome = daysDiff > 0 ? totalIncome / daysDiff : 0

  msg += `📊 *Daily Averages*\n\n`
  msg += `💰 Income: ${formatMoney(avgDailyIncome, defaultCurrency)}/day\n`
  msg += `💸 Expenses: ${formatMoney(avgDailyExpense, defaultCurrency)}/day\n`

  if (transfers.length > 0) {
    msg += `\n↔️ Transfers: ${transfers.length}\n`
  }

  return msg
}

/**
 * Calculate total amount in default currency
 */
function calculateTotal(
  transactions: Transaction[],
  defaultCurrency: Currency
): number {
  const amounts = transactions.map((tx) => ({
    amount: tx.amount,
    from: tx.currency,
    to: defaultCurrency,
  }))

  const converted = convertBatchSync(amounts)
  return converted.reduce((sum, val) => sum + val, 0)
}

/**
 * Group transactions by category and sum amounts
 */
function groupByCategory(
  transactions: Transaction[],
  defaultCurrency: Currency
): Array<{ category: string; amount: number }> {
  const categoryTotals: CategoryTotals = {}

  transactions.forEach((tx: Transaction) => {
    if (!categoryTotals[tx.category]) {
      categoryTotals[tx.category] = {}
    }
    if (!categoryTotals[tx.category]![tx.currency]) {
      categoryTotals[tx.category]![tx.currency] = 0
    }
    categoryTotals[tx.category]![tx.currency]! += tx.amount
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

  // Sort by amount descending
  categoryAmounts.sort((a, b) => b.amount - a.amount)

  return categoryAmounts
}
