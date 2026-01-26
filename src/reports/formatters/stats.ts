/**
 * Monthly statistics formatting
 */

import {
  Transaction,
  TransactionType,
  IncomeSource,
  Currency,
} from "../../types"
import { dbStorage as db } from "../../database/storage-db"
import { formatMoney, formatAmount } from "../../utils"
import {
  getCategoryEmoji,
  convertToDefaultCurrency,
  sumConverted,
  createProgressBar,
} from "../helpers"
import { CategoryTotals, MonthlyStatsData } from "../types"

/**
 * Fetches monthly stats data
 */
async function getMonthlyStatsData(userId: string): Promise<MonthlyStatsData> {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()

  const [transactions, userData] = await Promise.all([
    db.getTransactionsByMonth(userId, year, month),
    db.getUserData(userId),
  ])

  return {
    transactions,
    incomeSources: userData.incomeSources,
    defaultCurrency: userData.defaultCurrency,
    year,
    month,
  }
}

/**
 * Formats income section
 */
function formatIncomeSection(
  data: MonthlyStatsData,
  incomeTotals: CategoryTotals,
  totalIncomeCount: number,
  totalIncomeInDefaultCurrency: number
): string {
  const { incomeSources, defaultCurrency } = data

  if (incomeSources.length === 0 && totalIncomeCount === 0) {
    return ""
  }

  let section = ""

  if (incomeSources.length > 0) {
    section += "💵 *Income Plan vs Actual*\n\nExpected:\n"

    const sourceItems = incomeSources.map((source: IncomeSource) => ({
      amount: source.expectedAmount || 0,
      currency: source.currency || defaultCurrency,
    }))

    const convertedSources = convertToDefaultCurrency(
      sourceItems,
      defaultCurrency
    )
    const totalExpected = sumConverted(convertedSources)

    incomeSources.forEach((source: IncomeSource) => {
      const amount = source.expectedAmount || 0
      const currency = source.currency || defaultCurrency
      section += `• ${source.name}: ${formatMoney(amount, currency)}\n`
    })
    section += `Total: ${formatMoney(totalExpected, defaultCurrency)}\n`

    section += "\nActual:\n"
    if (totalIncomeCount > 0) {
      Object.entries(incomeTotals).forEach(([category, currencies]) => {
        const currencyStr = Object.entries(currencies)
          .map(([cur, amt]) => formatMoney(amt, cur))
          .join(" / ")
        section += `• ${getCategoryEmoji(category)} ${category}: ${currencyStr}\n`
      })
      section += `Total: ${formatMoney(totalIncomeInDefaultCurrency, defaultCurrency)}\n`
    } else {
      section += `• No income received yet\nTotal: 0 ${defaultCurrency}\n`
    }

    const difference = totalIncomeInDefaultCurrency - totalExpected
    const progress = createProgressBar(
      totalIncomeInDefaultCurrency,
      totalExpected
    )
    const progressPercent =
      totalExpected > 0
        ? ((totalIncomeInDefaultCurrency / totalExpected) * 100).toFixed(2)
        : "0.00"

    section += `\n📈 Progress: ${progress} ${progressPercent}%\n`

    if (difference >= 0) {
      section += `✅ Goal reached! +${formatMoney(difference, defaultCurrency)}\n`
    } else {
      // Позитивный прогресс вместо "Short by"
      const now = new Date()
      const lastDay = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate()
      const daysLeft = Math.max(1, lastDay - now.getDate())
      const remaining = Math.abs(difference)
      const dailyTarget = Math.ceil(remaining / daysLeft)

      section += `⚠️ Short by: ${formatMoney(remaining, defaultCurrency)}\n`
      section += `⏰ Days left: ${daysLeft}\n`
      section += `📈 Daily target: ~${formatMoney(dailyTarget, defaultCurrency)}\n`
    }
  } else if (totalIncomeCount > 0) {
    section += "💰 *Income*\n"
    Object.entries(incomeTotals).forEach(([category, currencies]) => {
      const currencyStr = Object.entries(currencies)
        .map(([cur, amt]) => formatMoney(amt, cur))
        .join(" / ")
      section += `• ${getCategoryEmoji(category)} ${category}: ${currencyStr}\n`
    })
  }

  return section
}

/**
 * Formats expense section
 */
function formatExpenseSection(
  expenseTotals: CategoryTotals,
  totalExpenseCount: number
): string {
  if (totalExpenseCount === 0) return ""

  let section = "📉 *Expenses*\n"
  Object.entries(expenseTotals).forEach(([category, currencies]) => {
    const currencyStr = Object.entries(currencies)
      .map(([cur, amt]) => formatMoney(amt, cur))
      .join(" / ")
    section += `• ${getCategoryEmoji(category)} ${category}: ${currencyStr}\n`
  })

  return section
}

/**
 * Formats trends section (vs last month)
 */
