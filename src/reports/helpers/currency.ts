/**
 * Currency conversion utilities
 */

import { convertBatchSync } from "../../fx"
import type { Currency } from "../../types"

interface AmountWithCurrency {
  amount: number
  currency: Currency
}

/**
 * Converts multiple amounts to a default currency
 * @param items - Array of amounts with their currencies
 * @param defaultCurrency - Target currency
 * @returns Array of converted amounts
 */
export function convertToDefaultCurrency(
  items: AmountWithCurrency[],
  defaultCurrency: Currency
): number[] {
  if (items.length === 0) return []

  const batch = items.map((item) => ({
    amount: item.amount,
    from: item.currency,
    to: defaultCurrency,
  }))

  return convertBatchSync(batch)
}

/**
 * Sums an array of converted amounts
 * @param converted - Array of numbers to sum
 * @returns Total sum
 */
export function sumConverted(converted: number[]): number {
  return converted.reduce((sum, val) => sum + val, 0)
}

/**
 * Converts and sums amounts in one operation
 * @param items - Array of amounts with their currencies
 * @param defaultCurrency - Target currency
 * @returns Total sum in default currency
 */
export function convertAndSum(
  items: AmountWithCurrency[],
  defaultCurrency: Currency
): number {
  const converted = convertToDefaultCurrency(items, defaultCurrency)
  return sumConverted(converted)
}
