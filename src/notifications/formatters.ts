/**
 * Notification formatters for Telegram
 */

import { Notification, NotificationConfig } from "./types"
import { Language, t, getCategoryLabel } from "../i18n"

/**
 * Format notification settings
 */
export function formatNotificationSettings(
  config: NotificationConfig,
  lang: Language
): string {
  let message = `${t(lang, "notifications.settings.title")}\n\n`

  const statusText = config.enabled
    ? t(lang, "notifications.status.enabled")
    : t(lang, "notifications.status.disabled")
  message += `${t(lang, "notifications.settings.statusLine", { status: statusText })}\n\n`

  // Budget alerts
  message += `${t(lang, "notifications.settings.budget.title")}\n`
  message += `${t(lang, "notifications.settings.enabledLine", {
    icon: config.budgetAlerts.enabled ? "✅" : "❌",
  })}\n`
  if (config.budgetAlerts.enabled) {
    message += `${t(lang, "notifications.settings.budget.warningThreshold", {
      threshold: config.budgetAlerts.warningThreshold,
    })}\n`
    message += `${t(lang, "notifications.settings.budget.exceededAlert", {
      icon: config.budgetAlerts.exceededAlert ? "✅" : "❌",
    })}\n`
  }
  message += "\n"

  // Smart alerts
  message += `${t(lang, "notifications.settings.smart.title")}\n`
  message += `${t(lang, "notifications.settings.enabledLine", {
    icon: config.smartAlerts.enabled ? "✅" : "❌",
  })}\n`
  if (config.smartAlerts.enabled) {
    message += `${t(
      lang,
      "notifications.settings.smart.unusualExpenseMultiplier",
      {
        multiplier: config.smartAlerts.unusualExpenseMultiplier,
      }
    )}\n`
    message += `${t(lang, "notifications.settings.smart.frequentSpendingDays", {
      days: config.smartAlerts.frequentSpendingDays,
    })}\n`
  }
  message += "\n"

  // Analytics alerts
  message += `${t(lang, "notifications.settings.analytics.title")}\n`
  message += `${t(lang, "notifications.settings.enabledLine", {
    icon: config.analyticsAlerts.enabled ? "✅" : "❌",
  })}\n`
  if (config.analyticsAlerts.enabled) {
    message += `${t(
      lang,
      "notifications.settings.analytics.monthlyComparison",
      {
        icon: config.analyticsAlerts.monthlyComparison ? "✅" : "❌",
      }
    )}\n`
    message += `${t(lang, "notifications.settings.analytics.goalRiskDays", {
      days: config.analyticsAlerts.goalRiskDays,
    })}\n`
  }
  message += "\n"

  // Scheduled reports
  message += `${t(lang, "notifications.settings.reports.title")}\n`
  message += `${t(lang, "notifications.settings.enabledLine", {
    icon: config.scheduledReports.enabled ? "✅" : "❌",
  })}\n`
  if (config.scheduledReports.enabled) {
    message += `${t(lang, "notifications.settings.reports.weeklyEnabled", {
      icon: config.scheduledReports.weekly ? "✅" : "❌",
    })}\n`
    message += `${t(lang, "notifications.settings.reports.monthlyEnabled", {
      icon: config.scheduledReports.monthly ? "✅" : "❌",
    })}\n`
  }

  return message
}

/**
 * Format notification list
 */
