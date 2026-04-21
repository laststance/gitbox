/**
 * Edge-Compatible In-Memory Rate Limiter
 *
 * Simplified fixed-window rate limiter for Edge runtime (proxy.ts).
 * Uses a Map with manual expiry checking (no setInterval — Edge runtime safe).
 *
 * @example
 * const ip = getClientIp(request)
 * if (!edgeRateLimit(ip, 10, 60_000)) {
 *   return new NextResponse('Too many requests', { status: 429 })
 * }
 */

const store = new Map<string, { count: number; resetAt: number }>()

/**
 * Check if a request is allowed under a fixed-window rate limit.
 *
 * @param identifier - Unique key (typically IP address)
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
 * Extract client IP from request headers.
 * Falls back to '127.0.0.1' if no IP header is found.
 *
 * @param request - Incoming request
 * @returns Client IP address string
 *
 * @example
 * const ip = getClientIp(request)
 * // '203.0.113.42' (from x-forwarded-for)
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? '127.0.0.1'
  return request.headers.get('x-real-ip') ?? '127.0.0.1'
}
