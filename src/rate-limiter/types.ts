/**
 * Rate limiter types
 */

export interface RateLimitConfig {
  enabled: boolean
  maxRequests: number // Maximum requests per window
  windowMs: number // Time window in milliseconds
  blockDurationMs?: number // How long to block after limit exceeded
  skipAdmins?: boolean // Skip rate limiting for admin users
}

export interface RateLimitInfo {
  userId: string
  count: number // Current request count
  resetAt: Date // When the window resets
  blocked: boolean // Is user currently blocked
  blockedUntil?: Date // When block expires
}

export interface RateLimitResult {
  allowed: boolean // Is request allowed
  remaining: number // Requests remaining in window
  resetAt: Date // When limit resets
  retryAfter?: number // Seconds to wait before retry (if blocked)
}

export enum RateLimitAction {
  ALLOW = "allow",
  LIMIT = "limit",
  BLOCK = "block",
}
