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

export { RateLimiterService, rateLimiter } from "./rate-limiter.service"
export { rateLimiterMiddleware, getRateLimitStatus } from "./middleware"
export {
  RateLimitConfig,
  RateLimitInfo,
  RateLimitResult,
  RateLimitAction,
} from "./types"

// Export default
import { rateLimiter } from "./rate-limiter.service"
export default rateLimiter
