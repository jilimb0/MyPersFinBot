import { TransactionType } from "../types"

export interface SearchFilters {
  query?: string
  type?: TransactionType
  category?: string
  startDate?: Date
  endDate?: Date
  minAmount?: number
  maxAmount?: number
  accountId?: string
  fromAccountId?: string
  toAccountId?: string
}

export interface ParsedSearchCommand {
  filters: SearchFilters
  errors: string[]
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function parseAmount(value: string): number | null {
  const normalized = value.replace(",", ".")
  const amount = Number.parseFloat(normalized)
  if (!Number.isFinite(amount)) return null
  return amount
}

export function parseSearchCommandInput(
  rawInput?: string
): ParsedSearchCommand {
  const filters: SearchFilters = {}
  const errors: string[] = []

  const input = rawInput?.trim()
  if (!input) {
    return { filters, errors }
  }

  const tokens = input.split(/\s+/).filter(Boolean)
  const queryTokens: string[] = []

  for (const token of tokens) {
    if (!token.startsWith("--")) {
      queryTokens.push(token)
      continue
    }

    const [rawKey, ...rest] = token.slice(2).split("=")
    const key = rawKey?.trim().toLowerCase()
    const value = rest.join("=").trim()

    if (!key) {
      errors.push("Empty filter key")
      continue
    }

    if (!value) {
      errors.push(`Filter '${key}' has empty value`)
      continue
    }

    switch (key) {
      case "type": {
        const type = value.toUpperCase()
        if (type in TransactionType) {
          filters.type = TransactionType[type as keyof typeof TransactionType]
        } else {
          errors.push(`Invalid type '${value}'`)
        }
        break
      }
      case "category":
        filters.category = value
        break
      case "from": {
        const date = parseDate(value)
        if (!date) errors.push(`Invalid from date '${value}'`)
        else filters.startDate = date
        break
      }
      case "to": {
        const date = parseDate(value)
        if (!date) errors.push(`Invalid to date '${value}'`)
        else {
          date.setHours(23, 59, 59, 999)
          filters.endDate = date
        }
        break
      }
      case "min": {
        const amount = parseAmount(value)
        if (amount === null) errors.push(`Invalid min amount '${value}'`)
        else filters.minAmount = amount
        break
      }
      case "max": {
        const amount = parseAmount(value)
        if (amount === null) errors.push(`Invalid max amount '${value}'`)
        else filters.maxAmount = amount
        break
      }
      case "account":
        filters.accountId = value
        break
      case "from-account":
      case "fromaccount":
        filters.fromAccountId = value
        break
      case "to-account":
      case "toaccount":
        filters.toAccountId = value
        break
      default:
        errors.push(`Unknown filter '${key}'`)
    }
  }

  if (queryTokens.length > 0) {
    filters.query = queryTokens.join(" ")
  }

  if (
    filters.startDate &&
    filters.endDate &&
    filters.endDate.getTime() < filters.startDate.getTime()
  ) {
    errors.push("Date range is invalid: 'to' is before 'from'")
  }

  if (
    typeof filters.minAmount === "number" &&
    typeof filters.maxAmount === "number" &&
    filters.maxAmount < filters.minAmount
  ) {
    errors.push("Amount range is invalid: max is less than min")
  }

  return { filters, errors }
}

export function formatSearchUsage(): string {
  return [
    "Usage:",
    "/search coffee",
    "/search rent --type=EXPENSE --from=2026-01-01 --to=2026-02-01",
    "/search --category=FOOD_DINING --min=10 --max=200 --account=Card",
    "/search --from-account=Card --to-account=Savings --min=1 --max=1000",
  ].join("\n")
}
