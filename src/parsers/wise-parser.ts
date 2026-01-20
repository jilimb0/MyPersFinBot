import { BankParser } from "./base-parser"
import { ParsedTransaction, BankParserResult, BankType, TransactionType } from "../types"

export class WiseParser extends BankParser {
  get bankType(): BankType {
    return "WISE"
  }

  async parse(content: string): Promise<BankParserResult> {
    const lines = content.trim().split("\n")
    
    if (lines.length < 2) {
      this.errors.push("File is empty or invalid")
      return this.buildResult([])
    }

    // Wise uses TXT format with tab-separated values
    const transactions: ParsedTransaction[] = []

    for (const line of lines) {
      try {
        const parsed = this.parseLine(line)
        if (parsed) {
          transactions.push(parsed)
        }
      } catch (error) {
        this.errors.push(`Failed to parse line: ${line}`)
      }
    }

    return this.buildResult(transactions)
  }

  private parseLine(line: string): ParsedTransaction | null {
    // Wise TXT format: Date\tDescription\tAmount\tCurrency\tBalance
    const parts = line.split("\t").map(p => p.trim())

    if (parts.length < 4) {
      return null
    }

    const [dateStr, description, amountStr, currencyStr] = parts

    // Parse date (Wise uses DD-MM-YYYY)
    const isoDate = this.normalizeDate(dateStr, ["DD-MM-YYYY", "YYYY-MM-DD"])

    // Parse amount
    const { amount, type } = this.parseAmount(amountStr)

    // Get currency
    const currency = this.extractCurrency(currencyStr)

    // Auto-categorize
    const category = this.options.autoCategorie
      ? this.categorizeByDescription(description)
      : undefined

    return {
      date: isoDate,
      amount,
      currency,
      type,
      category,
      description: description || "Wise transaction",
      accountId: this.options.defaultAccount,
    }
  }
}
