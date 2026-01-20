import { BankParser } from "./base-parser"
import { ParsedTransaction, BankParserResult, BankType, TransactionType } from "../types"

export class RevolutParser extends BankParser {
  get bankType(): BankType {
    return "REVOLUT"
  }

  async parse(content: string): Promise<BankParserResult> {
    const lines = content.trim().split("\n")
    
    if (lines.length < 2) {
      this.errors.push("File is empty or invalid")
      return this.buildResult([])
    }

    // Skip header
    const dataLines = lines.slice(1)
    const transactions: ParsedTransaction[] = []

    for (const line of dataLines) {
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
    // Revolut CSV: "Type","Product","Started Date","Completed Date","Description","Amount","Fee","Currency","State","Balance"
    // Example: "CARD_PAYMENT","Current","2023-12-01 12:34:56","2023-12-01 12:34:56","Grocery Store","-50.00","0.00","EUR","COMPLETED","450.00"
    
    const parts = line.split(",").map(p => p.replace(/^"|"$/g, "").trim())

    if (parts.length < 8) {
      this.warnings.push(`Invalid line format: ${line}`)
      return null
    }

    const [type, product, startedDate, completedDate, description, amountStr, fee, currencyStr, state, balance] = parts

    // Skip failed transactions
    if (state && state !== "COMPLETED") {
      return null
    }

    // Use completed date, fallback to started date
    const dateStr = completedDate || startedDate
    const isoDate = this.normalizeDate(dateStr, ["YYYY-MM-DD HH:mm:ss"])

    // Parse amount
    const { amount, type: txType } = this.parseAmount(amountStr)

    // Get currency
    const currency = this.extractCurrency(currencyStr)

    // Auto-categorize
    const category = this.options.autoCategorie
      ? this.categorizeByDescription(description || type || "")
      : undefined

    return {
      date: isoDate,
      amount,
      currency,
      type: txType,
      category,
      description: description || type || "Revolut transaction",
      accountId: this.options.defaultAccount,
    }
  }
}
