/**
 * Notifications module
 *
 * Advanced notification system:
 * - Budget alerts (exceeded, warning)
 * - Smart alerts (unusual expenses, patterns)
 * - Analytics alerts (trends, comparisons)
 * - Scheduled reports (daily, weekly, monthly)
 * - Custom triggers (user-defined rules)
 */

export * from "./types"
export * from "./budget-alerts"
export * from "./smart-alerts"
export * from "./notification.service"
export * from "./formatters"

// Export default service
import { notificationService } from "./notification.service"
export default notificationService
