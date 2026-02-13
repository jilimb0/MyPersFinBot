/**
 * Analytics service
 * Provides financial insights and statistics
 */

import { dbStorage } from "../database/storage-db"
import logger from "../logger"
import {
  type Currency,
  type Transaction,
  type TransactionCategory,
  TransactionType,
} from "../types"
import {
  calculatePercentChange,
  getPeriodRange,
  getPreviousPeriodRange,
  groupByDay,
  groupByMonth,
} from "./helpers"
import type {
  AnalyticsPeriod,
  AnalyticsSummary,
  CategoryStats,
  ComparisonResult,
  DailyStats,
  MonthlyStats,
  PeriodStats,
  SpendingPattern,
} from "./types"

export class AnalyticsService {
  /**
   * Get analytics summary for period
   */
  async getSummary(
    userId: string,
    period: AnalyticsPeriod = "month",
    currency: Currency = "RUB"
  ): Promise<AnalyticsSummary> {
    try {
      const { start, end } = getPeriodRange(period)

      // Get transactions
      const transactions = await dbStorage.getTransactions(userId, {
        startDate: start,
        endDate: end,
        currency,
      })

      // Calculate period stats
      const stats = this.calculatePeriodStats(transactions)

      // Calculate category breakdown
      const categories = this.calculateCategoryStats(transactions)

      // Get daily breakdown
      const daily = this.calculateDailyStats(transactions)

      // Get top expenses
      const topExpenses = transactions
        .filter((tx: Transaction) => tx.type === TransactionType.EXPENSE)
        .sort((a: Transaction, b: Transaction) => b.amount - a.amount)
        .slice(0, 5)
        .map((tx: Transaction) => ({
          description: tx.description || "",
          amount: tx.amount,
          category: tx.category,
          date: new Date(tx.date),
        }))

      // Generate insights
      const insights = await this.generateInsights(
        userId,
        stats,
        categories,
        period
      )

      return {
        period,
        startDate: start,
        endDate: end,
        currency,
        stats,
        categories,
        daily,
        topExpenses,
        insights,
      }
    } catch (error) {
      logger.error("Error getting analytics summary", error, { userId, period })
      throw error
    }
  }

  /**
   * Compare current period with previous
   */
  async comparePeriods(
    userId: string,
    period: AnalyticsPeriod = "month",
    currency: Currency = "RUB"
  ): Promise<ComparisonResult> {
    try {
      const currentRange = getPeriodRange(period)
      const previousRange = getPreviousPeriodRange(period)

      // Get transactions for both periods
      const [currentTxs, previousTxs] = await Promise.all([
        dbStorage.getTransactions(userId, {
          startDate: currentRange.start,
          endDate: currentRange.end,
          currency,
        }),
        dbStorage.getTransactions(userId, {
          startDate: previousRange.start,
          endDate: previousRange.end,
          currency,
        }),
      ])

      const current = this.calculatePeriodStats(currentTxs)
      const previous = this.calculatePeriodStats(previousTxs)

      return {
        current,
        previous,
        change: {
          income: current.income - previous.income,
          expense: current.expense - previous.expense,
          balance: current.balance - previous.balance,
          incomePercent: calculatePercentChange(
            current.income,
            previous.income
          ),
          expensePercent: calculatePercentChange(
            current.expense,
            previous.expense
          ),
          balancePercent: calculatePercentChange(
            current.balance,
            previous.balance
          ),
        },
      }
    } catch (error) {
      logger.error("Error comparing periods", error, { userId, period })
      throw error
    }
  }

  /**
   * Get spending patterns by day of week
   */
  async getSpendingPatterns(
    userId: string,
    period: AnalyticsPeriod = "month",
    currency: Currency = "RUB"
  ): Promise<SpendingPattern[]> {
    try {
      const { start, end } = getPeriodRange(period)

      const transactions = await dbStorage.getTransactions(userId, {
        startDate: start,
        endDate: end,
        currency,
        type: TransactionType.EXPENSE,
      })

      // Group by day of week
      const byDay = new Map<number, { total: number; count: number }>()

      transactions.forEach((tx: Transaction) => {
        const dayOfWeek = new Date(tx.date).getDay()

        if (!byDay.has(dayOfWeek)) {
          byDay.set(dayOfWeek, { total: 0, count: 0 })
        }

        const stats = byDay.get(dayOfWeek)!
        stats.total += tx.amount
        stats.count += 1
      })

      // Convert to array with averages
      return Array.from(byDay.entries())
        .map(([day, stats]) => ({
          dayOfWeek: day,
          averageAmount: stats.total / stats.count,
          transactionCount: stats.count,
        }))
        .sort((a, b) => b.averageAmount - a.averageAmount)
    } catch (error) {
      logger.error("Error getting spending patterns", error, { userId })
      throw error
    }
  }

