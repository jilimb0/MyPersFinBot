import { type Language, t } from "./i18n"
import {
  getExpenseCategoryByLabel,
  getIncomeCategoryByLabel,
} from "./i18n/categories"
import type { Currency, TransactionCategory } from "./types"

const VALID_CURRENCIES = ["USD", "EUR", "GEL", "RUB", "UAH", "PLN"]

export function parseAmountWithCurrency(
  text: string,
  defaultCurrency: Currency = "USD"
): { amount: number; currency: Currency } | null {
  const normalizedText = text.replace(",", ".").trim().toUpperCase()

  const pureNumberRegex = /^(-?[0-9]+(?:\.[0-9]*)?)$/
  if (pureNumberRegex.test(normalizedText)) {
    const amount = parseFloat(normalizedText)
    if (!Number.isNaN(amount)) {
      return { amount, currency: defaultCurrency }
    }
  }

  const currencyRegex = /^(-?[0-9]+(?:\.[0-9]*)?)\s*([A-Z]{3}|\$)$/
  const currencyMatch = normalizedText.match(currencyRegex)

  if (currencyMatch?.[1] && currencyMatch[2]) {
    const amount = parseFloat(currencyMatch[1])
    let currency = currencyMatch[2]

    if (currency === "$") currency = "USD"

    if (!Number.isNaN(amount) && VALID_CURRENCIES.includes(currency)) {
      return { amount, currency: currency as Currency }
    }
  }

  return null
}

export function parseBalanceInput(
  text: string
): { accountId: string; amount: number; currency: Currency } | null {
  const normalizedText = text.replace(",", ".")

  const regex = /^(.+?)\s+([0-9]+(?:\.[0-9]{1,2})?)\s+([A-Za-z]{3})$/
  const match = normalizedText.trim().match(regex)

  if (!match) {
    return null
  }

  const accountId = match[1]?.trim()
  const amount = parseFloat(match[2]!)
  const currency = match[3]?.toUpperCase()

  if (!accountId || !currency || Number.isNaN(amount) || amount < 0) {
    return null
  }

  if (!VALID_CURRENCIES.includes(currency)) {
    return null
  }

  return { accountId, amount, currency: currency as Currency }
}

export function parseDebtInput(text: string): {
  counterparty: string
  amount: number
  currency: Currency
  type: "OWES_ME" | "I_OWE"
} | null {
  const normalizedText = text.replace(",", ".")

  const regex =
    /^(.+?)\s+([0-9]+(?:\.[0-9]{1,2})?)\s+([A-Za-z]{3})\s+(owe|me)$/i
  const match = normalizedText.trim().match(regex)

  if (!match) {
    return null
  }

  const counterparty = match[1]?.trim()
  const amount = parseFloat(match[2]!)
  const currency = match[3]?.toUpperCase()
  const typeStr = match[4]?.toLowerCase()

  if (!counterparty || !currency || Number.isNaN(amount) || amount <= 0) {
    return null
  }

  if (!VALID_CURRENCIES.includes(currency)) {
    return null
  }

  const type = typeStr === "me" ? "OWES_ME" : "I_OWE"

  return { counterparty, amount, currency: currency as Currency, type }
}

export function parseGoalInput(
  text: string,
  defaultCurrency: Currency = "USD"
): { name: string; targetAmount: number; currency: Currency } | null {
  const normalizedText = text.replace(",", ".")

  const regexWithCurrency =
    /^(.+?)\s+([0-9]+(?:\.[0-9]{1,2})?)\s+([A-Za-z]{3})$/
  const matchWithCurrency = normalizedText.trim().match(regexWithCurrency)

  if (matchWithCurrency) {
    const name = matchWithCurrency[1]?.trim()
    const targetAmount = parseFloat(matchWithCurrency[2]!)
    const currency = matchWithCurrency[3]?.toUpperCase()

    if (!name || !currency || Number.isNaN(targetAmount) || targetAmount <= 0) {
      return null
    }

    if (!VALID_CURRENCIES.includes(currency)) {
      return null
    }

    return { name, targetAmount, currency: currency as Currency }
  }

  const regexWithoutCurrency = /^(.+?)\s+([0-9]+(?:\.[0-9]{1,2})?)$/
  const matchWithoutCurrency = normalizedText.trim().match(regexWithoutCurrency)

  if (matchWithoutCurrency) {
    const name = matchWithoutCurrency[1]?.trim()
    const targetAmount = parseFloat(matchWithoutCurrency[2]!)

    if (!name || Number.isNaN(targetAmount) || targetAmount <= 0) {
      return null
    }

    return { name, targetAmount, currency: defaultCurrency }
  }

  return null
}

