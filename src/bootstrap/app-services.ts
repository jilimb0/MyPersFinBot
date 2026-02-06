import logger from "../logger"

export async function registerAppServices(bot: any) {
  const { Scheduler } = await import("../services/scheduler")
  const scheduler = new Scheduler(bot)
  scheduler.start()
  logger.info("✅ Scheduler started")

  const { registerCommands } = await import("../commands")
  registerCommands(bot)
  logger.info("✅ Commands registered")

  const handlers = await import("../handlers")
  handlers.registerPeriodReportHandlers(bot)
  logger.info("✅ Period report handlers registered")
}
