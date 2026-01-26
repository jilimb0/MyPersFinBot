import { BankParser } from "./base-parser"
import {
  ParsedTransaction,
  BankParserResult,
  BankType,
  TransactionType,
  Currency,
} from "../types"

interface MonobankJSONTransaction {
  time: number // Unix timestamp in seconds
  amount: number // Amount in minor units (cents)
  currencyCode?: number // ISO 4217 currency code
  description?: string
  comment?: string
  mcc?: number
  hold?: boolean
}

export class MonobankParser extends BankParser {
  get bankType(): BankType {
    return "MONOBANK"
  }

  async parse(content: string): Promise<BankParserResult> {
    // Try JSON first
    if (content.trim().startsWith("[") || content.trim().startsWith("{")) {
      return this.parseJSON(content)
    }

    // Otherwise parse as CSV
    return this.parseCSV(content)
  }

  private async parseJSON(content: string): Promise<BankParserResult> {
    try {
      const data = JSON.parse(content)
      const transactions: ParsedTransaction[] = []

      const items = Array.isArray(data) ? data : [data]

      for (const item of items) {
        const parsed = this.parseJSONItem(item)
        if (parsed) {
          transactions.push(parsed)
        }
      }

      return this.buildResult(transactions)
    } catch (error) {
      this.errors.push(`Failed to parse JSON: ${error}`)
      return this.buildResult([])
    }
  }

  private parseJSONItem(
    item: MonobankJSONTransaction
  ): ParsedTransaction | null {
    if (!item.time || item.amount === undefined) {
      return null
    }

    // Monobank timestamp is in seconds
    const date = new Date(item.time * 1000).toISOString()

    // Amount in minor units (1 UAH = 100 units)
    const amount = Math.abs(item.amount / 100)
    const type =
      item.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME

    // Currency code (980 = UAH, 840 = USD, 978 = EUR)
    const currencyCode = item.currencyCode || 980
    let currency
    switch (currencyCode) {
      case 980:
        currency = "UAH"
        break
      case 840:
        currency = "USD"
        break
      case 978:
        currency = "EUR"
        break
      default:
        currency = this.options.defaultCurrency || "UAH"
    }

    const description =
      item.description || item.comment || "Monobank transaction"
    const category = this.options.autoCategorie
      ? this.categorizeByDescription(description)
      : undefined

    return {
      date,
      amount,
      currency: currency as Currency,
      type,
      category,
      description,
      accountId: this.options.defaultAccount,
    }
  }

  private async parseCSV(content: string): Promise<BankParserResult> {
    const lines = content.trim().split("\n")

    if (lines.length < 2) {
      this.errors.push("CSV file is empty or invalid")
      return this.buildResult([])
    }

    // Skip header
    const dataLines = lines.slice(1)
    const transactions: ParsedTransaction[] = []

    for (const line of dataLines) {
      try {
        const parsed = this.parseCSVLine(line)
        if (parsed) {
          transactions.push(parsed)
        }
      } catch (error) {
        this.errors.push(`Failed to parse CSV line: ${line}`)
      }
    }

    return this.buildResult(transactions)
  }

  private parseCSVLine(line: string): ParsedTransaction | null {
    // Monobank CSV: "Date","Description","Category","Amount","Currency"
    const parts = line.split(",").map((p) => p.replace(/^"|"$/g, "").trim())

    if (parts.length < 4) {
      return null
    }

    const [dateStr, description, categoryStr, amountStr, currencyStr] = parts

    if (!dateStr || !amountStr) return null

    const isoDate = this.normalizeDate(dateStr, ["DD.MM.YYYY HH:mm:ss"])
    const { amount, type } = this.parseAmount(amountStr)
    const currency = this.extractCurrency(currencyStr || "UAH")

    const autoCategory = this.options.autoCategorie
      ? this.categorizeByDescription(description || categoryStr || "")
      : undefined

    return {
      date: isoDate,
      amount,
      currency,
      type,
      category: autoCategory,
      description: description || "Monobank transaction",
      accountId: this.options.defaultAccount,
    }
  }
}
