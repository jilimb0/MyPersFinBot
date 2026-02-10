/**
 * Currency formatters for Telegram
 */

import { getLocale, type Language, t } from "../i18n"
import type { Currency } from "../types"
import {
  type ConversionResult,
  CURRENCY_INFO,
  type CurrencyStats,
  type ExchangeRate,
  type RateHistory,
} from "./types"

/**
 * Format conversion result
 */
export function formatConversion(
  conversion: ConversionResult,
  lang: Language = "ru"
): string {
  const fromInfo = CURRENCY_INFO[conversion.from]
  const toInfo = CURRENCY_INFO[conversion.to]

  let message = `${t(lang, "currency.formatters.conversionTitle")}\n\n`

  message += `${fromInfo.flag} *${conversion.amount.toFixed(2)} ${conversion.from}*\n`
  message += `${t(lang, "currency.formatters.arrowDownLine")}\n`
  message += `${toInfo.flag} *${conversion.result.toFixed(2)} ${conversion.to}*\n\n`

  message += `${t(lang, "currency.formatters.conversionRateLine", {
    from: conversion.from,
    rate: conversion.rate.toFixed(4),
    to: conversion.to,
  })}\n`
  message += `${t(lang, "currency.formatters.conversionTimestampLine", {
    time: conversion.timestamp.toLocaleString(getLocale(lang)),
  })}\n`

  return message
}

/**
 * Format multiple conversions
 */
export function formatMultipleConversions(
  conversions: ConversionResult[],
  originalAmount: number,
  originalCurrency: Currency,
  lang: Language = "ru"
): string {
  const fromInfo = CURRENCY_INFO[originalCurrency]

  let message = `${t(lang, "currency.formatters.conversionMultipleTitle", {
    flag: fromInfo.flag,
    amount: originalAmount,
    currency: originalCurrency,
  })}\n\n`

  conversions.forEach((conv) => {
    const toInfo = CURRENCY_INFO[conv.to]
    message += `${toInfo.flag} ${conv.to}: *${conv.result.toFixed(2)}* ${toInfo.symbol}\n`
  })

  return message
}

/**
 * Format exchange rate
 */
export function formatRate(rate: ExchangeRate, lang: Language = "ru"): string {
  const fromInfo = CURRENCY_INFO[rate.from]
  const toInfo = CURRENCY_INFO[rate.to]

  let message = `${t(lang, "currency.formatters.rateTitle", {
    pair: `${rate.from}/${rate.to}`,
  })}\n\n`

  message += `${t(lang, "currency.formatters.rateLine", {
    fromFlag: fromInfo.flag,
    from: rate.from,
    rate: rate.rate.toFixed(4),
    to: rate.to,
    toFlag: toInfo.flag,
  })}\n`
  message += `${t(lang, "currency.formatters.rateLineReverse", {
    fromFlag: toInfo.flag,
    from: rate.to,
    rate: (1 / rate.rate).toFixed(4),
    to: rate.from,
    toFlag: fromInfo.flag,
  })}\n\n`

  message += `${t(lang, "currency.formatters.conversionTimestampLine", {
    time: rate.timestamp.toLocaleString(getLocale(lang)),
  })}\n`

  return message
}

/**
 * Format all rates for a currency
 */
export function formatAllRates(
  baseCurrency: Currency,
  rates: ExchangeRate[],
  lang: Language = "ru"
): string {
  const baseInfo = CURRENCY_INFO[baseCurrency]

  let message = `${t(lang, "currency.formatters.ratesTitle", {
    flag: baseInfo.flag,
    currency: baseCurrency,
  })}\n\n`

  rates.forEach((rate) => {
    const toInfo = CURRENCY_INFO[rate.to]
    message += `${toInfo.flag} ${rate.to}: *${rate.rate.toFixed(4)}*\n`
  })

  const timestamp = rates[0]?.timestamp || new Date()
  message += `\n${t(lang, "currency.formatters.conversionTimestampLine", {
    time: timestamp.toLocaleString(getLocale(lang)),
  })}`

  return message
}

