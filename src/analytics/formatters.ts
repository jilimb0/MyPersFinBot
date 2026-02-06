/**
 * Analytics formatters for Telegram messages
 */

import {
  AnalyticsSummary,
  ComparisonResult,
  CategoryStats,
  SpendingPattern,
  MonthlyStats,
} from "./types"
import {
  formatAmount,
  formatPercent,
  formatDateRange,
  getDayName,
  getMonthName,
} from "./helpers"
import { TransactionCategory } from "../types"
import { Language, t } from "../i18n"

/**
 * Category emoji map
 */
const categoryEmoji: Record<string, string> = {
  FOOD: "🍴",
  TRANSPORT: "🚗",
  SHOPPING: "🛍️",
  ENTERTAINMENT: "🎬",
  HEALTH: "⚕️",
  BILLS: "💳",
  EDUCATION: "🎓",
  TRAVEL: "✈️",
  SAVINGS: "💰",
  OTHER: "📄",
}

/**
 * Get category emoji
 */
function getCategoryEmoji(category: TransactionCategory | string): string {
  return categoryEmoji[category] || "📄"
}

/**
 * Format analytics summary
 */
export function formatAnalyticsSummary(
  summary: AnalyticsSummary,
  lang: Language = "ru"
): string {
  const {
    stats,
    categories,
    topExpenses,
    insights,
    startDate,
    endDate,
    currency,
  } = summary

  let message = `${t(lang, "analytics.formatters.summaryTitle")}\n`
  message += `${t(lang, "analytics.formatters.summaryPeriodLine", {
    range: formatDateRange(startDate, endDate, lang),
  })}\n\n`

  // Period stats
  message += `${t(lang, "analytics.formatters.summaryStatsTitle")}\n`
  message += `${t(lang, "analytics.formatters.summaryIncomeLine", {
    amount: formatAmount(stats.income, currency),
  })}\n`
  message += `${t(lang, "analytics.formatters.summaryExpenseLine", {
    amount: formatAmount(stats.expense, currency),
  })}\n`

  const balanceEmoji = stats.balance >= 0 ? "🟢" : "🔴"
  message += `${t(lang, "analytics.formatters.summaryBalanceLine", {
    emoji: balanceEmoji,
    amount: formatAmount(stats.balance, currency),
  })}\n`
  message += `${t(lang, "analytics.formatters.summaryTransactionsLine", {
    count: stats.transactions,
  })}\n\n`

  // Category breakdown
  if (categories.length > 0) {
    message += `${t(lang, "analytics.formatters.summaryByCategoryTitle")}\n`

    categories.slice(0, 5).forEach((cat) => {
      const emoji = getCategoryEmoji(cat.category)
      const bar = getProgressBar(cat.percentage, 10)
      message += `${emoji} ${cat.category}\n`
      message += `   ${bar} ${cat.percentage.toFixed(1)}%\n`
      message += `   ${formatAmount(cat.total, currency)}\n`
    })

    message += "\n"
  }

  // Top expenses
  if (topExpenses.length > 0) {
    message += `${t(lang, "analytics.formatters.summaryTopExpensesTitle")}\n`

    topExpenses.slice(0, 3).forEach((expense, index) => {
      const emoji = getCategoryEmoji(expense.category)
      const description = expense.description || t(lang, "common.noDescription")
      message += `${index + 1}. ${emoji} ${description}\n`
      message += `   ${formatAmount(expense.amount, currency)}\n`
    })

    message += "\n"
  }

  // Insights
  if (insights.length > 0) {
    message += `${t(lang, "analytics.formatters.summaryInsightsTitle")}\n`
    insights.forEach((insight) => {
      message += `• ${insight}\n`
    })
  }

  return message
}

/**
 * Format period comparison
 */
export function formatComparison(
  comparison: ComparisonResult,
  lang: Language = "ru",
  currency: string = "RUB"
): string {
  const { current, previous, change } = comparison

  let message = `${t(lang, "analytics.formatters.comparisonTitle")}\n\n`

  // Income comparison
  message += `${t(lang, "analytics.formatters.comparisonIncomeTitle")}\n`
  message += `${t(lang, "analytics.formatters.comparisonCurrentLine", {
    amount: formatAmount(current.income, currency),
  })}\n`
  message += `${t(lang, "analytics.formatters.comparisonPreviousLine", {
    amount: formatAmount(previous.income, currency),
  })}\n`
  message += `${t(lang, "analytics.formatters.comparisonChangeLine", {
    amount: formatChangeWithArrow(
      change.income,
      change.incomePercent,
      currency
    ),
  })}\n\n`

  // Expense comparison
  message += `${t(lang, "analytics.formatters.comparisonExpenseTitle")}\n`
  message += `${t(lang, "analytics.formatters.comparisonCurrentLine", {
    amount: formatAmount(current.expense, currency),
  })}\n`
  message += `${t(lang, "analytics.formatters.comparisonPreviousLine", {
    amount: formatAmount(previous.expense, currency),
  })}\n`
  message += `${t(lang, "analytics.formatters.comparisonChangeLine", {
    amount: formatChangeWithArrow(
      change.expense,
      change.expensePercent,
      currency
    ),
  })}\n\n`

  // Balance comparison
  message += `${t(lang, "analytics.formatters.comparisonBalanceTitle")}\n`
  message += `${t(lang, "analytics.formatters.comparisonCurrentLine", {
    amount: formatAmount(current.balance, currency),
  })}\n`
  message += `${t(lang, "analytics.formatters.comparisonPreviousLine", {
    amount: formatAmount(previous.balance, currency),
  })}\n`
  message += `${t(lang, "analytics.formatters.comparisonChangeLine", {
    amount: formatChangeWithArrow(
      change.balance,
      change.balancePercent,
      currency
    ),
  })}\n`

  return message
}

