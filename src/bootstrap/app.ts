/**
 * Main application initialization module
 */

import { setupGlobalErrorHandlers } from "../error-handler"
import { logConfig } from "../config"
import logger from "../logger"
import { initializeDatabaseAndCache, closeDatabaseAndCache } from "./database"
import { initializeFXRates, stopFXRatesRefresh } from "./fx-rates"
import { createBot, stopBot, BotContext } from "./bot"

/**
 * Application context
 */
export type AppContext = BotContext

/**
 * Initialize the entire application
 */
export async function initializeApp(token: string): Promise<AppContext> {
  try {
    setupGlobalErrorHandlers()
    logger.info("✅ Global error handlers setup")

    logConfig()

    await initializeDatabaseAndCache()

    await initializeFXRates()

    const botContext = await createBot(token)

    logger.info("🚀 Application initialized successfully")

    return botContext
  } catch (error) {
    logger.error("❌ Failed to initialize application", error)
    throw error
  }
}

/**
 * Graceful shutdown
 */
export async function shutdownApp(context: AppContext): Promise<void> {
  logger.info("\n⏳ Shutting down gracefully...")

  try {
    await stopBot(context)
    stopFXRatesRefresh()
    await closeDatabaseAndCache()

    logger.info("✅ Application shutdown complete")
    process.exit(0)
  } catch (error) {
    logger.error("❌ Error during shutdown", error)
    process.exit(1)
  }
}

/**
 * Setup graceful shutdown handlers
 */
export function setupShutdownHandlers(context: AppContext): void {
  const shutdown = () => shutdownApp(context)

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)

  logger.info("✅ Shutdown handlers registered")
}
