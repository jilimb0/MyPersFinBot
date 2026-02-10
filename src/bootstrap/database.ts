/**
 * Database initialization module
 */

import { closeCache, initializeCache } from "../cache"
import { config } from "../config"
import { closeDatabase, initializeDatabase } from "../database/data-source"
import { dbStorage } from "../database/storage-db"
import logger from "../logger"

/**
 * Initialize database and cache
 */
export async function initializeDatabaseAndCache(): Promise<void> {
  try {
    // Initialize TypeORM database
    await initializeDatabase()
    if (config.LOG_BOOT_DETAIL) {
      logger.info("✅ Database initialized")
    }
    await dbStorage.migrateCategoryValues()
    if (config.LOG_BOOT_DETAIL) {
      logger.info("✅ Category values migrated")
    }

    // Initialize cache
    await initializeCache({ namespace: "finbot", ttl: 3600 })
    if (config.LOG_BOOT_DETAIL) {
      logger.info("✅ Cache initialized")
    }
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
    if (config.LOG_BOOT_DETAIL) {
      logger.info("✅ Database and cache closed")
    }
  } catch (error) {
    logger.error("Failed to close database/cache", error)
    throw error
  }
}
