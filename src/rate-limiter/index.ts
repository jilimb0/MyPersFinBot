/**
 * Rate limiter module
 *
 * Production-ready rate limiting:
 * - Sliding window algorithm
 * - Redis-backed (distributed)
 * - Per-user limits
 * - Automatic blocking
 * - Admin bypass
 * - Usage tracking
 */

export { getRateLimitStatus, rateLimiterMiddleware } from "./middleware"
export { RateLimiterService, rateLimiter } from "./rate-limiter.service"
export {
  RateLimitAction,
  RateLimitConfig,
  RateLimitInfo,
  RateLimitResult,
} from "./types"

// Export default
import { rateLimiter } from "./rate-limiter.service"
export default rateLimiter
