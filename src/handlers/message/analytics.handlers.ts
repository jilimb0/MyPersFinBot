/**
 * Analytics (Stats) message handlers
 */

import { MessageHandler } from "./types"
import * as menus from "../../menus-i18n"

/**
 * Handle analytics menu button
 */
export const handleAnalyticsMenu: MessageHandler = async (context) => {
  const { bot, chatId, lang } = context

  await menus.showStatsMenu(bot, chatId, lang)
}
