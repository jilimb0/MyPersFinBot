import TelegramBot from "node-telegram-bot-api"
import { dbStorage as db } from "../database/storage-db"
import { t, languageNames, isValidLanguage, Language } from "../i18n"
import { getMainMenuKeyboard, getLanguageKeyboard } from "../i18n/keyboards"

/**
 * Show language selection menu
 */
export async function showLanguageMenu(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const currentLang = (await db.getUserLanguage(userId)) as Language

  const message =
    `🌍 *${t(currentLang, "settings.language")}*\n\n` +
    `${t(currentLang, "settings.currentLanguage")} ${languageNames[currentLang]}\n\n` +
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
  // Match language by emoji flag
  let selectedLang: Language | null = null

  if (text.includes("English") || text.includes("🇬🇧")) {
    selectedLang = "en"
  } else if (text.includes("Русский") || text.includes("🇷🇺")) {
    selectedLang = "ru"
  } else if (text.includes("Українська") || text.includes("🇺🇦")) {
    selectedLang = "uk"
  } else if (text.includes("Español") || text.includes("🇪🇸")) {
    selectedLang = "es"
  } else if (text.includes("Polski") || text.includes("🇵🇱")) {
    selectedLang = "pl"
  }

  if (!selectedLang || !isValidLanguage(selectedLang)) {
    return false
  }

  // Save language
  await db.setUserLanguage(userId, selectedLang)

  // Send confirmation in NEW language
  const confirmMsg = t(selectedLang, "settings.languageChanged", {
    language: languageNames[selectedLang],
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
    return existingLang as Language
  }

  // Try to detect from Telegram
  let detectedLang: Language = "en"

  if (telegramLangCode) {
    const langCode = telegramLangCode.toLowerCase().split("-")[0] as Language

    if (isValidLanguage(langCode)) {
      detectedLang = langCode
    }
  }

  // Save detected language
  await db.setUserLanguage(userId, detectedLang)

  return detectedLang
}