export function getValidationErrorMessage(
  lang: Language,
  inputType: "amount" | "balance" | "debt" | "goal"
): string {
  const validCurrencies = VALID_CURRENCIES.join(", ")

  switch (inputType) {
    case "amount":
      return t(lang, "validation.invalidFormat.amount", { validCurrencies })

    case "balance":
      return t(lang, "validation.invalidFormat.balance", { validCurrencies })

    case "debt":
      return t(lang, "validation.invalidFormat.debt", { validCurrencies })

    case "goal":
      return t(lang, "validation.invalidFormat.goal", { validCurrencies })

    default:
      return t(lang, "validation.invalidFormat.default")
  }
}

export function isValidAmount(text: string): boolean {
  const amount = parseFloat(text)
  return !Number.isNaN(amount) && amount > 0
}

export function validateExpenseCategory(
  text: string
): TransactionCategory | null {
  if (!text) return null
  return getExpenseCategoryByLabel(text)
}

export function validateIncomeCategory(
  text: string
): TransactionCategory | null {
  if (!text) return null
  return getIncomeCategoryByLabel(text)
}

export function isValidDate(dateStr: string): boolean {
  // Format: DD.MM.YYYY
  const regex = /^(\d{2})\.(\d{2})\.(\d{4})$/
  const match = dateStr.match(regex)

  if (!match) return false

  const day = parseInt(match[1]!, 10)
  const month = parseInt(match[2]!, 10)
  const year = parseInt(match[3]!, 10)

  if (day < 1 || day > 31 || month < 1 || month > 12) return false

  // Check if the date is valid (considering leap years and days in month)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function parseDate(dateStr: string): Date | null {
  if (!isValidDate(dateStr)) return null

  const regex = /^(\d{2})\.(\d{2})\.(\d{4})$/
  const match = dateStr.match(regex)!

  const day = parseInt(match[1]!, 10)
  const month = parseInt(match[2]!, 10)
  const year = parseInt(match[3]!, 10)

  return new Date(year, month - 1, day)
}

export function isValidCurrency(currency: string): boolean {
  return VALID_CURRENCIES.includes(currency)
}

export function isValidAccountName(name: string): boolean {
  return name.trim().length > 0
}

export function parseNameAndAmount(
  text: string,
  defaultCurrency: Currency = "USD"
): { name: string; amount: number; currency: Currency } | null {
  const normalizedText = text.replace(",", ".").trim()

  // Pattern: "Name Amount" or "Name Amount CURRENCY"
  const regexWithCurrency = /^(.+?)\s+([0-9]+(?:\.[0-9]{1,2})?)\s+([A-Z]{3})$/
  const regexWithoutCurrency = /^(.+?)\s+([0-9]+(?:\.[0-9]{1,2})?)$/

  let match = normalizedText.match(regexWithCurrency)
  if (match) {
    const name = match[1]?.trim()
    const amount = parseFloat(match[2]!)
    const currency = match[3]?.toUpperCase()

    if (!name || !currency || Number.isNaN(amount) || amount <= 0) return null
    if (!VALID_CURRENCIES.includes(currency)) return null

    return { name, amount, currency: currency as Currency }
  }

  match = normalizedText.match(regexWithoutCurrency)
  if (match) {
    const name = match[1]?.trim()
    const amount = parseFloat(match[2]!)

    if (!name || Number.isNaN(amount) || amount <= 0) return null

    return { name, amount, currency: defaultCurrency }
  }

  return null
}

export function isValidDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 31
}

export function normalizeAmount(amount: number): number {
  // Handle both positive and negative numbers correctly
  // Add small epsilon to handle floating point precision issues
  const sign = amount < 0 ? -1 : 1
  const absAmount = Math.abs(amount)
  return (sign * Math.round((absAmount + Number.EPSILON) * 100)) / 100
}
