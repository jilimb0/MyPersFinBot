/**
 * Formatting utilities
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GEL: "₾",
  RUB: "₽",
  TRY: "₺",
  UAH: "₴",
  PLN: "zł",
}

/**
 * Format money with currency symbol
 */
export function formatMoney(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency
  const isNegative = amount < 0
  const absoluteAmount = Math.abs(amount)

  // Format with thousands separator
  const formatted = absoluteAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return isNegative ? `-${symbol}${formatted}` : `${symbol}${formatted}`
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) {
    return 0
  }

  return roundToDecimal((value / total) * 100, 2)
}

/**
 * Round to decimal places
 */
export function roundToDecimal(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals)
  return Math.round(value * multiplier) / multiplier
}

/**
 * Format number with compact notation (1K, 1M, etc.)
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${roundToDecimal(value / 1_000_000, 1)}M`
  }
  if (value >= 1_000) {
    return `${roundToDecimal(value / 1_000, 1)}K`
  }
  return value.toString()
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }
  return str.substring(0, maxLength - 3) + "..."
}
