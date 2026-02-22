import "dotenv/config"
import "reflect-metadata"
import { initializeApp, setupShutdownHandlers } from "./bootstrap"
import { registerAppServices } from "./bootstrap/app-services"
import { initObservability } from "./bootstrap/observability"
import { registerRouters } from "./bootstrap/routers"
import { config } from "./config"
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

    initObservability()

    // Initialize application
    const context = await initializeApp(token)

    await registerAppServices(context.bot)

    registerRouters(context.bot)

    setupShutdownHandlers(context)

    if (config.LOG_BOOT_DETAIL) {
      logger.info("🚀 Bot started successfully")
    }

    // Keep process alive in case runtime internals do not retain active handles.
    setInterval(() => {}, 60_000)
    await new Promise<void>(() => {})
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