export function formatNotificationList(
  notifications: Notification[],
  lang: Language
): string {
  if (notifications.length === 0) {
    return t(lang, "notifications.list.empty")
  }

  let message = t(lang, "notifications.list.titleWithCount", {
    count: notifications.length,
  })

  // Group by priority
  const urgent = notifications.filter((n) => n.priority === "URGENT")
  const high = notifications.filter((n) => n.priority === "HIGH")
  const medium = notifications.filter((n) => n.priority === "MEDIUM")
  const low = notifications.filter((n) => n.priority === "LOW")

  if (urgent.length > 0) {
    message += `${t(lang, "notifications.list.priority.urgent")}\n`
    urgent.forEach((n) => {
      message += `  • ${n.title}\n`
    })
    message += "\n"
  }

  if (high.length > 0) {
    message += `${t(lang, "notifications.list.priority.high")}\n`
    high.forEach((n) => {
      message += `  • ${n.title}\n`
    })
    message += "\n"
  }

  if (medium.length > 0) {
    message += `${t(lang, "notifications.list.priority.medium")}\n`
    medium.forEach((n) => {
      message += `  • ${n.title}\n`
    })
    message += "\n"
  }

  if (low.length > 0) {
    message += `${t(lang, "notifications.list.priority.low")}\n`
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
  notifications: Notification[],
  lang: Language
): string {
  let message = `${t(lang, "notifications.dailyDigest.title")}\n\n`

  message += summary + "\n\n"

  if (notifications.length > 0) {
    message += `${t(lang, "notifications.dailyDigest.importantTitle")}\n\n`

    const important = notifications.filter(
      (n) => n.priority === "HIGH" || n.priority === "URGENT"
    )

    important.slice(0, 3).forEach((n) => {
      message += `${getPriorityEmoji(n.priority)} ${n.title}\n`
    })

    if (notifications.length > 3) {
      message += `\n${t(lang, "notifications.dailyDigest.moreCount", {
        count: notifications.length - 3,
      })}`
    }
  }

  return message
}

/**
 * Format weekly summary
 */
export function formatWeeklySummary(
  data: {
    expenses: number
    income: number
    balance: number
    transactionCount: number
    topCategory: string
    topCategoryAmount: number
    currency: string
  },
  lang: Language
): string {
  let message = `${t(lang, "notifications.weekly.title")}\n\n`

  message += `${t(lang, "notifications.weekly.expensesLine", {
    amount: data.expenses.toFixed(2),
    currency: data.currency,
  })}\n`
  message += `${t(lang, "notifications.weekly.incomeLine", {
    amount: data.income.toFixed(2),
    currency: data.currency,
  })}\n`
  message += `${t(lang, "notifications.weekly.balanceLine", {
    amount: data.balance.toFixed(2),
    currency: data.currency,
  })}\n\n`

  message += `${t(lang, "notifications.weekly.transactionsLine", {
    count: data.transactionCount,
  })}\n`
  message += `${t(lang, "notifications.weekly.topCategoryLine", {
    category: getCategoryLabel(lang, data.topCategory),
    amount: data.topCategoryAmount.toFixed(2),
    currency: data.currency,
  })}\n\n`

  if (data.balance > 0) {
    message += t(lang, "notifications.weekly.positiveBalance")
  } else {
    message += t(lang, "notifications.weekly.negativeBalance")
  }

  return message
}

/**
 * Format monthly summary
 */
export function formatMonthlySummary(
  data: {
    expenses: number
    income: number
    balance: number
    transactionCount: number
    budgetUtilization: number
    topCategories: Array<{ category: string; amount: number }>
    currency: string
  },
  lang: Language
): string {
  let message = `${t(lang, "notifications.monthly.title")}\n\n`

  message += `${t(lang, "notifications.monthly.expensesLine", {
    amount: data.expenses.toFixed(2),
    currency: data.currency,
  })}\n`
  message += `${t(lang, "notifications.monthly.incomeLine", {
    amount: data.income.toFixed(2),
    currency: data.currency,
  })}\n`
  message += `${t(lang, "notifications.monthly.balanceLine", {
    amount: data.balance.toFixed(2),
    currency: data.currency,
  })}\n\n`

  message += `${t(lang, "notifications.monthly.transactionsLine", {
    count: data.transactionCount,
  })}\n`
  message += `${t(lang, "notifications.monthly.budgetUtilizationLine", {
    percent: data.budgetUtilization.toFixed(0),
  })}\n\n`

  message += `${t(lang, "notifications.monthly.topCategoriesTitle")}\n`
  data.topCategories.slice(0, 3).forEach((cat, index) => {
    message += `${t(lang, "notifications.monthly.topCategoryItem", {
      index: index + 1,
      category: getCategoryLabel(lang, cat.category),
      amount: cat.amount.toFixed(2),
      currency: data.currency,
    })}\n`
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
export function formatSettingsMenu(lang: Language): string {
  let message = `${t(lang, "notifications.menu.title")}\n\n`

  message += `${t(lang, "notifications.menu.prompt")}\n\n`

  message += `${t(lang, "notifications.menu.budgetItem")}\n`
  message += `${t(lang, "notifications.menu.smartItem")}\n`
  message += `${t(lang, "notifications.menu.analyticsItem")}\n`
  message += `${t(lang, "notifications.menu.reportsItem")}\n`

  return message
}
