/**
 * Start and main menu message handlers
 */

import { config } from "../../config"
import { t } from "../../i18n"
import {
  getMainMenuKeyboard,
  getStartTrackingKeyboard,
} from "../../i18n/keyboards"
import { detectAndSetLanguage } from "../language-handler"
import type { MessageHandler } from "./types"

/**
 * Handle /start command
 */
export const handleStart: MessageHandler = async (context) => {
  const { bot, chatId, userId, msg, lang, db } = context

  // Detect and set language on first start
  if (msg.text === "/start") {
    await detectAndSetLanguage(userId, msg.from?.language_code)
  }

  // Check if user has data
  const userData = await db.getUserData(userId)
  const hasData =
    userData.balances.length > 0 ||
    userData.transactions.length > 0 ||
    userData.debts.length > 0 ||
    userData.goals.length > 0

  if (hasData) {
    await bot.sendMessage(
      chatId,
      t(lang, "mainMenu.welcomeBack"),
      getMainMenuKeyboard(lang)
    )
  } else {
    const freeVoice = t(lang, "commands.monetization.limitVoice", {
      limit: config.FREE_VOICE_INPUTS_PER_DAY,
    })
    const freeTx = t(lang, "commands.monetization.limitTransaction", {
      limit: config.FREE_TRANSACTIONS_PER_MONTH,
    })
    const premiumBlock =
      `${t(lang, "commands.monetization.featureVoice")}\n` +
      `${t(lang, "commands.monetization.featureCommandMode")}\n` +
      `${t(lang, "commands.monetization.featureTemplates")}\n` +
      `${t(lang, "commands.monetization.featureExport")}\n` +
      `${t(lang, "commands.monetization.featureStatementImport")}\n` +
      `${t(lang, "commands.monetization.featureCustomMessages")}`

    await bot.sendMessage(
      chatId,
      `${t(lang, "mainMenu.welcome")}\n\n` +
        `${t(lang, "mainMenu.welcomeIntro")}\n\n` +
        `*Free*\n` +
        `• ${freeTx}\n` +
        `• ${freeVoice}\n\n` +
        `*Premium*\n` +
        `• ${premiumBlock}\n\n` +
        `${t(lang, "commands.monetization.buyUsage")}`,
      {
        parse_mode: "Markdown",
        ...getStartTrackingKeyboard(lang),
      }
    )
  }
  return true
}

/**
 * Handle "Start Tracking" button
 */
export const handleStartTracking: MessageHandler = async (context) => {
  const { bot, chatId, lang } = context

  await bot.sendMessage(
    chatId,
    `${t(lang, "mainMenu.quickStartTitle")}\n\n${t(lang, "mainMenu.quickStartGuide")}`,
    {
      parse_mode: "Markdown",
      ...getMainMenuKeyboard(lang),
    }
  )
  return true
}
