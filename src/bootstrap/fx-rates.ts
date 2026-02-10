/**
 * FX rates initialization module
 */

import { config } from "../config"
import {
  getCacheHitRate,
  getCacheStatus,
  preloadRates,
  stopAutoRefresh,
} from "../fx"
import logger from "../logger"

/**
 * Preload FX rates and show cache status
 */
export async function initializeFXRates(): Promise<void> {
  try {
    await preloadRates()

    if (config.LOG_BOOT_DETAIL) {
      const status = getCacheStatus()
      if (status.isPersisted && status.cacheValid) {
        logger.info("✅ Using persisted FX cache (no API call)")
      } else {
        logger.info("🌐 Fetched fresh FX rates from API")
      }
    }

    const hitRate = getCacheHitRate()
    if (config.LOG_CACHE_VERBOSE) {
      logger.debug(`📊 FX Cache hit rate: ${hitRate}%`)
    }
  } catch (error) {
    logger.error("Failed to initialize FX rates", error)
    // Don't throw - bot can work without FX rates
  }
}

/**
 * Stop FX rates auto-refresh
 */
export function stopFXRatesRefresh(): void {
  stopAutoRefresh()
  if (config.LOG_BOOT_DETAIL) {
    logger.info("✅ FX rates auto-refresh stopped")
  }
}
