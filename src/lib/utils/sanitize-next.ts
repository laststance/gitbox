/**
 * Sanitize a `next` query parameter to prevent open-redirect attacks.
 *
 * Used by OAuth callback and silent-refresh route handlers to validate
 * post-authentication redirect destinations supplied via query string.
 * Allows only same-origin relative paths starting with `/`. Blocks:
 *  - protocol-relative URLs (`//evil.com`) — browsers treat as scheme-relative
 *  - backslash variants (`/\evil.com`) — WHATWG URL Standard normalizes `\`
 *    to `/` for http/https, so `/\evil.com` parses as `//evil.com`
 *  - absolute URLs (`https://evil.com`) — fail the leading-`/` check
 *  - missing input (`null`) — caller's fallback wins
 *
 * @param rawNext - Raw `next` query parameter value (or `null` when absent).
 * @param fallback - Default path returned when sanitization rejects the input.
 *   Must itself be a safe relative path; not re-validated.
 * @returns
 *   - `rawNext` when it is a safe same-origin relative path
 *   - `fallback` for any rejected, malformed, or null input
 *
 * @example
 *   sanitizeNextPath('/board/abc', '/boards')   // => '/board/abc'
 *   sanitizeNextPath('//evil.com', '/boards')   // => '/boards'
 *   sanitizeNextPath('/\\evil.com', '/boards')  // => '/boards'
 *   sanitizeNextPath('https://x', '/boards')    // => '/boards'
 *   sanitizeNextPath(null, '/boards')           // => '/boards'
 */
export function sanitizeNextPath(
  rawNext: string | null,
  fallback: string,
): string {
  if (rawNext === null) return fallback
  return rawNext.startsWith('/') &&
    !rawNext.startsWith('//') &&
    !rawNext.includes('\\')
    ? rawNext
    : fallback
}
