import { BankParser } from "./base-parser"
import { ParsedTransaction, BankParserResult, BankType, TransactionType } from "../types"

export class TinkoffParser extends BankParser {
  get bankType(): BankType {
    return "TINKOFF"
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
    // Tinkoff CSV format: "Date","Time","Card","Status","Amount","Currency","Category","Description"
    // Example: "01.12.2023","12:34:56","*1234","OK","-100.00","RUB","Продукты","ATB Supermarket"
    
    const regex = /"([^"]*)"/g
    const matches = []
    let match

    while ((match = regex.exec(line)) !== null) {
      matches.push(match[1])
    }

    if (matches.length < 6) {
      this.warnings.push(`Invalid line format: ${line}`)
      return null
    }

    const [date, time, card, status, amountStr, currencyStr, category, description] = matches

    // Skip rejected transactions
    if (status && status !== "OK") {
      return null
    }

    // Parse date
    const dateTime = `${date} ${time || "00:00:00"}`
    const isoDate = this.normalizeDate(dateTime, ["DD.MM.YYYY HH:mm:ss"])

    // Parse amount
    const { amount, type } = this.parseAmount(amountStr)

    // Get currency
    const currency = this.extractCurrency(currencyStr)

    // Auto-categorize if enabled
    const autoCategory = this.options.autoCategorie
      ? this.categorizeByDescription(description || category || "")
      : undefined

    return {
      date: isoDate,
      amount,
      currency,
      type,
      category: autoCategory,
      description: description || category || "Tinkoff transaction",
      accountId: this.options.defaultAccount,
    }
  }
}
