/**
 * Currency exchange types
 */

import { Currency } from "../types"

export interface ExchangeRate {
  from: Currency
  to: Currency
  rate: number
  timestamp: Date
  source?: string
}

export interface ConversionResult {
  amount: number
  from: Currency
  to: Currency
  result: number
  rate: number
  timestamp: Date
  formatted: string
}

export interface CurrencyInfo {
  code: Currency
  name: string
  symbol: string
  flag: string
}

export interface RateHistory {
  currency: Currency
  baseCurrency: Currency
  rates: Array<{
    date: Date
    rate: number
  }>
  change24h?: number
  change7d?: number
  change30d?: number
}

export interface CurrencyStats {
  currency: Currency
  totalTransactions: number
  totalAmount: number
  averageRate?: number
  lastUsed?: Date
}

export const CURRENCY_INFO: Record<Currency, CurrencyInfo> = {
  USD: {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    flag: "🇺🇸",
  },
  EUR: {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    flag: "🇪🇺",
  },
  UAH: {
    code: "UAH",
    name: "Ukrainian Hryvnia",
    symbol: "₴",
    flag: "🇺🇦",
  },
  RUB: {
    code: "RUB",
    name: "Russian Ruble",
    symbol: "₽",
    flag: "🇷🇺",
  },
  PLN: {
    code: "PLN",
    name: "Polish Złoty",
    symbol: "zł",
    flag: "🇵🇱",
  },
  GEL: {
    code: "GEL",
    name: "Georgian Lari",
    symbol: "₾",
    flag: "🇬🇪",
  },
}
