/**
 * Reads the client address a trusted edge attached to the request.
 *
 * Called by rate-limited Server Actions and by {@link getClientIp} in the
 * proxy. Vercel sets `x-real-ip` and appends the connecting address to
 * `x-forwarded-for`, so the first hop of that list is whatever the caller
 * sent. A missing address is null, and the caller chooses the fallback.
 *
 * @param headers - `next/headers()` result, or `request.headers` on a route.
 * @returns The edge address, or null when neither header has one.
 * @example
 * getForwardedClientIp(await headers()) // => '203.0.113.1' or null
 */
export function getForwardedClientIp(headers: Headers): string | null {
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = headers.get('x-forwarded-for')
  if (!forwarded) return null

  // The last hop is the one the edge appended. Earlier hops are the caller's.
  const hops = forwarded.split(',')
  for (let index = hops.length - 1; index >= 0; index -= 1) {
    const hop = hops[index]?.trim()
    if (hop) return hop
  }
  return null
}
