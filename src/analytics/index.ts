/**
 * Analytics module
 *
 * Provides financial insights, statistics, and reporting:
 * - Period summaries (day, week, month, year)
 * - Category breakdown
 * - Spending patterns
 * - Trend analysis
 * - Period comparisons
 * - Budget tracking
 */

export { AnalyticsService, analyticsService } from "./analytics.service"
export * from "./formatters"
export * from "./helpers"
export * from "./types"

// Export default
import { analyticsService } from "./analytics.service"
export default analyticsService
