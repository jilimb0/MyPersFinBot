/**
 * Smart alerts for unusual spending patterns
 */

import { dbStorage } from "../database/storage-db"
import { convertSync } from "../fx"
import { Transaction, TransactionCategory, Currency } from "../types"
import { Notification, SpendingPattern } from "./types"
import logger from "../logger"
import { randomUUID } from "crypto"
import { Language, t } from "../i18n"

export class SmartAlerts {
  /**
   * Check for unusual expenses
   */
  async checkUnusualExpenses(
    userId: string,
    multiplier: number = 2
  ): Promise<Notification[]> {
    try {
      const userData = await dbStorage.getUserData(userId)
      const lang = await dbStorage.getUserLanguage(userId)
      const defaultCurrency = userData.defaultCurrency
      const notifications: Notification[] = []

      // Get last 30 days transactions
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const transactions = await dbStorage.getTransactionsByDateRange(
        userId,
        thirtyDaysAgo,
        new Date()
      )

      const expenses = transactions.filter((tx) => tx.type === "EXPENSE")

      // Group by category and calculate averages
      const categoryAverages = this.calculateCategoryAverages(
        expenses,
        defaultCurrency
      )

      // Get today's transactions
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayTransactions = await dbStorage.getTransactionsByDateRange(
        userId,
        today,
        new Date()
      )

      // Check for unusual expenses
      for (const tx of todayTransactions) {
        if (tx.type !== "EXPENSE") continue

        const average = categoryAverages.get(tx.category)
        if (!average) continue

        const txAmount = convertSync(tx.amount, tx.currency, defaultCurrency)

        if (txAmount >= average * multiplier) {
          notifications.push(
            this.createUnusualExpenseAlert(
              userId,
              tx,
              average,
              txAmount,
              defaultCurrency,
              lang
            )
          )
        }
      }

      return notifications
    } catch (error) {
      logger.error("Unusual expense check error", error, { userId })
      return []
    }
  }

