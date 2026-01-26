/**
 * Notification formatters for Telegram
 */

import { Notification, NotificationConfig } from "./types"

/**
 * Format notification settings
 */
export function formatNotificationSettings(config: NotificationConfig): string {
  let message = "🔔 *Настройки уведомлений*\n\n"

  message += `Статус: ${config.enabled ? "✅ Включены" : "❌ Выключены"}\n\n`

  // Budget alerts
  message += "💰 *Бюджетные уведомления*\n"
  message += `${config.budgetAlerts.enabled ? "✅" : "❌"} Включено\n`
  if (config.budgetAlerts.enabled) {
    message += `  • Предупреждение: при ${config.budgetAlerts.warningThreshold}%\n`
    message += `  • Превышение: ${config.budgetAlerts.exceededAlert ? "✅" : "❌"}\n`
  }
  message += "\n"

  // Smart alerts
  message += "🧠 *Умные уведомления*\n"
  message += `${config.smartAlerts.enabled ? "✅" : "❌"} Включено\n`
  if (config.smartAlerts.enabled) {
    message += `  • Необычные траты: x${config.smartAlerts.unusualExpenseMultiplier} от среднего\n`
    message += `  • Частые траты: ${config.smartAlerts.frequentSpendingDays} дней подряд\n`
  }
  message += "\n"

  // Analytics alerts
  message += "📊 *Аналитические уведомления*\n"
  message += `${config.analyticsAlerts.enabled ? "✅" : "❌"} Включено\n`
  if (config.analyticsAlerts.enabled) {
    message += `  • Сравнение месяцев: ${config.analyticsAlerts.monthlyComparison ? "✅" : "❌"}\n`
    message += `  • Риск для целей: за ${config.analyticsAlerts.goalRiskDays} дней\n`
  }
  message += "\n"

  // Scheduled reports
  message += "📅 *Плановые отчёты*\n"
  message += `${config.scheduledReports.enabled ? "✅" : "❌"} Включено\n`
  if (config.scheduledReports.enabled) {
    message += `  • Еженедельный: ${config.scheduledReports.weekly ? "✅" : "❌"}\n`
    message += `  • Ежемесячный: ${config.scheduledReports.monthly ? "✅" : "❌"}\n`
  }

  return message
}

/**
 * Format notification list
 */
export function formatNotificationList(notifications: Notification[]): string {
  if (notifications.length === 0) {
    return "🔔 *Уведомления*\n\nНет новых уведомлений"
  }

  let message = `🔔 *Уведомления* (${notifications.length})\n\n`

  // Group by priority
  const urgent = notifications.filter((n) => n.priority === "URGENT")
  const high = notifications.filter((n) => n.priority === "HIGH")
  const medium = notifications.filter((n) => n.priority === "MEDIUM")
  const low = notifications.filter((n) => n.priority === "LOW")

  if (urgent.length > 0) {
    message += "🔴 *Срочно*\n"
    urgent.forEach((n) => {
      message += `  • ${n.title}\n`
    })
    message += "\n"
  }

  if (high.length > 0) {
    message += "🟠 *Важно*\n"
    high.forEach((n) => {
      message += `  • ${n.title}\n`
    })
    message += "\n"
  }

  if (medium.length > 0) {
    message += "🟡 *Среднее*\n"
    medium.forEach((n) => {
      message += `  • ${n.title}\n`
    })
    message += "\n"
  }

  if (low.length > 0) {
    message += "⚪ *Низкое*\n"
    low.forEach((n) => {
      message += `  • ${n.title}\n`
    })
  }

  return message
}

/**
 * Format daily digest
 */
export function formatDailyDigest(
  summary: string,
  notifications: Notification[]
): string {
  let message = "🌅 *Ежедневная сводка*\n\n"

  message += summary + "\n\n"

  if (notifications.length > 0) {
    message += `⚠️ *Важные уведомления:*\n\n`

    const important = notifications.filter(
      (n) => n.priority === "HIGH" || n.priority === "URGENT"
    )

    important.slice(0, 3).forEach((n) => {
      message += `${getPriorityEmoji(n.priority)} ${n.title}\n`
    })

    if (notifications.length > 3) {
      message += `\nИ ещё ${notifications.length - 3} уведомлений...`
    }
  }

  return message
}

/**
 * Format weekly summary
 */
export function formatWeeklySummary(data: {
  expenses: number
  income: number
  balance: number
  transactionCount: number
  topCategory: string
  topCategoryAmount: number
  currency: string
}): string {
  let message = "📅 *Еженедельная сводка*\n\n"

  message += `💸 Расходы: ${data.expenses.toFixed(2)} ${data.currency}\n`
  message += `💰 Доходы: ${data.income.toFixed(2)} ${data.currency}\n`
  message += `📊 Баланс: ${data.balance.toFixed(2)} ${data.currency}\n\n`

  message += `📋 Транзакций: ${data.transactionCount}\n`
  message += `🎯 Топ категория: ${data.topCategory} (${data.topCategoryAmount.toFixed(2)} ${data.currency})\n\n`

  if (data.balance > 0) {
    message += "✅ Положительный баланс за неделю!"
  } else {
    message += "⚠️ Расходы превысили доходы"
  }

  return message
}

/**
 * Format monthly summary
 */
export function formatMonthlySummary(data: {
  expenses: number
  income: number
  balance: number
  transactionCount: number
  budgetUtilization: number
  topCategories: Array<{ category: string; amount: number }>
  currency: string
}): string {
  let message = "📆 *Ежемесячная сводка*\n\n"

  message += `💸 Расходы: ${data.expenses.toFixed(2)} ${data.currency}\n`
  message += `💰 Доходы: ${data.income.toFixed(2)} ${data.currency}\n`
  message += `📊 Баланс: ${data.balance.toFixed(2)} ${data.currency}\n\n`

  message += `📋 Транзакций: ${data.transactionCount}\n`
  message += `🎯 Использование бюджета: ${data.budgetUtilization.toFixed(0)}%\n\n`

  message += "📈 *Топ-3 категории:*\n"
  data.topCategories.slice(0, 3).forEach((cat, index) => {
    message += `${index + 1}. ${cat.category}: ${cat.amount.toFixed(2)} ${data.currency}\n`
  })

  return message
}

/**
 * Get priority emoji
 */
function getPriorityEmoji(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "🔴"
    case "HIGH":
      return "🟠"
    case "MEDIUM":
      return "🟡"
    case "LOW":
      return "⚪"
    default:
      return "🔵"
  }
}

/**
 * Format settings menu
 */
export function formatSettingsMenu(): string {
  let message = "⚙️ *Настройки уведомлений*\n\n"

  message += "Выберите тип уведомлений:\n\n"

  message += "💰 Бюджетные - превышение лимитов\n"
  message += "🧠 Умные - необычные траты\n"
  message += "📊 Аналитические - тренды и паттерны\n"
  message += "📅 Плановые - еженедельные/месячные отчёты\n"

  return message
}
