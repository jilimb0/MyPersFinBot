import { en } from './locales/en'
import { ru } from './locales/ru'
import { uk } from './locales/uk'
import { es } from './locales/es'
import { pl } from './locales/pl'

export type Language = 'en' | 'ru' | 'uk' | 'es' | 'pl'
export type TranslationKey = typeof en

const translations: Record<Language, TranslationKey> = {
  en,
  ru,
  uk,
  es,
  pl,
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
  const keys = path.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Simple interpolation: replace {key} with value
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val))
    })
  }

  return result
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): Language[] {
  return ['en', 'ru', 'uk', 'es', 'pl']
}

/**
 * Check if language is supported
 */
export function isValidLanguage(lang: Language): lang is Language {
  return ['en', 'ru', 'uk', 'es', 'pl'].includes(lang)
}

/**
 * Language names for display in UI
 */
export const languageNames: Record<Language, string> = {
  en: '🇬🇧 English',
  ru: '🇷🇺 Русский',
  uk: '🇺🇦 Українська',
  es: '🇪🇸 Español',
  pl: '🇵🇱 Polski',
}

/**
 * Language flags (emoji)
 */
export const languageFlags: Record<Language, string> = {
  en: '🇬🇧',
  ru: '🇷🇺',
  uk: '🇺🇦',
  es: '🇪🇸',
  pl: '🇵🇱',
}

/**
 * Detect language from Telegram user
 * Falls back to English if not supported
 */
export function detectLanguage(telegramLangCode?: string): Language {
  if (!telegramLangCode) return 'en'

  const lang = telegramLangCode.toLowerCase().split('-')[0] as Language

  if (isValidLanguage(lang)) {
    return lang
  }

  // Fallback
  return 'en'
}

// Export helper functions
export * from './helpers'
