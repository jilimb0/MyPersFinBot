import { config } from "../config"
import logger from "../logger"

export async function registerAppServices(bot: any) {
  const { Scheduler } = await import("../services/scheduler")
  const scheduler = new Scheduler(bot)
  scheduler.start()
  if (config.LOG_BOOT_DETAIL) {
    logger.info("✅ Scheduler started")
  }

  const { registerCommands } = await import("../commands")
  registerCommands(bot)
  if (config.LOG_BOOT_DETAIL) {
    logger.info("✅ Commands registered")
  }

  const handlers = await import("../handlers")
  handlers.registerPeriodReportHandlers(bot)
  if (config.LOG_BOOT_DETAIL) {
    logger.info("✅ Period report handlers registered")
  }
}
