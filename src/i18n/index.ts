import { en } from "./locales/en"
import { ru } from "./locales/ru"
import { uk } from "./locales/uk"
import { es } from "./locales/es"
import { pl } from "./locales/pl"

export type Language = "en" | "ru" | "uk" | "es" | "pl"
export type TranslationKey = typeof en

const translations: Record<Language, TranslationKey> = {
  en,
  ru,
  uk,
  es,
  pl,
}

export const LOCALE_BY_LANG: Record<Language, string> = {
  en: "en-US",
  ru: "ru-RU",
  uk: "uk-UA",
  es: "es-ES",
  pl: "pl-PL",
}

export function getLocale(lang: Language): string {
  return LOCALE_BY_LANG[lang] || "en-US"
}

export const DAY_KEYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

/**
 * Check if language code is valid
 */
export function isValidLanguage(lang: unknown): lang is Language {
  return (
    typeof lang === "string" && ["en", "ru", "uk", "es", "pl"].includes(lang)
  )
}

export function resolveLanguage(lang: unknown): Language {
  return isValidLanguage(lang) ? lang : "en"
}

/**
 * Get translation by key path
 * @param lang - Language code
 * @param path - Dot-separated path (e.g., 'mainMenu.welcome')
 * @param params - Optional parameters for interpolation
 * @returns Translated string
 */
export function t(
  lang: Language | unknown,
  path: string,
  params?: Record<string, string | number>
): string {
  const safeLang = resolveLanguage(lang)
  if (lang !== safeLang) {
    const stack = new Error().stack?.split("\n").slice(2, 6).join("\n")
    console.warn(
      `⚠️ Invalid language "${String(lang)}" for key "${path}". Using "${safeLang}".\n${stack}`
    )
  }
  const keys = path.split(".")

  let value: any = translations[safeLang]

  for (const key of keys) {
    value = value?.[key]
    if (value === undefined) {
      console.warn(`❌ Missing translation: ${safeLang}.${path}`)
      // Fallback to English
      value = translations.en
      for (const k of keys) {
        value = value?.[k]
        if (value === undefined) {
          return path // Last resort: return key
        }
      }
      break
    }
  }

  let result = value as string

  // Replace parameters
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      result = result.replace(new RegExp(`{${key}}`, "g"), String(val))
    })
  }

  return result
}

/**
 * Get raw translation value (string, array, object) by key path
 */
export function getTranslationValue(
  lang: Language | unknown,
  path: string
): any {
  const safeLang = resolveLanguage(lang)
  if (lang !== safeLang) {
    const stack = new Error().stack?.split("\n").slice(2, 6).join("\n")
    console.warn(
      `⚠️ Invalid language "${String(lang)}" for key "${path}". Using "${safeLang}".\n${stack}`
    )
  }
  const keys = path.split(".")
  let value: any = translations[safeLang]

  for (const key of keys) {
    value = value?.[key]
    if (value === undefined) {
      console.warn(`❌ Missing translation: ${safeLang}.${path}`)
      value = translations.en
      for (const k of keys) {
        value = value?.[k]
        if (value === undefined) {
          return undefined
        }
      }
      break
    }
  }

  return value
}

// DO NOT export keyboards here - it creates circular dependency
// Import keyboards directly where needed: import { ... } from "../i18n/keyboards"

export {
  getExpenseCategoryLabel,
  getIncomeCategoryLabel,
  getExpenseCategoryByLabel,
  getIncomeCategoryByLabel,
  getInternalCategoryLabel,
  getCategoryLabel,
} from "./categories"
