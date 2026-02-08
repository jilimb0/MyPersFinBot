import {
  ExpenseCategory,
  IncomeCategory,
  InternalCategory,
  TransactionCategory,
} from "../types"
import { Language, t } from "./index"

const LANGS: Language[] = ["en", "ru", "uk", "es", "pl"]

type ExpenseKey = keyof typeof ExpenseCategory
type IncomeKey = keyof typeof IncomeCategory
type InternalKey = keyof typeof InternalCategory

function normalizeText(input: string): string {
  return input.trim()
}

export function getExpenseCategoryKey(
  category: ExpenseCategory | string
): ExpenseKey | null {
  const value = normalizeText(String(category))
  const keys = Object.keys(ExpenseCategory) as ExpenseKey[]
  for (const key of keys) {
    if (ExpenseCategory[key] === value) return key
  }
  if ((ExpenseCategory as Record<string, string>)[value]) {
    return value as ExpenseKey
  }
  return null
}

export function getIncomeCategoryKey(
  category: IncomeCategory | string
): IncomeKey | null {
  const value = normalizeText(String(category))
  const keys = Object.keys(IncomeCategory) as IncomeKey[]
  for (const key of keys) {
    if (IncomeCategory[key] === value) return key
  }
  if ((IncomeCategory as Record<string, string>)[value]) {
    return value as IncomeKey
  }
  return null
}

export function getInternalCategoryKey(
  category: InternalCategory | string
): InternalKey | null {
  const value = normalizeText(String(category))
  const keys = Object.keys(InternalCategory) as InternalKey[]
  for (const key of keys) {
    if (InternalCategory[key] === value) return key
  }
  if ((InternalCategory as Record<string, string>)[value]) {
    return value as InternalKey
  }
  return null
}

const LEGACY_CATEGORY_MAP: Record<string, TransactionCategory> = {
  "Food & dining 🍔": ExpenseCategory.FOOD_DINING,
  "Coffee ☕": ExpenseCategory.COFFEE,
  "Groceries 🛍️": ExpenseCategory.GROCERIES,
  "Transport 🚕": ExpenseCategory.TRANSPORTATION,
  "Housing 🏠": ExpenseCategory.HOUSING,
  "Utilities 💡": ExpenseCategory.UTILITIES,
  "Entertainment 🎬": ExpenseCategory.ENTERTAINMENT,
  "Health 🏥": ExpenseCategory.HEALTH,
  "Shopping 🛒": ExpenseCategory.SHOPPING,
  "Education 📚": ExpenseCategory.EDUCATION,
  "Other 📦": ExpenseCategory.OTHER_EXPENSE,
  "Salary 💼": IncomeCategory.SALARY,
  "Freelance 💻": IncomeCategory.FREELANCE,
  "Business 💼": IncomeCategory.BUSINESS,
  "Investment 📈": IncomeCategory.INVESTMENT,
  "Trading 💸": IncomeCategory.TRADING,
  "Bonus 🎁": IncomeCategory.BONUS,
  "Gift 🎁": IncomeCategory.GIFT,
  "Refund 🔄": IncomeCategory.REFUND,
  "Other 💰": IncomeCategory.OTHER_INCOME,
  "Transfer ↔️": InternalCategory.TRANSFER,
  "Goal 🎯": InternalCategory.GOAL_DEPOSIT,
  "Debt 📉": InternalCategory.DEBT_REPAYMENT,
}

export function normalizeCategoryValue(
  value: string | TransactionCategory
): TransactionCategory | null {
  if (!value) return null
  const raw = normalizeText(String(value))
  if ((ExpenseCategory as Record<string, string>)[raw]) {
    return raw as ExpenseCategory
  }
  if ((IncomeCategory as Record<string, string>)[raw]) {
    return raw as IncomeCategory
  }
  if ((InternalCategory as Record<string, string>)[raw]) {
    return raw as InternalCategory
  }
  return LEGACY_CATEGORY_MAP[raw] || null
}

export function getExpenseCategoryLabel(
  lang: Language,
  category: ExpenseCategory | string,
  variant: "full" | "short" = "full"
): string {
  const key = getExpenseCategoryKey(category)
  if (!key) return String(category)
  const i18nKey =
    variant === "short"
      ? `categoriesShort.expense.${key}`
      : `categories.expense.${key}`
  return t(lang, i18nKey)
}

export function getIncomeCategoryLabel(
  lang: Language,
  category: IncomeCategory | string,
  variant: "full" | "short" = "full"
): string {
  const key = getIncomeCategoryKey(category)
  if (!key) return String(category)
  const i18nKey =
    variant === "short"
      ? `categoriesShort.income.${key}`
      : `categories.income.${key}`
  return t(lang, i18nKey)
}

export function getInternalCategoryLabel(
  lang: Language,
  category: InternalCategory | string,
  variant: "full" | "short" = "full"
): string {
  const key = getInternalCategoryKey(category)
  if (!key) return String(category)
  const i18nKey =
    variant === "short"
      ? `categoriesShort.internal.${key}`
      : `categories.internal.${key}`
  return t(lang, i18nKey)
}

export function getCategoryLabel(
  lang: Language,
  category: TransactionCategory | string,
  variant: "full" | "short" = "full"
): string {
  const normalized = normalizeCategoryValue(category)
  if (!normalized) return String(category)
  if ((ExpenseCategory as Record<string, string>)[normalized]) {
    return getExpenseCategoryLabel(lang, normalized, variant)
  }
  if ((IncomeCategory as Record<string, string>)[normalized]) {
    return getIncomeCategoryLabel(lang, normalized, variant)
  }
  if ((InternalCategory as Record<string, string>)[normalized]) {
    return getInternalCategoryLabel(lang, normalized, variant)
  }
  return String(category)
}

export function getExpenseCategoryByLabel(
  label: string
): ExpenseCategory | null {
  const text = normalizeText(label)
  const keys = Object.keys(ExpenseCategory) as ExpenseKey[]
  for (const lang of LANGS) {
    for (const key of keys) {
      const full = t(lang, `categories.expense.${key}`)
      const short = t(lang, `categoriesShort.expense.${key}`)
      if (text === normalizeText(full) || text === normalizeText(short)) {
        return ExpenseCategory[key]
      }
    }
  }
  for (const key of keys) {
    if (text === normalizeText(ExpenseCategory[key])) {
      return ExpenseCategory[key]
    }
  }
  return null
}

export function getIncomeCategoryByLabel(
  label: string
): IncomeCategory | null {
  const text = normalizeText(label)
  const keys = Object.keys(IncomeCategory) as IncomeKey[]
  for (const lang of LANGS) {
    for (const key of keys) {
      const full = t(lang, `categories.income.${key}`)
      const short = t(lang, `categoriesShort.income.${key}`)
      if (text === normalizeText(full) || text === normalizeText(short)) {
        return IncomeCategory[key]
      }
    }
  }
  for (const key of keys) {
    if (text === normalizeText(IncomeCategory[key])) {
      return IncomeCategory[key]
    }
  }
  return null
}
