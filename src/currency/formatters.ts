/**
 * Currency formatters for Telegram
 */

import { Currency } from "../types"
import {
  ConversionResult,
  ExchangeRate,
  CURRENCY_INFO,
  CurrencyStats,
  RateHistory,
} from "./types"

/**
 * Format conversion result
 */
export function formatConversion(conversion: ConversionResult): string {
  const fromInfo = CURRENCY_INFO[conversion.from]
  const toInfo = CURRENCY_INFO[conversion.to]

  let message = `💱 *Конвертация валют*\n\n`

  message += `${fromInfo.flag} *${conversion.amount.toFixed(2)} ${conversion.from}*\n`
  message += `⬇️\n`
  message += `${toInfo.flag} *${conversion.result.toFixed(2)} ${conversion.to}*\n\n`

  message += `📊 Курс: 1 ${conversion.from} = ${conversion.rate.toFixed(4)} ${conversion.to}\n`
  message += `⏰ ${conversion.timestamp.toLocaleString("ru-RU")}\n`

  return message
}

/**
 * Format multiple conversions
 */
export function formatMultipleConversions(
  conversions: ConversionResult[],
  originalAmount: number,
  originalCurrency: Currency
): string {
  const fromInfo = CURRENCY_INFO[originalCurrency]

  let message = `💱 *Конвертация ${fromInfo.flag} ${originalAmount} ${originalCurrency}*\n\n`

  conversions.forEach((conv) => {
    const toInfo = CURRENCY_INFO[conv.to]
    message += `${toInfo.flag} ${conv.to}: *${conv.result.toFixed(2)}* ${toInfo.symbol}\n`
  })

  return message
}

/**
 * Format exchange rate
 */
export function formatRate(rate: ExchangeRate): string {
  const fromInfo = CURRENCY_INFO[rate.from]
  const toInfo = CURRENCY_INFO[rate.to]

  let message = `📊 *Курс ${rate.from}/${rate.to}*\n\n`

  message += `${fromInfo.flag} 1 ${rate.from} = ${rate.rate.toFixed(4)} ${rate.to} ${toInfo.flag}\n`
  message += `${toInfo.flag} 1 ${rate.to} = ${(1 / rate.rate).toFixed(4)} ${rate.from} ${fromInfo.flag}\n\n`

  message += `⏰ ${rate.timestamp.toLocaleString("ru-RU")}\n`

  return message
}

/**
 * Format all rates for a currency
 */
export function formatAllRates(
  baseCurrency: Currency,
  rates: ExchangeRate[]
): string {
  const baseInfo = CURRENCY_INFO[baseCurrency]

  let message = `📊 *Курсы ${baseInfo.flag} ${baseCurrency}*\n\n`

  rates.forEach((rate) => {
    const toInfo = CURRENCY_INFO[rate.to]
    message += `${toInfo.flag} ${rate.to}: *${rate.rate.toFixed(4)}*\n`
  })

  const timestamp = rates[0]?.timestamp || new Date()
  message += `\n⏰ ${timestamp.toLocaleString("ru-RU")}`

  return message
}

/**
 * Format rate history
 */
export function formatRateHistory(history: RateHistory): string {
  const currencyInfo = CURRENCY_INFO[history.currency]
  const baseInfo = CURRENCY_INFO[history.baseCurrency]

  let message = `📈 *История курса ${currencyInfo.flag} ${history.currency}/${baseInfo.flag} ${history.baseCurrency}*\n\n`

  // Show changes
  if (history.change24h !== undefined) {
    const emoji = history.change24h >= 0 ? "🟢" : "🔴"
    const sign = history.change24h >= 0 ? "+" : ""
    message += `${emoji} 24ч: ${sign}${history.change24h.toFixed(2)}%\n`
  }

  if (history.change7d !== undefined) {
    const emoji = history.change7d >= 0 ? "🟢" : "🔴"
    const sign = history.change7d >= 0 ? "+" : ""
    message += `${emoji} 7д: ${sign}${history.change7d.toFixed(2)}%\n`
  }

  if (history.change30d !== undefined) {
    const emoji = history.change30d >= 0 ? "🟢" : "🔴"
    const sign = history.change30d >= 0 ? "+" : ""
    message += `${emoji} 30д: ${sign}${history.change30d.toFixed(2)}%\n`
  }

  message += "\n"

  // Show recent rates (last 5)
  const recentRates = history.rates.slice(-5)
  recentRates.forEach((item) => {
    const date = item.date.toLocaleDateString("ru-RU")
    message += `${date}: ${item.rate.toFixed(4)}\n`
  })

  return message
}

/**
 * Format currency stats
 */
export function formatCurrencyStats(stats: CurrencyStats[]): string {
  let message = `📊 *Статистика по валютам*\n\n`

  if (stats.length === 0) {
    return message + "Нет данных"
  }

  stats.forEach((stat) => {
    const info = CURRENCY_INFO[stat.currency]
    message += `${info.flag} *${stat.currency}*\n`
    message += `  Транзакций: ${stat.totalTransactions}\n`
    message += `  Сумма: ${stat.totalAmount.toFixed(2)} ${info.symbol}\n`

    if (stat.averageRate) {
      message += `  Ср. курс: ${stat.averageRate.toFixed(4)}\n`
    }

    if (stat.lastUsed) {
      message += `  Посл. исп.: ${stat.lastUsed.toLocaleDateString("ru-RU")}\n`
    }

    message += "\n"
  })

  return message
}

/**
 * Format currency list
 */
export function formatCurrencyList(): string {
  let message = `🌍 *Доступные валюты*\n\n`

  Object.values(CURRENCY_INFO).forEach((info) => {
    message += `${info.flag} *${info.code}* - ${info.name} (${info.symbol})\n`
  })

  return message
}

/**
 * Format quick conversion inline
 */
export function formatQuickConversion(
  amount: number,
  from: Currency,
  to: Currency,
  result: number
): string {
  const fromInfo = CURRENCY_INFO[from]
  const toInfo = CURRENCY_INFO[to]

  return `${fromInfo.flag} ${amount} ${from} = ${toInfo.flag} ${result.toFixed(2)} ${to}`
}

/**
 * Get trend emoji
 */
export function getTrendEmoji(change: number): string {
  if (change > 5) return "🚀" // Rocket up
  if (change > 0) return "🟢" // Green circle
  if (change > -5) return "🔴" // Red circle
  return "📉" // Chart decreasing
}

/**
 * Format rate change
 */
export function formatRateChange(oldRate: number, newRate: number): string {
  const change = ((newRate - oldRate) / oldRate) * 100
  const emoji = getTrendEmoji(change)
  const sign = change >= 0 ? "+" : ""

  return `${emoji} ${sign}${change.toFixed(2)}%`
}