/**
 * Format rate history
 */
export function formatRateHistory(
  history: RateHistory,
  lang: Language = "ru"
): string {
  const currencyInfo = CURRENCY_INFO[history.currency]
  const baseInfo = CURRENCY_INFO[history.baseCurrency]

  let message = `${t(lang, "currency.formatters.rateHistoryTitle", {
    currencyFlag: currencyInfo.flag,
    currency: history.currency,
    baseFlag: baseInfo.flag,
    baseCurrency: history.baseCurrency,
  })}\n\n`

  // Show changes
  if (history.change24h !== undefined) {
    const emoji = history.change24h >= 0 ? "🟢" : "🔴"
    const sign = history.change24h >= 0 ? "+" : ""
    message += `${t(lang, "currency.formatters.rateHistoryChange24hLine", {
      emoji,
      sign,
      value: history.change24h.toFixed(2),
    })}\n`
  }

  if (history.change7d !== undefined) {
    const emoji = history.change7d >= 0 ? "🟢" : "🔴"
    const sign = history.change7d >= 0 ? "+" : ""
    message += `${t(lang, "currency.formatters.rateHistoryChange7dLine", {
      emoji,
      sign,
      value: history.change7d.toFixed(2),
    })}\n`
  }

  if (history.change30d !== undefined) {
    const emoji = history.change30d >= 0 ? "🟢" : "🔴"
    const sign = history.change30d >= 0 ? "+" : ""
    message += `${t(lang, "currency.formatters.rateHistoryChange30dLine", {
      emoji,
      sign,
      value: history.change30d.toFixed(2),
    })}\n`
  }

  message += "\n"

  // Show recent rates (last 5)
  const recentRates = history.rates.slice(-5)
  recentRates.forEach((item) => {
    const date = item.date.toLocaleDateString(getLocale(lang))
    message += `${date}: ${item.rate.toFixed(4)}\n`
  })

  return message
}

/**
 * Format currency stats
 */
export function formatCurrencyStats(
  stats: CurrencyStats[],
  lang: Language = "ru"
): string {
  let message = `${t(lang, "currency.formatters.currencyStatsTitle")}\n\n`

  if (stats.length === 0) {
    return message + t(lang, "currency.formatters.currencyStatsEmpty")
  }

  stats.forEach((stat) => {
    const info = CURRENCY_INFO[stat.currency]
    message += `${info.flag} *${stat.currency}*\n`
    message += `  ${t(
      lang,
      "currency.formatters.currencyStatsTransactionsLine",
      {
        count: stat.totalTransactions,
      }
    )}\n`
    message += `  ${t(lang, "currency.formatters.currencyStatsAmountLine", {
      amount: stat.totalAmount.toFixed(2),
      symbol: info.symbol,
    })}\n`

    if (stat.averageRate) {
      message += `  ${t(
        lang,
        "currency.formatters.currencyStatsAverageRateLine",
        {
          rate: stat.averageRate.toFixed(4),
        }
      )}\n`
    }

    if (stat.lastUsed) {
      message += `  ${t(lang, "currency.formatters.currencyStatsLastUsedLine", {
        date: stat.lastUsed.toLocaleDateString(getLocale(lang)),
      })}\n`
    }

    message += "\n"
  })

  return message
}

/**
 * Format currency list
 */
export function formatCurrencyList(lang: Language = "ru"): string {
  let message = `${t(lang, "currency.formatters.currencyListTitle")}\n\n`

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
  result: number,
  lang: Language = "ru"
): string {
  const fromInfo = CURRENCY_INFO[from]
  const toInfo = CURRENCY_INFO[to]

  return t(lang, "currency.formatters.quickConversionLine", {
    fromFlag: fromInfo.flag,
    fromAmount: amount,
    fromCurrency: from,
    toFlag: toInfo.flag,
    toAmount: result.toFixed(2),
    toCurrency: to,
  })
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
