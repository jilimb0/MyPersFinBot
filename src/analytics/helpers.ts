/**
 * Analytics helper functions
 */

import { getLocale, type Language } from "../i18n"
import type { AnalyticsPeriod } from "./types"

/**
 * Get date range for analytics period
 */
export function getPeriodRange(period: AnalyticsPeriod): {
  start: Date
  end: Date
} {
  const now = new Date()
  const end = new Date(now)
  let start = new Date(now)

  switch (period) {
    case "today":
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break

    case "week": {
      // Start from Monday
      const dayOfWeek = start.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      start.setDate(start.getDate() - daysToMonday)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    }

    case "month":
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break

    case "year":
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break

    case "all":
      start = new Date(2020, 0, 1) // Arbitrary start date
      end.setHours(23, 59, 59, 999)
      break
  }

  return { start, end }
}

/**
 * Get previous period range
 */
export function getPreviousPeriodRange(period: AnalyticsPeriod): {
  start: Date
  end: Date
} {
  const current = getPeriodRange(period)
  const duration = current.end.getTime() - current.start.getTime()

  const end = new Date(current.start.getTime() - 1)
  const start = new Date(end.getTime() - duration)

  return { start, end }
}

/**
 * Calculate percentage change
 */
export function calculatePercentChange(
  current: number,
  previous: number
): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

/**
 * Format currency amount
 */
export function formatAmount(amount: number, currency: string = "RUB"): string {
  const symbols: Record<string, string> = {
    RUB: "₽",
    USD: "$",
    EUR: "€",
    GBP: "£",
  }

  const symbol = symbols[currency] || currency
  const formatted = Math.abs(amount).toFixed(2)

  return `${formatted} ${symbol}`
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

/**
 * Get trend indicator
 */
export function getTrend(
  current: number,
  previous: number
): "up" | "down" | "stable" {
  const change = calculatePercentChange(current, previous)

  if (Math.abs(change) < 5) return "stable"
  return change > 0 ? "up" : "down"
}

/**
 * Group transactions by day
 */
export function groupByDay<T extends { date: Date | string }>(
  items: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>()

  items.forEach((item) => {
    const date = new Date(item.date)
    const key = date.toISOString().split("T")[0]
    if (!key) return

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)?.push(item)
  })

  return groups
}

/**
 * Group transactions by month
 */
export function groupByMonth<T extends { date: Date | string }>(
  items: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>()

  items.forEach((item) => {
    const date = new Date(item.date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)?.push(item)
  })

  return groups
}

/**
 * Get day name in Russian
 */
export function getDayName(date: Date, lang: Language = "ru"): string {
  const locale = getLocale(lang)
  return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date)
}

/**
 * Get month name in Russian
 */
export function getMonthName(date: Date, lang: Language = "ru"): string {
  const locale = getLocale(lang)
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(date)
}

/**
 * Format date range
 */
export function formatDateRange(
  start: Date,
  end: Date,
  lang: Language = "ru"
): string {
  const locale = getLocale(lang)
  const sameDay = start.toDateString() === end.toDateString()

  if (sameDay) {
    return start.toLocaleDateString(locale)
  }

  return `${start.toLocaleDateString(locale)} - ${end.toLocaleDateString(locale)}`
}

/**
 * Calculate days remaining in period
 */
export function getDaysRemaining(endDate: Date): number {
  const now = new Date()
  const diff = endDate.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
