/**
 * Reads the client address used as a rate-limit key.
 *
 * Called by rate-limited Server Actions and by {@link getClientIp} in the
 * proxy. `x-real-ip` wins. Vercel documents it as the same value as
 * `x-forwarded-for`, which on Vercel is the client's public address.
 * A list uses the last hop, so a prefix the caller added cannot choose the
 * key. One address, the documented Vercel header, is that address either way.
 * A missing address is null, and the caller chooses the fallback.
 *
 * @param headers - `next/headers()` result, or `request.headers` on a route.
 * @returns The address to key, or null when neither header has one.
 * @example
 * getForwardedClientIp(await headers()) // => '203.0.113.1' or null
 */
export function getForwardedClientIp(headers: Headers): string | null {
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = headers.get('x-forwarded-for')
  if (!forwarded) return null

  // A prefix in this list must not select the key. One address is unchanged.
  const hops = forwarded.split(',')
  for (let index = hops.length - 1; index >= 0; index -= 1) {
    const hop = hops[index]?.trim()
    if (hop) return hop
  }
  return null
}
