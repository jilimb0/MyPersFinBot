/**
 * Main notification service
 */

import { budgetAlerts } from "./budget-alerts"
import { smartAlerts } from "./smart-alerts"
import {
  Notification,
  NotificationConfig,
  DEFAULT_NOTIFICATION_CONFIG,
} from "./types"
import { dbStorage } from "../database/storage-db"
import logger from "../logger"
import TelegramBot from "node-telegram-bot-api"

export class NotificationService {
  private config: Map<string, NotificationConfig> = new Map()

  /**
   * Get user notification config
   */
  async getConfig(userId: string): Promise<NotificationConfig> {
    const cached = this.config.get(userId)
    if (cached) return cached

    // Load from database (implement storage later)
    // For now, return default
    const config = { ...DEFAULT_NOTIFICATION_CONFIG }
    this.config.set(userId, config)
    return config
  }

  /**
   * Update user notification config
   */
  async updateConfig(
    userId: string,
    config: Partial<NotificationConfig>
  ): Promise<void> {
    const current = await this.getConfig(userId)
    const updated = { ...current, ...config }
    this.config.set(userId, updated)
    // TODO: Save to database
  }

  /**
   * Check all notifications for user
   */
  async checkNotifications(userId: string): Promise<Notification[]> {
    const config = await this.getConfig(userId)
    if (!config.enabled) return []

    const notifications: Notification[] = []

    try {
      // Budget alerts
      if (config.budgetAlerts.enabled) {
        const budgetNotifications = await budgetAlerts.checkBudgets(
          userId,
          config.budgetAlerts.warningThreshold
        )
        notifications.push(...budgetNotifications)
      }

      // Smart alerts
      if (config.smartAlerts.enabled) {
        const unusualExpenses = await smartAlerts.checkUnusualExpenses(
          userId,
          config.smartAlerts.unusualExpenseMultiplier
        )
        notifications.push(...unusualExpenses)

        const frequentSpending = await smartAlerts.checkFrequentSpending(
          userId,
          config.smartAlerts.frequentSpendingDays
        )
        notifications.push(...frequentSpending)

        const spendingSpike = await smartAlerts.checkSpendingSpike(userId)
        if (spendingSpike) {
          notifications.push(spendingSpike)
        }
      }

      return notifications
    } catch (error) {
      logger.error("Check notifications error", error, { userId })
      return []
    }
  }

  /**
   * Send notification to user
   */
  async sendNotification(
    bot: TelegramBot,
    notification: Notification
  ): Promise<void> {
    try {
      const message = `${notification.title}\n\n${notification.message}`

      await bot.sendMessage(notification.userId, message, {
        parse_mode: "Markdown",
        reply_markup: this.getNotificationKeyboard(notification),
      })

      notification.sent = true
      notification.sentAt = new Date()

      logger.info("Notification sent", {
        userId: notification.userId,
        type: notification.type,
      })
    } catch (error) {
      logger.error("Send notification error", error, {
        notificationId: notification.id,
      })
      throw error
    }
  }

  /**
   * Send multiple notifications
   */
  async sendNotifications(
    bot: TelegramBot,
    notifications: Notification[]
  ): Promise<void> {
    for (const notification of notifications) {
      try {
        await this.sendNotification(bot, notification)
        // Add delay between messages
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        logger.error("Failed to send notification", error, {
          notificationId: notification.id,
        })
        // Continue with other notifications
      }
    }
  }

  /**
   * Get keyboard for notification
   */

  private getNotificationKeyboard(notification: Notification): any {
    const keyboard: any[][] = []

    switch (notification.type) {
      case "BUDGET_EXCEEDED":
      case "BUDGET_WARNING":
        keyboard.push(
          [
            {
              text: "📊 Посмотреть бюджет",
              callback_data: `view_budget|${notification.data?.budgetId}`,
            },
          ],
          [
            {
              text: "💸 Посмотреть расходы",
              callback_data: `view_expenses|${notification.data?.category}`,
            },
          ]
        )
        break

      case "UNUSUAL_EXPENSE":
        keyboard.push([
          {
            text: "📝 Посмотреть транзакцию",
            callback_data: `view_transaction|${notification.data?.transactionId}`,
          },
        ])
        break

      case "SPENDING_SPIKE":
        keyboard.push([
          {
            text: "📊 Статистика недели",
            callback_data: "view_weekly_stats",
          },
        ])
        break
    }

    // Add dismiss button
    keyboard.push([
      {
        text: "✅ Понятно",
        callback_data: `dismiss_notification|${notification.id}`,
      },
    ])

    return { inline_keyboard: keyboard }
  }

  /**
   * Get daily summary
   */
  async getDailySummary(userId: string): Promise<string> {
    try {
      const userData = await dbStorage.getUserData(userId)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const transactions = await dbStorage.getTransactionsByDateRange(
        userId,
        today,
        new Date()
      )

      const expenses = transactions.filter((tx) => tx.type === "EXPENSE")
      const income = transactions.filter((tx) => tx.type === "INCOME")

      const totalExpenses = expenses.reduce((sum, tx) => sum + tx.amount, 0)
      const totalIncome = income.reduce((sum, tx) => sum + tx.amount, 0)

      // Get budget remaining
      const budgetRemaining = await budgetAlerts.getDailyRemaining(userId)

      let message = `📅 *Итоги дня*\n\n`
      message += `💸 Расходы: ${totalExpenses.toFixed(2)} ${userData.defaultCurrency}\n`
      message += `💰 Доходы: ${totalIncome.toFixed(2)} ${userData.defaultCurrency}\n`
      message += `📊 Баланс: ${(totalIncome - totalExpenses).toFixed(2)} ${userData.defaultCurrency}\n\n`

      if (budgetRemaining.total > 0) {
        message += `🎯 Осталось сегодня: ${budgetRemaining.total.toFixed(2)} ${userData.defaultCurrency}\n`
      }

      message += `\n📋 Транзакций: ${transactions.length}`

      return message
    } catch (error) {
      logger.error("Daily summary error", error, { userId })
      return "❌ Ошибка генерации сводки"
    }
  }

  /**
   * Enable/disable notifications
   */
  async toggleNotifications(userId: string, enabled: boolean): Promise<void> {
    await this.updateConfig(userId, { enabled })
  }

  /**
   * Enable/disable specific notification type
   */
  async toggleNotificationType(
    userId: string,
    type: "budget" | "smart" | "analytics" | "reports",
    enabled: boolean
  ): Promise<void> {
    const config = await this.getConfig(userId)

    switch (type) {
      case "budget":
        config.budgetAlerts.enabled = enabled
        break
      case "smart":
        config.smartAlerts.enabled = enabled
        break
      case "analytics":
        config.analyticsAlerts.enabled = enabled
        break
      case "reports":
        config.scheduledReports.enabled = enabled
        break
    }

    await this.updateConfig(userId, config)
  }
}

/**
 * Default notification service instance
 */
export const notificationService = new NotificationService()
export default notificationService
