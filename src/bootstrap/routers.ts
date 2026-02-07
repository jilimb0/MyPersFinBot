import TelegramBot from "node-telegram-bot-api"
import { createMessageRouter } from "../handlers/message"
import { registerCallbackRouter } from "../handlers/callback-router"
import { WizardManager } from "../wizards/wizards"
import logger from "../logger"
import { config } from "../config"

export function registerRouters(bot: TelegramBot) {
  const wizardManager = new WizardManager(bot)
  if (config.LOG_BOOT_DETAIL) {
    logger.info("✅ Wizard manager initialized")
  }

  const messageRouter = createMessageRouter(bot, wizardManager)
  messageRouter.listen()

  registerCallbackRouter(bot, wizardManager)

  return wizardManager
}