/**
 * Format spending patterns
 */
export function formatSpendingPatterns(
  patterns: SpendingPattern[],
  lang: Language = "ru",
  currency: string = "RUB"
): string {
  let message = `${t(lang, "analytics.formatters.patternsTitle")}\n\n`

  patterns.forEach((pattern) => {
    const baseDate = new Date(2020, 0, 5 + pattern.dayOfWeek)
    message += `*${getDayName(baseDate, lang)}*\n`
    message += `${t(lang, "analytics.formatters.patternsAverageLine", {
      amount: formatAmount(pattern.averageAmount, currency),
    })}\n`
    message += `${t(lang, "analytics.formatters.patternsTransactionsLine", {
      count: pattern.transactionCount,
    })}\n\n`
  })

  return message
}

/**
 * Format monthly trend
 */
export function formatMonthlyTrend(
  trend: MonthlyStats[],
  lang: Language = "ru",
  currency: string = "RUB"
): string {
  let message = `${t(lang, "analytics.formatters.monthlyTrendTitle")}\n\n`

  trend.forEach((month) => {
    const [year, monthNum] = month.month.split("-")
    const date = new Date(parseInt(year!), parseInt(monthNum!) - 1, 1)
    const monthName = getMonthName(date, lang)

    message += `*${monthName} ${year}*\n`
    message += `${t(lang, "analytics.formatters.monthlyTrendIncomeLine", {
      amount: formatAmount(month.income, currency),
    })}\n`
    message += `${t(lang, "analytics.formatters.monthlyTrendExpenseLine", {
      amount: formatAmount(month.expense, currency),
    })}\n`

    const balanceEmoji = month.balance >= 0 ? "🟢" : "🔴"
    message += `${t(lang, "analytics.formatters.monthlyTrendBalanceLine", {
      emoji: balanceEmoji,
      amount: formatAmount(month.balance, currency),
    })}\n\n`
  })

  return message
}

/**
 * Format change with arrow
 */
function formatChangeWithArrow(
  amount: number,
  percent: number,
  currency: string
): string {
  const arrow = amount > 0 ? "⬆️" : amount < 0 ? "⬇️" : "➡️"
  const sign = amount > 0 ? "+" : ""
  return `${arrow} ${sign}${formatAmount(amount, currency)} (${formatPercent(percent)})`
}

/**
 * Get progress bar
 */
function getProgressBar(percent: number, length: number = 10): string {
  const filled = Math.round((percent / 100) * length)
  const empty = length - filled
  return "█".repeat(filled) + "░".repeat(empty)
}

/**
 * Format category list
 */
export function formatCategories(
  categories: CategoryStats[],
  lang: Language = "ru",
  currency: string = "RUB"
): string {
  let message = `${t(lang, "analytics.formatters.categoriesTitle")}\n\n`

  if (categories.length === 0) {
    return message + t(lang, "analytics.formatters.categoriesEmpty")
  }

  categories.forEach((cat, index) => {
    const emoji = getCategoryEmoji(cat.category)
    message += `${index + 1}. ${emoji} *${cat.category}*\n`
    message += `   ${t(lang, "analytics.formatters.categoriesAmountLine", {
      amount: formatAmount(cat.total, currency),
    })}\n`
    message += `   ${t(lang, "analytics.formatters.categoriesShareLine", {
      percent: cat.percentage.toFixed(1),
    })}\n`
    message += `   ${t(
      lang,
      "analytics.formatters.categoriesTransactionsLine",
      {
        count: cat.count,
      }
    )}\n\n`
  })

  return message
}

/**
 * Format quick stats (short version)
 */
export function formatQuickStats(
  income: number,
  expense: number,
  balance: number,
  lang: Language = "ru",
  currency: string = "RUB"
): string {
  const balanceEmoji = balance >= 0 ? "🟢" : "🔴"

  return (
    `${t(lang, "analytics.formatters.quickStatsTitle")}\n` +
    `${t(lang, "analytics.formatters.quickStatsIncomeLine", {
      amount: formatAmount(income, currency),
    })}\n` +
    `${t(lang, "analytics.formatters.quickStatsExpenseLine", {
      amount: formatAmount(expense, currency),
    })}\n` +
    t(lang, "analytics.formatters.quickStatsBalanceLine", {
      emoji: balanceEmoji,
      amount: formatAmount(balance, currency),
    })
  )
}
