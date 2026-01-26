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
  getMonthName,
} from "./helpers"
import { TransactionCategory } from "../types"

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
export function formatAnalyticsSummary(summary: AnalyticsSummary): string {
  const {
    stats,
    categories,
    topExpenses,
    insights,
    startDate,
    endDate,
    currency,
  } = summary

  let message = `📊 *Аналитика*\n`
  message += `📅 ${formatDateRange(startDate, endDate)}\n\n`

  // Period stats
  message += `*Общая статистика:*\n`
  message += `🟢 Доходы: ${formatAmount(stats.income, currency)}\n`
  message += `🔴 Расходы: ${formatAmount(stats.expense, currency)}\n`

  const balanceEmoji = stats.balance >= 0 ? "🟢" : "🔴"
  message += `${balanceEmoji} Баланс: ${formatAmount(stats.balance, currency)}\n`
  message += `📈 Транзакций: ${stats.transactions}\n\n`

  // Category breakdown
  if (categories.length > 0) {
    message += `*По категориям:*\n`

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
    message += `*💸 Топ трат:*\n`

    topExpenses.slice(0, 3).forEach((expense, index) => {
      const emoji = getCategoryEmoji(expense.category)
      message += `${index + 1}. ${emoji} ${expense.description}\n`
      message += `   ${formatAmount(expense.amount, currency)}\n`
    })

    message += "\n"
  }

  // Insights
  if (insights.length > 0) {
    message += `*💡 Инсайты:*\n`
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
  currency: string = "RUB"
): string {
  const { current, previous, change } = comparison

  let message = `🔄 *Сравнение периодов*\n\n`

  // Income comparison
  message += `*🟢 Доходы:*\n`
  message += `Текущий: ${formatAmount(current.income, currency)}\n`
  message += `Предыдущий: ${formatAmount(previous.income, currency)}\n`
  message += `Изменение: ${formatChangeWithArrow(change.income, change.incomePercent, currency)}\n\n`

  // Expense comparison
  message += `*🔴 Расходы:*\n`
  message += `Текущий: ${formatAmount(current.expense, currency)}\n`
  message += `Предыдущий: ${formatAmount(previous.expense, currency)}\n`
  message += `Изменение: ${formatChangeWithArrow(change.expense, change.expensePercent, currency)}\n\n`

  // Balance comparison
  message += `*📊 Баланс:*\n`
  message += `Текущий: ${formatAmount(current.balance, currency)}\n`
  message += `Предыдущий: ${formatAmount(previous.balance, currency)}\n`
  message += `Изменение: ${formatChangeWithArrow(change.balance, change.balancePercent, currency)}\n`

  return message
}

/**
 * Format spending patterns
 */
export function formatSpendingPatterns(
  patterns: SpendingPattern[],
  currency: string = "RUB"
): string {
  let message = `📈 *Паттерны трат*\n\n`

  patterns.forEach((pattern) => {
    message += `*${pattern.dayOfWeek}*\n`
    message += `Среднее: ${formatAmount(pattern.averageAmount, currency)}\n`
    message += `Транзакций: ${pattern.transactionCount}\n\n`
  })

  return message
}

/**
 * Format monthly trend
 */
export function formatMonthlyTrend(
  trend: MonthlyStats[],
  currency: string = "RUB"
): string {
  let message = `📉 *Тренд по месяцам*\n\n`

  trend.forEach((month) => {
    const [year, monthNum] = month.month.split("-")
    const date = new Date(parseInt(year!), parseInt(monthNum!) - 1, 1)
    const monthName = getMonthName(date)

    message += `*${monthName} ${year}*\n`
    message += `🟢 Доход: ${formatAmount(month.income, currency)}\n`
    message += `🔴 Расход: ${formatAmount(month.expense, currency)}\n`

    const balanceEmoji = month.balance >= 0 ? "🟢" : "🔴"
    message += `${balanceEmoji} Баланс: ${formatAmount(month.balance, currency)}\n\n`
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
  currency: string = "RUB"
): string {
  let message = `🏷️ *Категории расходов*\n\n`

  if (categories.length === 0) {
    return message + "Нет данных за этот период"
  }

  categories.forEach((cat, index) => {
    const emoji = getCategoryEmoji(cat.category)
    message += `${index + 1}. ${emoji} *${cat.category}*\n`
    message += `   Сумма: ${formatAmount(cat.total, currency)}\n`
    message += `   Доля: ${cat.percentage.toFixed(1)}%\n`
    message += `   Транзакций: ${cat.count}\n\n`
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
  currency: string = "RUB"
): string {
  const balanceEmoji = balance >= 0 ? "🟢" : "🔴"

  return (
    `📊 *Быстрая статистика*\n` +
    `🟢 Доход: ${formatAmount(income, currency)}\n` +
    `🔴 Расход: ${formatAmount(expense, currency)}\n` +
    `${balanceEmoji} Баланс: ${formatAmount(balance, currency)}`
  )
}
