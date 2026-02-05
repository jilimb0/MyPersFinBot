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

/**
 * Language names for display
 */
export const languageNames: Record<Language, string> = {
  en: "🇬🇧 English",
  ru: "🇷🇺 Русский",
  uk: "🇺🇦 Українська",
  es: "🇪🇸 Español",
  pl: "🇵🇱 Polski",
}

/**
 * Check if language code is valid
 */
export function isValidLanguage(lang: string): lang is Language {
  return ["en", "ru", "uk", "es", "pl"].includes(lang)
}

/**
 * Get translation by key path
 * @param lang - Language code
 * @param path - Dot-separated path (e.g., 'mainMenu.welcome')
 * @param params - Optional parameters for interpolation
 * @returns Translated string
 */
export function t(
  lang: Language,
  path: string,
  params?: Record<string, string | number>
): string {
  const keys = path.split(".")

  let value: any = translations[lang]

  for (const key of keys) {
    value = value?.[key]
    if (value === undefined) {
      console.warn(`❌ Missing translation: ${lang}.${path}`)
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

// DO NOT export keyboards here - it creates circular dependency
// Import keyboards directly where needed: import { ... } from "../i18n/keyboards"
