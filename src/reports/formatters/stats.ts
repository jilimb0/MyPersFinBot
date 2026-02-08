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
import { Language, t, getCategoryLabel } from "../../i18n"

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
  totalIncomeInDefaultCurrency: number,
  lang: Language
): string {
  const { incomeSources, defaultCurrency } = data

  if (incomeSources.length === 0 && totalIncomeCount === 0) {
    return ""
  }

  let section = ""

  if (incomeSources.length > 0) {
    section += `${t(lang, "reports.stats.incomePlanTitle")}\n\n${t(
      lang,
      "reports.stats.expectedTitle"
    )}\n`

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
      section += `${t(lang, "reports.stats.lineItem", {
        name: source.name,
        amount: formatMoney(amount, currency),
      })}\n`
    })
    section += `${t(lang, "reports.stats.total", {
      amount: formatMoney(totalExpected, defaultCurrency),
    })}\n`

    section += `\n${t(lang, "reports.stats.actualTitle")}\n`
    if (totalIncomeCount > 0) {
      Object.entries(incomeTotals).forEach(([category, currencies]) => {
        const currencyStr = Object.entries(currencies)
          .map(([cur, amt]) => formatMoney(amt, cur))
          .join(" / ")
        section += `${t(lang, "reports.stats.categoryLine", {
          emoji: getCategoryEmoji(category),
          category: getCategoryLabel(lang, category),
          amount: currencyStr,
        })}\n`
      })
      section += `${t(lang, "reports.stats.total", {
        amount: formatMoney(totalIncomeInDefaultCurrency, defaultCurrency),
      })}\n`
    } else {
      section += `${t(lang, "reports.stats.noIncomeYet")}\n${t(
        lang,
        "reports.stats.total",
        { amount: `0 ${defaultCurrency}` }
      )}\n`
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

    section += `\n${t(lang, "reports.stats.progress", {
      bar: progress,
      percent: progressPercent,
    })}\n`

    if (difference >= 0) {
      section += `${t(lang, "reports.stats.goalReached", {
        amount: formatMoney(difference, defaultCurrency),
      })}\n`
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

      section += `${t(lang, "reports.stats.shortBy", {
        amount: formatMoney(remaining, defaultCurrency),
      })}\n`
      section += `${t(lang, "reports.stats.daysLeft", { days: daysLeft })}\n`
      section += `${t(lang, "reports.stats.dailyTarget", {
        amount: formatMoney(dailyTarget, defaultCurrency),
      })}\n`
    }
  } else if (totalIncomeCount > 0) {
    section += `${t(lang, "reports.stats.incomeTitle")}\n`
    Object.entries(incomeTotals).forEach(([category, currencies]) => {
      const currencyStr = Object.entries(currencies)
        .map(([cur, amt]) => formatMoney(amt, cur))
        .join(" / ")
      section += `${t(lang, "reports.stats.categoryLine", {
        emoji: getCategoryEmoji(category),
        category: getCategoryLabel(lang, category),
        amount: currencyStr,
      })}\n`
    })
  }

  return section
}

/**
 * Formats expense section
 */
function formatExpenseSection(
  expenseTotals: CategoryTotals,
  totalExpenseCount: number,
  lang: Language
): string {
  if (totalExpenseCount === 0) return ""

  let section = `${t(lang, "reports.stats.expensesTitle")}\n`
  Object.entries(expenseTotals).forEach(([category, currencies]) => {
    const currencyStr = Object.entries(currencies)
      .map(([cur, amt]) => formatMoney(amt, cur))
      .join(" / ")
    section += `${t(lang, "reports.stats.categoryLine", {
      emoji: getCategoryEmoji(category),
      category: getCategoryLabel(lang, category),
      amount: currencyStr,
    })}\n`
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
  expenseTotals: CategoryTotals,
  lang: Language
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

  let section = `\n${t(lang, "reports.stats.vsLastMonth")}\n`

  const incomeDiff = totalIncomeInDefaultCurrency - prevIncome
  const incomePercent = prevIncome > 0 ? (incomeDiff / prevIncome) * 100 : 0

  if (incomeDiff > 0) {
    section += `${t(lang, "reports.stats.vsIncomePositive", {
      amount: formatMoney(incomeDiff, defaultCurrency),
      percent: formatAmount(incomePercent),
    })}\n`
  } else if (incomeDiff < 0) {
    section += `${t(lang, "reports.stats.vsIncomeNegative", {
      amount: formatMoney(incomeDiff, defaultCurrency),
      percent: formatAmount(incomePercent),
    })}\n`
  } else {
    section += `${t(lang, "reports.stats.vsIncomeNoChange")}\n`
  }

  const expenseDiff = currentExpense - prevExpense
  const expensePercent = prevExpense > 0 ? (expenseDiff / prevExpense) * 100 : 0

  if (expenseDiff > 0) {
    section += `${t(lang, "reports.stats.vsExpensesPositive", {
      amount: formatMoney(expenseDiff, defaultCurrency),
      percent: formatAmount(expensePercent),
    })}\n`
  } else if (expenseDiff < 0) {
    section += `${t(lang, "reports.stats.vsExpensesNegative", {
      amount: formatMoney(Math.abs(expenseDiff), defaultCurrency),
      percent: formatAmount(Math.abs(expensePercent)),
    })}\n`
  } else {
    section += `${t(lang, "reports.stats.vsExpensesNoChange")}\n`
  }

  return section
}

/**
 * Main monthly stats formatter
 */
export async function formatMonthlyStats(userId: string): Promise<string> {
  const data = await getMonthlyStatsData(userId)
  const lang = await db.getUserLanguage(userId)

  if (data.transactions.length === 0 && data.incomeSources.length === 0) {
    return t(lang, "reports.stats.noTransactionsThisMonth")
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
    return t(lang, "reports.stats.noIncomeOrExpenseOnlyTransfers")
  }

  const sections = [
    formatIncomeSection(
      data,
      incomeTotals,
      totalIncomeCount,
      totalIncomeInDefaultCurrency,
      lang
    ),
    formatExpenseSection(expenseTotals, totalExpenseCount, lang),
    await formatTrendsSection(
      userId,
      data,
      totalIncomeInDefaultCurrency,
      expenseTotals,
      lang
    ),
  ].filter(Boolean)

  return `${t(lang, "reports.stats.monthlyTitle", {
    month: data.month + 1,
    year: data.year,
  })}\n\n${sections.join("\n")}`
}
