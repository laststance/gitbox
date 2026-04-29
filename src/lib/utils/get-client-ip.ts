/**
 * Read the first-hop client IP from `x-forwarded-for`.
 *
 * The header value is a comma-separated chain (`client, proxy1, proxy2`);
 * the first entry is the original client. Returns `null` when the header
 * is absent or empty so callers can distinguish "no proxy header" from
 * "client genuinely on the loopback address" and choose their own fallback
 * + missing-header logging strategy.
 *
 * @param headers - `next/headers()` result (Server Actions) or `request.headers` (Route Handlers).
 * @returns First-hop IP (trimmed), or `null` when missing.
 *
 * @example
 *   getForwardedClientIp(await headers())  // => '203.0.113.1' or null
 *   getForwardedClientIp(request.headers)  // => '203.0.113.1' or null
 */
export function getForwardedClientIp(headers: Headers): string | null {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
}
