/**
 * Formatting utilities
 */

/**
 * Currency symbols map for custom formatting
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GEL: "₾",
  RUB: "₽",
  TRY: "₺",
  UAH: "₴",
  PLN: "zł",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
}

/**
 * Format amount to string with proper decimal places
 */
export function formatAmount(amount: number | undefined | null): string {
  if (amount == null || isNaN(amount)) return "0.00"
  return Number(amount) % 1 === 0
    ? Number(amount).toString()
    : Number(amount).toFixed(2)
}

/**
 * Format money with currency symbol
 * @param amount - Amount to format
 * @param currency - Currency code (optional)
 * @param withoutSpace - Remove space between amount and currency (optional)
 */
export function formatMoney(
  amount: number,
  currency?: string,
  withoutSpace?: boolean
): string {
  if (!currency) {
    return formatAmount(amount)
  }

  // Format the number part
  const formattedNumber = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))

  // Get currency symbol (custom or from currency code)
  const symbol = CURRENCY_SYMBOLS[currency] || currency

  // Handle negative amounts
  const sign = amount < 0 ? "-" : ""

  // Format based on currency position
  // Most currencies have symbol before amount, some after
  const symbolAfter = ["PLN", "TRY"].includes(currency)

  if (symbolAfter) {
    return `${sign}${formattedNumber}${withoutSpace ? "" : " "}${symbol}`
  }

  return `${sign}${symbol}${formattedNumber}`
}

/**
 * Handle insufficient funds message
 */
export function handleInsufficientFunds(
  accountName: string,
  accountBalance: number,
  accountCurrency: string,
  requiredAmount: number,
  requiredCurrency?: string
): string {
  const shortage = requiredAmount - accountBalance
  const message =
    `❌ Insufficient funds!\n\n` +
    `Account: ${accountName}\n` +
    `Available: ${formatMoney(accountBalance, accountCurrency)}\n` +
    `Required: ${formatMoney(requiredAmount, requiredCurrency || accountCurrency)}\n\n` +
    `Shortage: ${formatMoney(shortage, requiredCurrency || accountCurrency)}` +
    "\n\n💡 You can change the amount or add funds to your account."

  return message
}

/**
 * Format date to YYYY-MM-DD (ISO format)
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

/**
 * Format date to DD.MM (short format)
 */
export const formatDateShort = (date: Date): string => {
  return `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1).toString().padStart(2, "0")}`
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
