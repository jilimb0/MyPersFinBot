/**
 * Budget alerts
 */

import { dbStorage } from "../database/storage-db"
import { convertSync } from "../fx"
import { Notification, NotificationPriority } from "./types"
import logger from "../logger"
import { randomUUID } from "crypto"
import { Budget } from "../types"
import { BudgetPeriod } from "../database/entities/Budget"

export class BudgetAlerts {
  /**
   * Check all budgets and generate alerts
   */
  async checkBudgets(
    userId: string,
    warningThreshold: number = 80
  ): Promise<Notification[]> {
    try {
      const userData = await dbStorage.getUserData(userId)
      const notifications: Notification[] = []

      // Check each budget
      for (const budget of userData.budgets) {
        const alert = await this.checkBudget(userId, budget, warningThreshold)
        if (alert) {
          notifications.push(alert)
        }
      }

      return notifications
    } catch (error) {
      logger.error("Budget check error", error, { userId })
      return []
    }
  }

  /**
   * Check single budget
   */
  private async checkBudget(
    userId: string,
    budget: any,
    warningThreshold: number
  ): Promise<Notification | null> {
    try {
      // Get current period transactions
      const { start, end } = this.getBudgetPeriod(budget.period)
      const transactions = await dbStorage.getTransactionsByDateRange(
        userId,
        start,
        end
      )

      // Filter by category if budget is category-specific
      const categoryTransactions = budget.category
        ? transactions.filter(
            (tx) => tx.category === budget.category && tx.type === "EXPENSE"
          )
        : transactions.filter((tx) => tx.type === "EXPENSE")

      // Calculate spent amount
      const spent = categoryTransactions.reduce((sum, tx) => {
        return sum + convertSync(tx.amount, tx.currency, budget.currency)
      }, 0)

      const percentage = (spent / budget.amount) * 100
      const remaining = budget.amount - spent

      // Generate alert if needed
      if (percentage >= 100) {
        return this.createExceededAlert(
          userId,
          budget,
          spent,
          percentage,
          remaining
        )
      } else if (percentage >= warningThreshold) {
        return this.createWarningAlert(
          userId,
          budget,
          spent,
          percentage,
          remaining
        )
      }

      return null
    } catch (error) {
      logger.error("Budget check error", error, { userId, budgetId: budget.id })
      return null
    }
  }

  /**
   * Create exceeded budget alert
   */
  private createExceededAlert(
    userId: string,
    budget: any,
    spent: number,
    percentage: number,
    remaining: number
  ): Notification {
    const overspent = Math.abs(remaining)

    return {
      id: randomUUID(),
      userId,
      type: "BUDGET_EXCEEDED",
      priority: "HIGH" as NotificationPriority,
      title: "🚨 Бюджет превышен!",
      message:
        `*${budget.category || "Общий"} бюджет превышен!*\n\n` +
        `Лимит: ${budget.amount.toFixed(2)} ${budget.currency}\n` +
        `Потрачено: ${spent.toFixed(2)} ${budget.currency}\n` +
        `Превышение: ${overspent.toFixed(2)} ${budget.currency} (${percentage.toFixed(0)}%)\n\n` +
        `⚠️ Рекомендуем сократить расходы в этой категории!`,
      data: {
        budgetId: budget.id,
        category: budget.category,
        limit: budget.amount,
        spent,
        percentage,
        overspent,
      },
      createdAt: new Date(),
      sent: false,
    }
  }

  /**
   * Create warning alert
   */
  private createWarningAlert(
    userId: string,
    budget: any,
    spent: number,
    percentage: number,
    remaining: number
  ): Notification {
    return {
      id: randomUUID(),
      userId,
      type: "BUDGET_WARNING",
      priority: "MEDIUM" as NotificationPriority,
      title: "⚠️ Предупреждение о бюджете",
      message:
        `*${budget.category || "Общий"} бюджет*\n\n` +
        `Лимит: ${budget.amount.toFixed(2)} ${budget.currency}\n` +
        `Потрачено: ${spent.toFixed(2)} ${budget.currency} (${percentage.toFixed(0)}%)\n` +
        `Осталось: ${remaining.toFixed(2)} ${budget.currency}\n\n` +
        `💡 Вы использовали ${percentage.toFixed(0)}% бюджета`,
      data: {
        budgetId: budget.id,
        category: budget.category,
        limit: budget.amount,
        spent,
        percentage,
        remaining,
      },
      createdAt: new Date(),
      sent: false,
    }
  }

  /**
   * Get budget period dates
   */
  private getBudgetPeriod(period: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"): {
    start: Date
    end: Date
  } {
    const now = new Date()
    const start = new Date()

    switch (period) {
      case "DAILY":
        start.setHours(0, 0, 0, 0)
        break
      case "WEEKLY":
        const day = now.getDay()
        start.setDate(now.getDate() - day)
        start.setHours(0, 0, 0, 0)
        break
      case "MONTHLY":
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        break
      case "YEARLY":
        start.setMonth(0, 1)
        start.setHours(0, 0, 0, 0)
        break
    }

    return { start, end: now }
  }

  /**
   * Get daily budget remaining
   */
  async getDailyRemaining(userId: string): Promise<{
    total: number
    byCategory: Map<string, number>
  }> {
    const userData = await dbStorage.getUserData(userId)
    const dailyBudgets = userData.budgets.filter(
      (b: Budget) => b.period === BudgetPeriod.DAILY
    )

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const transactions = await dbStorage.getTransactionsByDateRange(
      userId,
      today,
      new Date()
    )

    let totalRemaining = 0
    const byCategory = new Map<string, number>()

    for (const budget of dailyBudgets) {
      const categoryTxs = budget.category
        ? transactions.filter(
            (tx) => tx.category === budget.category && tx.type === "EXPENSE"
          )
        : transactions.filter((tx) => tx.type === "EXPENSE")

      const spent = categoryTxs.reduce((sum, tx) => {
        return sum + convertSync(tx.amount, tx.currency, budget.currency)
      }, 0)

      const remaining = budget.amount - spent
      totalRemaining += remaining

      if (budget.category) {
        byCategory.set(budget.category, remaining)
      }
    }

    return { total: totalRemaining, byCategory }
  }
}

/**
 * Default budget alerts instance
 */
export const budgetAlerts = new BudgetAlerts()
export default budgetAlerts
