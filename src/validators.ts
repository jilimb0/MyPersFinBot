import {
  Currency,
  ExpenseCategory,
  IncomeCategory,
  TransactionCategory,
} from "./types"

const VALID_CURRENCIES = ["USD", "EUR", "GEL", "RUB", "UAH", "PLN"]

export function parseAmountWithCurrency(
  text: string,
  defaultCurrency: Currency = "USD"
): { amount: number; currency: Currency } | null {
  const normalizedText = text.replace(",", ".").trim().toUpperCase()

  const pureNumberRegex = /^(-?[0-9]+(?:\.[0-9]*)?)$/
  if (pureNumberRegex.test(normalizedText)) {
    const amount = parseFloat(normalizedText)
    if (!isNaN(amount) && amount !== 0) {
      return { amount, currency: defaultCurrency }
    }
  }

  const currencyRegex = /^(-?[0-9]+(?:\.[0-9]*)?)\s*([A-Z]{3}|\$)$/
  const currencyMatch = normalizedText.match(currencyRegex)

  if (currencyMatch && currencyMatch[1] && currencyMatch[2]) {
    const amount = parseFloat(currencyMatch[1])
    let currency = currencyMatch[2]

    if (currency === "$") currency = "USD"

    if (!isNaN(amount) && amount !== 0 && VALID_CURRENCIES.includes(currency)) {
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

  const accountId = match[1]!.trim()
  const amount = parseFloat(match[2]!)
  const currency = match[3]!.toUpperCase()

  if (!accountId || isNaN(amount) || amount < 0) {
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

  const counterparty = match[1]!.trim()
  const amount = parseFloat(match[2]!)
  const currency = match[3]!.toUpperCase()
  const typeStr = match[4]!.toLowerCase()

  if (!counterparty || isNaN(amount) || amount <= 0) {
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
    const name = matchWithCurrency[1]!.trim()
    const targetAmount = parseFloat(matchWithCurrency[2]!)
    const currency = matchWithCurrency[3]!.toUpperCase()

    if (!name || isNaN(targetAmount) || targetAmount <= 0) {
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
    const name = matchWithoutCurrency[1]!.trim()
    const targetAmount = parseFloat(matchWithoutCurrency[2]!)

    if (!name || isNaN(targetAmount) || targetAmount <= 0) {
      return null
    }

    return { name, targetAmount, currency: defaultCurrency }
  }

  return null
}

export function getValidationErrorMessage(
  inputType: "amount" | "balance" | "debt" | "goal"
): string {
  const validCurrencies = VALID_CURRENCIES.join(", ")

  switch (inputType) {
    case "amount":
      return `❌ Invalid format!\n\nPlease use: \`amount CURRENCY\`\nExample: \`100 USD\`\n\nSupported currencies: ${validCurrencies}`

    case "balance":
      return `❌ Invalid format!\n\nPlease use: \`AccountName amount CURRENCY\`\nExample: \`Cash 150 USD\`\n\nSupported currencies: ${validCurrencies}`

    case "debt":
      return `❌ Invalid format!\n\nPlease use: \`Name amount CURRENCY type\`\nExample: \`Alice 50 USD me\` (she owes me)\nExample: \`Bob 100 USD owe\` (I owe him)\n\nSupported currencies: ${validCurrencies}`

    case "goal":
      return `❌ Invalid format!\n\nPlease use: \`GoalName amount\` or \`GoalName amount CURRENCY\`\nExample: \`Laptop 2000\` or \`Laptop 2000 USD\`\n\nSupported currencies: ${validCurrencies}`

    default:
      return "❌ Invalid input format. Please try again."
  }
}

export function isValidAmount(text: string): boolean {
  const amount = parseFloat(text)
  return !isNaN(amount) && amount > 0
}

export function validateExpenseCategory(
  text: string
): TransactionCategory | null {
  const categories = Object.values(ExpenseCategory)
  const normalized = text.trim()

  if (categories.includes(normalized as ExpenseCategory)) {
    return normalized as ExpenseCategory
  }

  return null
}

export function validateIncomeCategory(
  text: string
): TransactionCategory | null {
  const categories = Object.values(IncomeCategory)
  const normalized = text.trim()

  if (categories.includes(normalized as IncomeCategory)) {
    return normalized as IncomeCategory
  }

  return null
}
