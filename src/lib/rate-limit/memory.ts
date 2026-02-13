/**
 * In-Memory Sliding Window Rate Limiter
 *
 * Uses a Map-based sliding window algorithm. State is per-process instance
 * (not shared across Vercel function instances). Resets on cold start.
 *
 * Acceptable tradeoffs for a single-user/small-team app:
 * - Cold starts reset counters (more lenient, not more strict)
 * - Multiple concurrent function instances each have their own counter
 * - Memory usage is bounded by periodic cleanup of expired entries
 *
 * @example
 * const limiter = new SlidingWindowLimiter(10, 60_000) // 10 req/min
 * const allowed = limiter.check('user-123')
 * if (!allowed) throw new Error('Rate limited')
 */

interface WindowEntry {
  /** Timestamps of requests within the current window */
  timestamps: number[]
  /** When to auto-cleanup this entry */
  expiresAt: number
}

export class SlidingWindowLimiter {
  private store = new Map<string, WindowEntry>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  /**
   * @param maxRequests - Maximum requests allowed within the window
   * @param windowMs - Time window in milliseconds
   */
  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {
    // Cleanup expired entries every 60 seconds
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60_000)
      // Prevent the interval from keeping the process alive
      if (
        this.cleanupInterval &&
        typeof this.cleanupInterval === 'object' &&
        'unref' in this.cleanupInterval
      ) {
        ;(this.cleanupInterval as NodeJS.Timeout).unref()
      }
    }
  }

  /**
   * Check if a request is allowed under the rate limit.
   *
   * @param identifier - Unique key (user ID, IP address)
   * @returns true if allowed, false if rate limited
   *
   * @example
   * limiter.check('user-abc') // => true (first request)
   * // ... 10 more calls within windowMs ...
   * limiter.check('user-abc') // => false (limit exceeded)
   */
  check(identifier: string): boolean {
    const now = Date.now()
    const windowStart = now - this.windowMs

    let entry = this.store.get(identifier)
    if (!entry) {
      entry = { timestamps: [], expiresAt: now + this.windowMs * 2 }
      this.store.set(identifier, entry)
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart)
    entry.expiresAt = now + this.windowMs * 2

    if (entry.timestamps.length >= this.maxRequests) {
      return false
    }

    entry.timestamps.push(now)
    return true
  }

  /** Remove expired entries to prevent memory leaks */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (entry.expiresAt < now) {
        this.store.delete(key)
      }
    }
  }

  /** Destroy the cleanup interval (for tests) */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}
