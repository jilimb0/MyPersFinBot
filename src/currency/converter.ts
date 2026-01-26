/**
 * Advanced currency converter
 */

import { Currency } from "../types"
import { convertSync } from "../fx"
import logger from "../logger"
import { ConversionResult, ExchangeRate, CURRENCY_INFO } from "./types"

export class CurrencyConverter {
  /**
   * Convert amount between currencies
   */
  convert(amount: number, from: Currency, to: Currency): ConversionResult {
    try {
      // Same currency - no conversion needed
      if (from === to) {
        return {
          amount,
          from,
          to,
          result: amount,
          rate: 1,
          timestamp: new Date(),
          formatted: this.formatAmount(amount, to),
        }
      }

      // Use existing FX service
      const result = convertSync(amount, from, to)
      const rate = result / amount

      return {
        amount,
        from,
        to,
        result,
        rate,
        timestamp: new Date(),
        formatted: this.formatAmount(result, to),
      }
    } catch (error) {
      logger.error("Currency conversion error", error, { amount, from, to })
      throw new Error(`Failed to convert ${from} to ${to}`)
    }
  }

  /**
   * Get exchange rate between two currencies
   */
  getRate(from: Currency, to: Currency): ExchangeRate {
    try {
      const rate = convertSync(1, from, to)

      return {
        from,
        to,
        rate,
        timestamp: new Date(),
        source: "exchangerate-api",
      }
    } catch (error) {
      logger.error("Get rate error", error, { from, to })
      throw new Error(`Failed to get rate for ${from}/${to}`)
    }
  }

  /**
   * Convert to multiple currencies
   */
  convertToMultiple(
    amount: number,
    from: Currency,
    targets: Currency[]
  ): ConversionResult[] {
    return targets.map((to) => this.convert(amount, from, to))
  }

  /**
   * Get all rates for a base currency
   */
  getAllRates(baseCurrency: Currency): ExchangeRate[] {
    const currencies = Object.keys(CURRENCY_INFO) as Currency[]

    return currencies
      .filter((currency) => currency !== baseCurrency)
      .map((currency) => this.getRate(baseCurrency, currency))
  }

  /**
   * Format amount with currency symbol
   */
  formatAmount(amount: number, currency: Currency): string {
    const info = CURRENCY_INFO[currency]
    const formatted = amount.toFixed(2)

    // For some currencies, symbol goes before amount
    if (["USD", "GBP", "EUR"].includes(currency)) {
      return `${info.symbol}${formatted}`
    }

    return `${formatted} ${info.symbol}`
  }

  /**
   * Format exchange rate
   */
  formatRate(rate: ExchangeRate): string {
    const fromInfo = CURRENCY_INFO[rate.from]
    const toInfo = CURRENCY_INFO[rate.to]

    return `${fromInfo.flag} 1 ${rate.from} = ${rate.rate.toFixed(4)} ${rate.to} ${toInfo.flag}`
  }

  /**
   * Calculate reverse rate
   */
  reverseRate(rate: ExchangeRate): ExchangeRate {
    return {
      from: rate.to,
      to: rate.from,
      rate: 1 / rate.rate,
      timestamp: rate.timestamp,
      source: rate.source,
    }
  }

  /**
   * Compare rates (for best rate finding)
   */
  compareRates(rate1: ExchangeRate, rate2: ExchangeRate): number {
    if (rate1.from !== rate2.from || rate1.to !== rate2.to) {
      throw new Error("Cannot compare rates for different currency pairs")
    }

    return rate1.rate - rate2.rate
  }

  /**
   * Calculate percentage difference between two rates
   */
  calculateRateDifference(oldRate: number, newRate: number): number {
    return ((newRate - oldRate) / oldRate) * 100
  }

  /**
   * Round to currency precision
   */
  roundToPrecision(amount: number, _currency: Currency): number {
    // Most currencies use 2 decimal places
    // Some (like JPY) use 0, but we'll keep it simple
    return Math.round(amount * 100) / 100
  }
}

/**
 * Default converter instance
 */
export const currencyConverter = new CurrencyConverter()
export default currencyConverter
