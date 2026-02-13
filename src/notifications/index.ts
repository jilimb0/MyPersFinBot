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

export * from "./budget-alerts"
export * from "./formatters"
export * from "./notification.service"
export * from "./smart-alerts"
export * from "./types"

// Export default service
import { notificationService } from "./notification.service"
export default notificationService