  /**
   * Check for frequent spending patterns
   */
  async checkFrequentSpending(
    userId: string,
    consecutiveDays: number = 3
  ): Promise<Notification[]> {
    try {
      const notifications: Notification[] = []
      const userData = await dbStorage.getUserData(userId)
      const lang = await dbStorage.getUserLanguage(userId)
      const defaultCurrency = userData.defaultCurrency

      // Get last N days
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - consecutiveDays)
      startDate.setHours(0, 0, 0, 0)

      const transactions = await dbStorage.getTransactionsByDateRange(
        userId,
        startDate,
        new Date()
      )

      const expenses = transactions.filter((tx) => tx.type === "EXPENSE")

      // Group by category and check daily spending
      const categoryPatterns = this.findSpendingPatterns(
        expenses,
        consecutiveDays,
        defaultCurrency
      )

      for (const pattern of categoryPatterns) {
        notifications.push(
          this.createFrequentSpendingAlert(userId, pattern, lang)
        )
      }

      return notifications
    } catch (error) {
      logger.error("Frequent spending check error", error, { userId })
      return []
    }
  }

  /**
   * Check for spending spikes
   */
  async checkSpendingSpike(userId: string): Promise<Notification | null> {
    try {
      const userData = await dbStorage.getUserData(userId)
      const lang = await dbStorage.getUserLanguage(userId)
      const defaultCurrency = userData.defaultCurrency

      // Get this week vs last week
      const thisWeekStart = new Date()
      const dayOfWeek = thisWeekStart.getDay()
      thisWeekStart.setDate(thisWeekStart.getDate() - dayOfWeek)
      thisWeekStart.setHours(0, 0, 0, 0)

      const lastWeekStart = new Date(thisWeekStart)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)

      const lastWeekEnd = new Date(thisWeekStart)
      lastWeekEnd.setSeconds(lastWeekEnd.getSeconds() - 1)

      const [thisWeekTxs, lastWeekTxs] = await Promise.all([
        dbStorage.getTransactionsByDateRange(userId, thisWeekStart, new Date()),
        dbStorage.getTransactionsByDateRange(
          userId,
          lastWeekStart,
          lastWeekEnd
        ),
      ])

      const thisWeekSpending = this.calculateTotalExpenses(
        thisWeekTxs,
        defaultCurrency
      )
      const lastWeekSpending = this.calculateTotalExpenses(
        lastWeekTxs,
        defaultCurrency
      )

      const increase = thisWeekSpending - lastWeekSpending
      const percentageIncrease =
        lastWeekSpending > 0 ? (increase / lastWeekSpending) * 100 : 0

      // Alert if spending increased by more than 50%
      if (percentageIncrease > 50) {
        return {
          id: randomUUID(),
          userId,
          type: "SPENDING_SPIKE",
          priority: "MEDIUM",
          title: t(lang, "notifications.alerts.spendingSpike.title"),
          message: t(lang, "notifications.alerts.spendingSpike.message", {
            percentage: percentageIncrease.toFixed(0),
            lastWeek: lastWeekSpending.toFixed(2),
            thisWeek: thisWeekSpending.toFixed(2),
            increase: increase.toFixed(2),
            currency: defaultCurrency,
          }),
          data: {
            thisWeek: thisWeekSpending,
            lastWeek: lastWeekSpending,
            increase,
            percentage: percentageIncrease,
          },
          createdAt: new Date(),
          sent: false,
        }
      }

      return null
    } catch (error) {
      logger.error("Spending spike check error", error, { userId })
      return null
    }
  }

  /**
   * Calculate category averages
   */
  private calculateCategoryAverages(
    expenses: Transaction[],
    defaultCurrency: Currency
  ): Map<TransactionCategory, number> {
    const categoryTotals = new Map<
      TransactionCategory,
      { total: number; count: number }
    >()

    for (const tx of expenses) {
      const amount = convertSync(tx.amount, tx.currency, defaultCurrency)
      const current = categoryTotals.get(tx.category) || { total: 0, count: 0 }
      current.total += amount
      current.count += 1
      categoryTotals.set(tx.category, current)
    }

    const averages = new Map<TransactionCategory, number>()
    categoryTotals.forEach((value, key) => {
      averages.set(key, value.total / value.count)
    })

    return averages
  }

  /**
   * Find spending patterns
   */
  private findSpendingPatterns(
    expenses: Transaction[],
    consecutiveDays: number,
    defaultCurrency: Currency
  ): SpendingPattern[] {
    const patterns: SpendingPattern[] = []
    const byCategory = new Map<TransactionCategory, Transaction[]>()

    // Group by category
    for (const tx of expenses) {
      const list = byCategory.get(tx.category) || []
      list.push(tx)
      byCategory.set(tx.category, list)
    }

    // Check each category
    byCategory.forEach((txs, category) => {
      // Group by day
      const byDay = new Map<string, Transaction[]>()
      for (const tx of txs) {
        const day = new Date(tx.date).toISOString().split("T")[0]
        const list = byDay.get(day!) || []
        list.push(tx)
        byDay.set(day!, list)
      }

      // Check if spent on consecutive days
      if (byDay.size >= consecutiveDays) {
        const totalAmount = txs.reduce(
          (sum, tx) =>
            sum + convertSync(tx.amount, tx.currency, defaultCurrency),
          0
        )

        patterns.push({
          category,
          consecutiveDays: byDay.size,
          totalAmount,
          averageDailyAmount: totalAmount / byDay.size,
          currency: defaultCurrency,
        })
      }
    })

    return patterns
  }

  /**
   * Calculate total expenses
   */
  private calculateTotalExpenses(
    transactions: Transaction[],
    currency: Currency
  ): number {
    return transactions
      .filter((tx) => tx.type === "EXPENSE")
      .reduce(
        (sum, tx) => sum + convertSync(tx.amount, tx.currency, currency),
        0
      )
  }

  /**
   * Create unusual expense alert
   */
  private createUnusualExpenseAlert(
    userId: string,
    transaction: Transaction,
    average: number,
    amount: number,
    currency: Currency,
    lang: Language
  ): Notification {
    const multiplier = amount / average
    const description =
      transaction.description ||
      t(lang, "notifications.alerts.common.noDescription")
    const category = transaction.category

    return {
      id: randomUUID(),
      userId,
      type: "UNUSUAL_EXPENSE",
      priority: "MEDIUM",
      title: t(lang, "notifications.alerts.unusualExpense.title"),
      message: t(lang, "notifications.alerts.unusualExpense.message", {
        category,
        amount: amount.toFixed(2),
        average: average.toFixed(2),
        multiplier: multiplier.toFixed(1),
        currency,
        description,
      }),
      data: {
        transactionId: transaction.id,
        amount,
        category: transaction.category,
        averageAmount: average,
        multiplier,
      },
      createdAt: new Date(),
      sent: false,
    }
  }

  /**
   * Create frequent spending alert
   */
  private createFrequentSpendingAlert(
    userId: string,
    pattern: SpendingPattern,
    lang: Language
  ): Notification {
    return {
      id: randomUUID(),
      userId,
      type: "FREQUENT_SPENDING",
      priority: "LOW",
      title: t(lang, "notifications.alerts.frequentSpending.title"),
      message: t(lang, "notifications.alerts.frequentSpending.message", {
        category: pattern.category,
        days: pattern.consecutiveDays,
        total: pattern.totalAmount.toFixed(2),
        average: pattern.averageDailyAmount.toFixed(2),
        currency: pattern.currency,
      }),
      data: pattern,
      createdAt: new Date(),
      sent: false,
    }
  }
}

/**
 * Default smart alerts instance
 */
export const smartAlerts = new SmartAlerts()
export default smartAlerts
