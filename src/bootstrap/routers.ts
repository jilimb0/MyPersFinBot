import type { BotClient } from "@jilimb0/tgwrapper"
import { config } from "../config"
import { registerCallbackRouter } from "../handlers/callback-router"
import { createMessageRouter } from "../handlers/message"
import logger from "../logger"
import { WizardManager } from "../wizards/wizards"

export function registerRouters(bot: BotClient) {
  const wizardManager = new WizardManager(bot)
  if (config.LOG_BOOT_DETAIL) {
    logger.info("✅ Wizard manager initialized")
  }

  const messageRouter = createMessageRouter(bot, wizardManager)
  messageRouter.listen()

  registerCallbackRouter(bot, wizardManager)

  return wizardManager
}
