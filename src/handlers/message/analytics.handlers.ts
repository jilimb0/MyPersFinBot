/**
 * Analytics (Stats) message handlers
 */

import type { MessageHandler } from "./types"

/**
 * Handle analytics menu button
 */
export const handleAnalyticsMenu: MessageHandler = async (context) => {
  const { chatId, userId, lang, wizardManager } = context

  wizardManager.setState(userId, {
    step: "ANALYTICS_MENU",
    data: {},
    returnTo: "analytics",
    lang,
  })

  await wizardManager.handleWizardInput(chatId, userId, "")
  return true
}
