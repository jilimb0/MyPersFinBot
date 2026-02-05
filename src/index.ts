import "dotenv/config"
import "reflect-metadata"
import { initializeApp, setupShutdownHandlers } from "./bootstrap"
import { createMessageRouter } from "./handlers/message"
import logger from "./logger"

/**
 * Main application entry point
 */
async function main() {
  try {
    // Load bot token
    const token = process.env.TELEGRAM_BOT_TOKEN

    if (!token) {
      console.error("❌ TELEGRAM_BOT_TOKEN not found in environment variables")
      console.error("Please add TELEGRAM_BOT_TOKEN to your .env file")
      process.exit(1)
    }

    // Initialize application
    const context = await initializeApp(token)

    // Import heavy modules AFTER bootstrap to avoid circular deps
    const { Scheduler } = await import("./services/scheduler")
    const scheduler = new Scheduler(context.bot)
    scheduler.start()
    logger.info("✅ Scheduler started")

    const { registerCommands } = await import("./commands")
    registerCommands(context.bot)
    logger.info("✅ Commands registered")

    const handlers = await import("./handlers")
    handlers.registerPeriodReportHandlers(context.bot)
    logger.info("✅ Period report handlers registered")

    const { WizardManager } = await import("./wizards/wizards")
    const wizardManager = new WizardManager(context.bot)
    logger.info("✅ Wizard manager initialized")

    const messageRouter = createMessageRouter(context.bot, wizardManager)
    messageRouter.listen()

    setupShutdownHandlers(context)

    logger.info("🚀 Bot started successfully")
  } catch (error) {
    console.error("❌ Failed to start bot:")
    console.error(error)
    logger.error("Failed to start application", error)
    process.exit(1)
  }
}

// Start the bot
main().catch((err) => {
  console.error("❌ Unhandled error:", err)
  process.exit(1)
})
