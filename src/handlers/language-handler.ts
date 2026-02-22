import type TelegramBot from "@telegram-api"
import { dbStorage as db } from "../database/storage-db"
import { isValidLanguage, type Language, resolveLanguage, t } from "../i18n"
import { getLanguageKeyboard, getMainMenuKeyboard } from "../i18n/keyboards"

/**
 * Show language selection menu
 */
export async function showLanguageMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const currentLang = resolveLanguage(await db.getUserLanguage(userId))

  const message =
    `🌍 *${t(currentLang, "settings.language")}*\n\n` +
    `${t(currentLang, "settings.currentLanguage")} ${t(currentLang, `languages.${currentLang}`)}\n\n` +
    `${t(currentLang, "settings.selectLanguage")}`

  await bot.sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: getLanguageKeyboard(currentLang),
  })
}

/**
 * Handle language selection from buttons
 */
export async function handleLanguageSelection(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const currentLang = resolveLanguage(await db.getUserLanguage(userId))
  // Match language by emoji flag
  let selectedLang: Language | null = null
  const labels: Record<Language, string> = {
    en: t(currentLang, "languages.en"),
    ru: t(currentLang, "languages.ru"),
    uk: t(currentLang, "languages.uk"),
    es: t(currentLang, "languages.es"),
    pl: t(currentLang, "languages.pl"),
  }

  if (text.includes(labels.en) || text.includes("🇬🇧")) {
    selectedLang = "en"
  } else if (text.includes(labels.ru) || text.includes("🇷🇺")) {
    selectedLang = "ru"
  } else if (text.includes(labels.uk) || text.includes("🇺🇦")) {
    selectedLang = "uk"
  } else if (text.includes(labels.es) || text.includes("🇪🇸")) {
    selectedLang = "es"
  } else if (text.includes(labels.pl) || text.includes("🇵🇱")) {
    selectedLang = "pl"
  }

  if (!selectedLang || !isValidLanguage(selectedLang)) {
    return false
  }

  // Save language
  await db.setUserLanguage(userId, selectedLang)

  // Send confirmation in NEW language
  const confirmMsg = t(selectedLang, "settings.languageChanged", {
    language: t(selectedLang, `languages.${selectedLang}`),
  })

  await bot.sendMessage(chatId, confirmMsg, getMainMenuKeyboard(selectedLang))

  return true
}

/**
 * Detect language from Telegram user settings (on first start)
 */
export async function detectAndSetLanguage(
  userId: string,
  telegramLangCode?: string
): Promise<Language> {
  const existingLang = await db.getUserLanguage(userId)

  // If user already has language set, use it
  if (existingLang && isValidLanguage(existingLang)) {
    return existingLang
  }

  // Try to detect from Telegram
  let detectedLang: Language = "en"

  if (telegramLangCode) {
    const langCode = telegramLangCode.toLowerCase().split("-")[0]

    if (isValidLanguage(langCode)) {
      detectedLang = langCode
    }
  }

  // Save detected language
  await db.setUserLanguage(userId, detectedLang)

  return detectedLang
}
