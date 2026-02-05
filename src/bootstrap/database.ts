/**
 * Database initialization module
 */

import { initializeDatabase, closeDatabase } from "../database/data-source"
import { initializeCache, closeCache } from "../cache"
import logger from "../logger"

/**
 * Initialize database and cache
 */
export async function initializeDatabaseAndCache(): Promise<void> {
  try {
    // Initialize TypeORM database
    await initializeDatabase()
    logger.info("✅ Database initialized")

    // Initialize cache
    await initializeCache({ namespace: "finbot", ttl: 3600 })
    logger.info("✅ Cache initialized")
  } catch (error) {
    logger.error("Failed to initialize database/cache", error)
    throw error
  }
}

/**
 * Close database and cache connections
 */
export async function closeDatabaseAndCache(): Promise<void> {
  try {
    await closeDatabase()
    await closeCache()
    logger.info("✅ Database and cache closed")
  } catch (error) {
    logger.error("Failed to close database/cache", error)
    throw error
  }
}
