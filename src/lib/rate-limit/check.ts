/**
 * Rate Limit Check (In-Memory)
 *
 * Main entry point for rate limiting in server actions.
 * Creates one SlidingWindowLimiter per rate limit key (lazy).
 * Bypasses rate limiting in test mode (E2E / unit tests).
 *
 * @example
 * const result = checkRateLimit('deleteAccount', userId)
 * if (!result.allowed) {
 *   return { success: false, error: result.error }
 * }
 */

import * as Sentry from '@sentry/nextjs'

import { logSecurityEvent } from '@/lib/security-events'
import { isTestMode } from '@/tests/isTestMode'

import { RATE_LIMIT_CONFIG, type RateLimitKey } from './config'
import { SlidingWindowLimiter } from './memory'

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Error message when rate limited */
  error?: string
}

const limiters = new Map<RateLimitKey, SlidingWindowLimiter>()

/**
 * Get or create a limiter for the given config key.
 *
 * @param key - Rate limit configuration key
 * @returns SlidingWindowLimiter instance for this key
 */
function getLimiter(key: RateLimitKey): SlidingWindowLimiter {
  const existing = limiters.get(key)
  if (existing) return existing

  const config = RATE_LIMIT_CONFIG[key]
  const limiter = new SlidingWindowLimiter(config.maxRequests, config.windowMs)
  limiters.set(key, limiter)
  return limiter
}

/**
 * Check rate limit for an action.
 *
 * @param key - Rate limit configuration key (e.g., 'deleteAccount', 'githubApi')
 * @param identifier - Unique identifier (user ID for authenticated, IP for unauthenticated)
 * @returns { allowed: true } or { allowed: false, error: string }
 *
 * @example
 * // In a server action
 * const rl = checkRateLimit('githubApi', user.id)
 * if (!rl.allowed) return { success: false, error: rl.error! }
 *
 * // For unauthenticated endpoints
 * const rl = checkRateLimit('signInWithGitHub', clientIp)
 * if (!rl.allowed) redirect(`/login?error=rate_limited`)
 */
export function checkRateLimit(
  key: RateLimitKey,
  identifier: string,
): RateLimitResult {
  // Bypass in test mode (E2E + unit tests)
  if (isTestMode()) {
    return { allowed: true }
  }

  const limiter = getLimiter(key)
  const allowed = limiter.check(identifier)

  if (!allowed) {
    const config = RATE_LIMIT_CONFIG[key]

    logSecurityEvent('rate_limited', {
      userId: identifier,
      path: key,
    })
    Sentry.captureMessage(`Rate limit hit: ${key}`, {
      level: 'warning',
      tags: { category: 'rate_limit', action: key },
      extra: { identifier },
    })

    return {
      allowed: false,
      error: `Too many ${config.description} requests. Please try again later.`,
    }
  }

  return { allowed: true }
}
