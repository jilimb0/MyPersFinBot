import { Currency } from "./types"

/**
 * Валидаторы для пользовательского ввода
 */

// Поддерживаемые валюты
const VALID_CURRENCIES = ["USD", "EUR", "GEL", "RUB", "UAH"]

/**
 * Парсит ввод суммы и валюты
 * Примеры: "100 USD", "50.5 EUR", "1000 gel", "100" (использует defaultCurrency)
 * Поддерживает отрицательные значения для возвратов: "-50 USD"
 */
export function parseAmountWithCurrency(
  text: string,
  defaultCurrency: Currency = "USD"
): { amount: number; currency: Currency } | null {
  // Нормализуем запятую на точку для поддержки 0,5 формата
  const normalizedText = text.replace(',', '.')
  
  // Regex 1: число (целое или с точкой, может быть отрицательным) + опционально пробел + валюта
  const fullRegex = /^(-?[0-9]+(?:\.[0-9]{1,2})?)\s+([A-Za-z]{3})$/
  const matchFull = normalizedText.trim().match(fullRegex)

  if (matchFull) {
    const amount = parseFloat(matchFull[1])
    const currency = matchFull[2].toUpperCase()
    if (!isNaN(amount) && amount !== 0 && VALID_CURRENCIES.includes(currency)) {
      return { amount, currency: currency as Currency }
    }
  }

  // Regex 2: просто число (используем defaultCurrency)
  const numberRegex = /^(-?[0-9]+(?:\.[0-9]{1,2})?)$/
  const matchNum = normalizedText.trim().match(numberRegex)

  if (matchNum) {
    const amount = parseFloat(matchNum[1])
    if (!isNaN(amount) && amount !== 0) {
      return { amount, currency: defaultCurrency }
    }
  }

  return null
}

/**
 * Парсит строку баланса: "AccountName 100 USD"
 */
export function parseBalanceInput(
  text: string
): { accountId: string; amount: number; currency: Currency } | null {
  // Нормализуем запятую на точку
  const normalizedText = text.replace(',', '.')
  
  // Regex: название счёта (одно или несколько слов) + число + валюта
  const regex = /^(.+?)\s+([0-9]+(?:\.[0-9]{1,2})?)\s+([A-Za-z]{3})$/
  const match = normalizedText.trim().match(regex)

  if (!match) {
    return null
  }

  const accountId = match[1].trim()
  const amount = parseFloat(match[2])
  const currency = match[3].toUpperCase()

  if (!accountId || isNaN(amount) || amount < 0) {
    return null
  }

  if (!VALID_CURRENCIES.includes(currency)) {
    return null
  }

  return { accountId, amount, currency: currency as Currency }
}

/**
 * Парсит строку долга: "Name 100 USD owe" или "Name 100 USD me"
 */
export function parseDebtInput(
  text: string
): {
  counterparty: string
  amount: number
  currency: Currency
  type: "OWES_ME" | "I_OWE"
} | null {
  // Нормализуем запятую на точку
  const normalizedText = text.replace(',', '.')
  
  // Regex: имя + число + валюта + тип (owe или me)
  const regex =
    /^(.+?)\s+([0-9]+(?:\.[0-9]{1,2})?)\s+([A-Za-z]{3})\s+(owe|me)$/i
  const match = normalizedText.trim().match(regex)

  if (!match) {
    return null
  }

  const counterparty = match[1].trim()
  const amount = parseFloat(match[2])
  const currency = match[3].toUpperCase()
  const typeStr = match[4].toLowerCase()

  if (!counterparty || isNaN(amount) || amount <= 0) {
    return null
  }

  if (!VALID_CURRENCIES.includes(currency)) {
    return null
  }

  const type = typeStr === "me" ? "OWES_ME" : "I_OWE"

  return { counterparty, amount, currency: currency as Currency, type }
}

/**
 * Парсит строку цели: "Goal Name 5000 USD" или "Goal Name 5000" (без валюты)
 */
export function parseGoalInput(
  text: string,
  defaultCurrency: Currency = "USD"
): { name: string; targetAmount: number; currency: Currency } | null {
  // Нормализуем запятую на точку
  const normalizedText = text.replace(',', '.')
  
  // Regex 1: название цели + число + валюта
  const regexWithCurrency = /^(.+?)\s+([0-9]+(?:\.[0-9]{1,2})?)\s+([A-Za-z]{3})$/
  const matchWithCurrency = normalizedText.trim().match(regexWithCurrency)

  if (matchWithCurrency) {
    const name = matchWithCurrency[1].trim()
    const targetAmount = parseFloat(matchWithCurrency[2])
    const currency = matchWithCurrency[3].toUpperCase()

    if (!name || isNaN(targetAmount) || targetAmount <= 0) {
      return null
    }

    if (!VALID_CURRENCIES.includes(currency)) {
      return null
    }

    return { name, targetAmount, currency: currency as Currency }
  }

  // Regex 2: название цели + число (без валюты - используем defaultCurrency)
  const regexWithoutCurrency = /^(.+?)\s+([0-9]+(?:\.[0-9]{1,2})?)$/
  const matchWithoutCurrency = normalizedText.trim().match(regexWithoutCurrency)

  if (matchWithoutCurrency) {
    const name = matchWithoutCurrency[1].trim()
    const targetAmount = parseFloat(matchWithoutCurrency[2])

    if (!name || isNaN(targetAmount) || targetAmount <= 0) {
      return null
    }

    return { name, targetAmount, currency: defaultCurrency }
  }

  return null
}

/**
 * Генерирует сообщение об ошибке в зависимости от типа ввода
 */
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

/**
 * Проверяет, является ли строка числом
 */
export function isValidAmount(text: string): boolean {
  const amount = parseFloat(text)
  return !isNaN(amount) && amount > 0
}
