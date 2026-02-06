import TelegramBot from "node-telegram-bot-api"
import { createMessageRouter } from "../handlers/message"
import { registerCallbackRouter } from "../handlers/callback-router"
import { WizardManager } from "../wizards/wizards"
import logger from "../logger"

export function registerRouters(bot: TelegramBot) {
  const wizardManager = new WizardManager(bot)
  logger.info("✅ Wizard manager initialized")

  const messageRouter = createMessageRouter(bot, wizardManager)
  messageRouter.listen()

  registerCallbackRouter(bot, wizardManager)

  return wizardManager
}
