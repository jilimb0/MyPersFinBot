import { BankParser } from "./base-parser"
import { TinkoffParser } from "./tinkoff-parser"
import { MonobankParser } from "./monobank-parser"
import { RevolutParser } from "./revolut-parser"
import { WiseParser } from "./wise-parser"
import { BankType, BankParserOptions } from "../types"

export class BankParserFactory {
  static detectBankType(content: string, fileName?: string): BankType {
    const lower = content.toLowerCase()
    const fileNameLower = fileName?.toLowerCase() || ""

    // Check file name first
    if (fileNameLower.includes("tinkoff")) return "TINKOFF"
    if (fileNameLower.includes("mono")) return "MONOBANK"
    if (fileNameLower.includes("revolut")) return "REVOLUT"
    if (fileNameLower.includes("wise")) return "WISE"

    // Check content
    if (lower.includes("tinkoff") || lower.includes("тинькофф")) {
      return "TINKOFF"
    }

    if (lower.includes("monobank") || lower.includes("монобанк")) {
      return "MONOBANK"
    }

    if (lower.includes("revolut")) {
      return "REVOLUT"
    }

    if (lower.includes("wise") || lower.includes("transferwise")) {
      return "WISE"
    }

    // Try to detect by format
    if (content.trim().startsWith("[") || content.trim().startsWith("{")) {
      return "MONOBANK" // JSON format
    }

    // Check CSV headers
    if (lower.includes("card") && lower.includes("status")) {
      return "TINKOFF"
    }

    if (lower.includes("type") && lower.includes("product") && lower.includes("state")) {
      return "REVOLUT"
    }

    return "UNKNOWN"
  }

  static createParser(bankType: BankType, options?: BankParserOptions): BankParser {
    switch (bankType) {
      case "TINKOFF":
        return new TinkoffParser(options)
      case "MONOBANK":
        return new MonobankParser(options)
      case "REVOLUT":
        return new RevolutParser(options)
      case "WISE":
        return new WiseParser(options)
      default:
        throw new Error(`Unsupported bank type: ${bankType}`)
    }
  }

  static async parseAuto(
    content: string,
    fileName?: string,
    options?: BankParserOptions
  ) {
    const bankType = this.detectBankType(content, fileName)
    
    if (bankType === "UNKNOWN") {
      throw new Error("Could not detect bank type. Please specify manually.")
    }

    const parser = this.createParser(bankType, options)
    return await parser.parse(content)
  }
}