async function formatTrendsSection(
  userId: string,
  data: MonthlyStatsData,
  totalIncomeInDefaultCurrency: number,
  expenseTotals: CategoryTotals
): Promise<string> {
  const { year, month, defaultCurrency } = data

  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year

  const prevTransactions = await db.getTransactionsByMonth(
    userId,
    prevYear,
    prevMonth
  )

  if (prevTransactions.length === 0) return ""

  const prevIncomeItems = prevTransactions
    .filter((tx: Transaction) => tx.type === TransactionType.INCOME)
    .map((tx: Transaction) => ({
      amount: tx.amount,
      currency: tx.currency,
    }))

  const prevIncome = sumConverted(
    convertToDefaultCurrency(prevIncomeItems, defaultCurrency)
  )

  const prevExpenseItems = prevTransactions
    .filter((tx: Transaction) => tx.type === TransactionType.EXPENSE)
    .map((tx: Transaction) => ({
      amount: tx.amount,
      currency: tx.currency,
    }))

  const prevExpense = sumConverted(
    convertToDefaultCurrency(prevExpenseItems, defaultCurrency)
  )

  const currentExpenseItems: Array<{ amount: number; currency: Currency }> = []
  Object.entries(expenseTotals).forEach(([, currencies]) => {
    Object.entries(currencies).forEach(([cur, amt]) => {
      currentExpenseItems.push({
        amount: amt,
        currency: cur as Currency,
      })
    })
  })

  const currentExpense = sumConverted(
    convertToDefaultCurrency(currentExpenseItems, defaultCurrency)
  )

  let section = "\n📊 *vs Last Month*\n"

  const incomeDiff = totalIncomeInDefaultCurrency - prevIncome
  const incomePercent = prevIncome > 0 ? (incomeDiff / prevIncome) * 100 : 0

  if (incomeDiff > 0) {
    section += `💰 Income: +${formatMoney(incomeDiff, defaultCurrency)} (+${formatAmount(incomePercent)}%)\n`
  } else if (incomeDiff < 0) {
    section += `💰 Income: ${formatMoney(incomeDiff, defaultCurrency)} (${formatAmount(incomePercent)}%)\n`
  } else {
    section += `💰 Income: no change\n`
  }

  const expenseDiff = currentExpense - prevExpense
  const expensePercent = prevExpense > 0 ? (expenseDiff / prevExpense) * 100 : 0

  if (expenseDiff > 0) {
    section += `📉 Expenses: +${formatMoney(expenseDiff, defaultCurrency)} (+${formatAmount(expensePercent)}%)\n`
  } else if (expenseDiff < 0) {
    section += `📉 Expenses: ${formatMoney(Math.abs(expenseDiff), defaultCurrency)} (${formatAmount(Math.abs(expensePercent))}%)\n`
  } else {
    section += `📉 Expenses: no change\n`
  }

  return section
}

/**
 * Main monthly stats formatter
 */
export async function formatMonthlyStats(userId: string): Promise<string> {
  const data = await getMonthlyStatsData(userId)

  if (data.transactions.length === 0 && data.incomeSources.length === 0) {
    return "📊 No transactions this month."
  }

  const incomeTotals: CategoryTotals = {}
  const expenseTotals: CategoryTotals = {}
  let totalIncomeCount = 0
  let totalExpenseCount = 0

  const incomeTransactions = data.transactions.filter(
    (tx: Transaction) => tx.type === TransactionType.INCOME
  )

  const incomeItems = incomeTransactions.map((tx: Transaction) => ({
    amount: tx.amount,
    currency: tx.currency,
  }))

  const totalIncomeInDefaultCurrency = sumConverted(
    convertToDefaultCurrency(incomeItems, data.defaultCurrency)
  )

  data.transactions.forEach((tx: Transaction) => {
    if (tx.type === TransactionType.TRANSFER) return

    const targetMap =
      tx.type === TransactionType.INCOME ? incomeTotals : expenseTotals

    if (tx.type === TransactionType.INCOME) {
      totalIncomeCount++
    } else {
      totalExpenseCount++
    }

    if (!targetMap[tx.category]) {
      targetMap[tx.category] = {}
    }
    if (!targetMap[tx.category]![tx.currency]) {
      targetMap[tx.category]![tx.currency] = 0
    }

    targetMap[tx.category]![tx.currency]! += tx.amount
  })

  if (
    totalIncomeCount === 0 &&
    totalExpenseCount === 0 &&
    data.incomeSources.length === 0
  ) {
    return "📊 No Income or Expense transactions this month (only Transfers)."
  }

  const sections = [
    formatIncomeSection(
      data,
      incomeTotals,
      totalIncomeCount,
      totalIncomeInDefaultCurrency
    ),
    formatExpenseSection(expenseTotals, totalExpenseCount),
    await formatTrendsSection(
      userId,
      data,
      totalIncomeInDefaultCurrency,
      expenseTotals
    ),
  ].filter(Boolean)

  return `📈 *Monthly Report (${data.month + 1}/${data.year})*\n\n${sections.join("\n")}`
}
