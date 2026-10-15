/**
 * Edge-Compatible In-Memory Rate Limiter
 *
 * Simplified fixed-window rate limiter for Edge runtime (proxy.ts).
 * Uses a Map with manual expiry checking (no setInterval — Edge runtime safe).
 * Expired entries are dropped during a call, at most once a minute, so the
 * Map holds the identifiers seen lately and not every one since the process
 * started.
 *
 * @example
 * const ip = getClientIp(request)
 * if (!edgeRateLimit(ip, 10, 60_000)) {
 *   return new NextResponse('Too many requests', { status: 429 })
 * }
 */

import { getForwardedClientIp } from '@/lib/utils/get-client-ip'

const store = new Map<string, { count: number; resetAt: number }>()

/** Shortest time between two sweeps of expired entries. */
const EXPIRED_ENTRY_SWEEP_INTERVAL_MS = 60_000

let nextSweepAt = 0

/**
 * Check if a request is allowed under a fixed-window rate limit.
 *
 * @param identifier - Unique key (typically IP address). Callers that limit
 *   different things for the same client prefix it, so they do not share a count.
 * @param maxRequests - Maximum requests per window
 * @param windowMs - Window duration in milliseconds
 * @returns true if allowed, false if rate limited
 *
 * @example
 * edgeRateLimit('192.168.1.1', 10, 60_000) // 10 req/min per IP
 */
export function edgeRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now()

  // Drop the entries whose window has passed, at most once per interval
  if (now >= nextSweepAt) {
    for (const [storedIdentifier, storedEntry] of store) {
      if (storedEntry.resetAt < now) store.delete(storedIdentifier)
    }
    nextSweepAt = now + EXPIRED_ENTRY_SWEEP_INTERVAL_MS
  }

  const entry = store.get(identifier)

  if (!entry || entry.resetAt < now) {
    store.set(identifier, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) {
    return false
  }

  entry.count++
  return true
}

/**
 * Number of identifiers the limiter currently remembers. Exists so a test can
 * show that expired entries are dropped; nothing in the app calls it.
 *
 * @returns Count of entries in the store, expired ones not yet swept included.
 *
 * @example
 * edgeRateLimit('203.0.113.42', 10, 60_000)
 * getEdgeRateLimitEntryCount() // => 1
 */
export function getEdgeRateLimitEntryCount(): number {
  return store.size
}

/**
 * Extract client IP from request headers.
 * Falls back to '127.0.0.1' if no IP header is found.
 *
 * @param request - Incoming request
 * @returns Client IP address string
 *
 * @example
 * const ip = getClientIp(request)
 * // '203.0.113.42' (from x-real-ip, or the last x-forwarded-for hop)
 */
export function getClientIp(request: Request): string {
  // A blank header must not become the shared rate-limit key.
  return getForwardedClientIp(request.headers) || '127.0.0.1'
}
