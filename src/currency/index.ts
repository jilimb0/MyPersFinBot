/**
 * Currency module
 *
 * Advanced currency exchange features:
 * - Real-time conversion
 * - Multi-currency support
 * - Rate history
 * - Currency statistics
 * - Beautiful Telegram formatting
 */

export * from "./converter"
export * from "./formatters"
export * from "./types"

// Export default converter
import { currencyConverter } from "./converter"
export default currencyConverter
