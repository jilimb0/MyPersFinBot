import dayjs from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat"
import {
  type BankParserOptions,
  type BankParserResult,
  type BankType,
  type Currency,
  ExpenseCategory,
  IncomeCategory,
  type ParsedTransaction,
  type TransactionCategory,
  TransactionType,
} from "../types"

dayjs.extend(customParseFormat)

export abstract class BankParser {
  protected options: BankParserOptions
  protected errors: string[] = []
  protected warnings: string[] = []

  constructor(options: BankParserOptions = {}) {
    this.options = {
      defaultCurrency: "USD",
      autoCategorie: true,
      ...options,
    }
  }

  abstract get bankType(): BankType
  abstract parse(content: string): Promise<BankParserResult>

  // Normalize date to ISO format
  protected normalizeDate(dateStr: string, formats: string[] = []): string {
    const defaultFormats = [
      "DD.MM.YYYY",
      "DD/MM/YYYY",
      "YYYY-MM-DD",
      "MM/DD/YYYY",
      "DD.MM.YYYY HH:mm:ss",
      "YYYY-MM-DD HH:mm:ss",
    ]

    const allFormats = [...formats, ...defaultFormats]

    for (const format of allFormats) {
      const parsed = dayjs(dateStr, format, true)
      if (parsed.isValid()) {
        return parsed.toISOString()
      }
    }

    this.warnings.push(`Could not parse date: ${dateStr}`)
    return new Date().toISOString()
  }

  // Parse amount and determine transaction type
  protected parseAmount(amountStr: string): {
    amount: number
    type: TransactionType
  } {
    // Remove spaces, replace comma with dot
    const cleaned = amountStr.replace(/\s/g, "").replace(",", ".")

    // Check for negative sign
    const isNegative = cleaned.startsWith("-") || cleaned.startsWith("−")
    const absAmount = Math.abs(parseFloat(cleaned))

    if (Number.isNaN(absAmount)) {
      this.errors.push(`Invalid amount: ${amountStr}`)
      return { amount: 0, type: TransactionType.EXPENSE }
    }

    return {
      amount: absAmount,
      type: isNegative ? TransactionType.EXPENSE : TransactionType.INCOME,
    }
  }

  // Categorize transaction based on description
  protected categorizeByDescription(description: string): TransactionCategory {
    const lower = description.toLowerCase()

    // Food & Groceries
    if (
      lower.match(
        /\b(atb|silpo|novus|auchan|carrefour|grocery|supermarket|food|restaurant|cafe|coffee|mcdonald|kfc|burger|pizza)\b/
      )
    ) {
      return ExpenseCategory.FOOD_DINING
    }

    // Transport
    if (
      lower.match(/\b(uber|bolt|taxi|metro|bus|fuel|gas|parking|station)\b/)
    ) {
      return ExpenseCategory.TRANSPORTATION
    }

    // Entertainment
    if (
      lower.match(
        /\b(cinema|movie|netflix|spotify|game|steam|playstation|xbox)\b/
      )
    ) {
      return ExpenseCategory.ENTERTAINMENT
    }

    // Shopping
    if (
      lower.match(/\b(amazon|rozetka|prom|aliexpress|ebay|shop|store|mall)\b/)
    ) {
      return ExpenseCategory.SHOPPING
    }

    // Bills & Utilities
    if (
      lower.match(
        /\b(electric|water|gas|internet|mobile|phone|utility|rent|communal)\b/
      )
    ) {
      return ExpenseCategory.UTILITIES
    }

    // Health
    if (
      lower.match(/\b(pharmacy|apteka|hospital|clinic|doctor|medical|health)\b/)
    ) {
      return ExpenseCategory.HEALTH
    }

    // Salary
    if (lower.match(/\b(salary|wage|зарплата|зп)\b/)) {
      return IncomeCategory.SALARY
    }

    return ExpenseCategory.OTHER_EXPENSE || IncomeCategory.OTHER_INCOME
  }

  // Extract currency from string
  protected extractCurrency(str: string): Currency {
    const upper = str.toUpperCase()

    if (upper.includes("UAH") || upper.includes("₴")) return "UAH"
    if (upper.includes("USD") || upper.includes("$")) return "USD"
    if (upper.includes("EUR") || upper.includes("€")) return "EUR"
    if (upper.includes("PLN") || upper.includes("zł")) return "PLN"
    if (upper.includes("GEL") || upper.includes("₾")) return "GEL"
    if (upper.includes("RUB") || upper.includes("₽")) return "RUB"

    return this.options.defaultCurrency || "USD"
  }

  // Build result
  protected buildResult(transactions: ParsedTransaction[]): BankParserResult {
    return {
      bankType: this.bankType,
      transactions,
      errors: this.errors,
      warnings: this.warnings,
    }
  }
}