  /**
   * Get monthly trend (last N months)
   */
  async getMonthlyTrend(
    userId: string,
    months: number = 6,
    currency: Currency = "RUB"
  ): Promise<MonthlyStats[]> {
    try {
      const end = new Date()
      const start = new Date()
      start.setMonth(start.getMonth() - months)

      const transactions = await dbStorage.getTransactions(userId, {
        startDate: start,
        endDate: end,
        currency,
      })

      // Group by month
      const grouped = groupByMonth(transactions)

      // Calculate stats for each month
      const stats: MonthlyStats[] = []

      grouped.forEach((txs, monthKey) => {
        const income = txs
          .filter((tx) => tx.type === TransactionType.INCOME)
          .reduce((sum, tx) => sum + tx.amount, 0)

        const expense = txs
          .filter((tx) => tx.type === TransactionType.EXPENSE)
          .reduce((sum, tx) => sum + tx.amount, 0)

        stats.push({
          month: monthKey,
          income,
          expense,
          balance: income - expense,
          transactions: txs.length,
        })
      })

      return stats.sort((a, b) => a.month.localeCompare(b.month))
    } catch (error) {
      logger.error("Error getting monthly trend", error, { userId })
      throw error
    }
  }

  /**
   * Calculate period statistics
   */
  private calculatePeriodStats(transactions: Transaction[]): PeriodStats {
    const income = transactions
      .filter((tx) => tx.type === TransactionType.INCOME)
      .reduce((sum, tx) => sum + tx.amount, 0)

    const expense = transactions
      .filter((tx) => tx.type === TransactionType.EXPENSE)
      .reduce((sum, tx) => sum + tx.amount, 0)

    const balance = income - expense
    const count = transactions.length
    const averageTransaction = count > 0 ? (income + expense) / count : 0

    return {
      income,
      expense,
      balance,
      transactions: count,
      averageTransaction,
    }
  }

  /**
   * Calculate category statistics
   */
  private calculateCategoryStats(transactions: Transaction[]): CategoryStats[] {
    const expenses = transactions.filter(
      (tx) => tx.type === TransactionType.EXPENSE
    )
    const totalExpense = expenses.reduce((sum, tx) => sum + tx.amount, 0)

    // Group by category
    const byCategory = new Map<
      TransactionCategory,
      { total: number; count: number }
    >()

    expenses.forEach((tx) => {
      const category = (tx.category || "OTHER") as TransactionCategory

      if (!byCategory.has(category)) {
        byCategory.set(category, { total: 0, count: 0 })
      }

      const stats = byCategory.get(category)!
      stats.total += tx.amount
      stats.count += 1
    })

    // Convert to array with percentages
    return Array.from(byCategory.entries())
      .map(([category, stats]) => ({
        category,
        total: stats.total,
        count: stats.count,
        percentage: totalExpense > 0 ? (stats.total / totalExpense) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }

  /**
   * Calculate daily statistics
   */
  private calculateDailyStats(transactions: Transaction[]): DailyStats[] {
    const grouped = groupByDay(transactions)
    const stats: DailyStats[] = []

    grouped.forEach((txs, date) => {
      const income = txs
        .filter((tx) => tx.type === TransactionType.INCOME)
        .reduce((sum, tx) => sum + tx.amount, 0)

      const expense = txs
        .filter((tx) => tx.type === TransactionType.EXPENSE)
        .reduce((sum, tx) => sum + tx.amount, 0)

      stats.push({
        date,
        income,
        expense,
        balance: income - expense,
      })
    })

    return stats.sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Generate insights based on data
   */
  private async generateInsights(
    _userId: string,
    stats: PeriodStats,
    categories: CategoryStats[],
    _period: AnalyticsPeriod
  ): Promise<string[]> {
    const insights: string[] = []

    // Balance insight
    if (stats.balance > 0) {
      insights.push(`💰 Положительный баланс: +${stats.balance.toFixed(2)}`)
    } else if (stats.balance < 0) {
      insights.push(`⚠️ Отрицательный баланс: ${stats.balance.toFixed(2)}`)
    }

    // Top category
    if (categories.length > 0) {
      const top = categories[0]
      insights.push(
        `📊 Больше всего трат в категории: ${top?.category} (${top?.percentage.toFixed(1)}%)`
      )
    }

    // Average transaction
    if (stats.transactions > 0) {
      insights.push(
        `📈 Средняя транзакция: ${stats.averageTransaction.toFixed(2)}`
      )
    }

    // Savings rate
    if (stats.income > 0) {
      const savingsRate = ((stats.income - stats.expense) / stats.income) * 100
      if (savingsRate > 20) {
        insights.push(
          `✅ Отличная норма сбережений: ${savingsRate.toFixed(1)}%`
        )
      } else if (savingsRate < 0) {
        insights.push(
          `⚠️ Расходы превышают доходы на ${Math.abs(savingsRate).toFixed(1)}%`
        )
      }
    }

    return insights
  }
}

/**
 * Default analytics instance
 */
export const analyticsService = new AnalyticsService()
export default analyticsService
