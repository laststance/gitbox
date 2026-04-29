/**
 * Coerce a `next` query parameter to a safe same-origin path. Blocks
 * protocol-relative (`//evil`), backslash-variant (`/\evil` — WHATWG
 * normalizes `\` to `/`), and absolute URLs to prevent open redirects.
 *
 * @param rawNext - Raw `next` query value (or `null` when absent).
 * @param fallback - Path returned when input is rejected; assumed safe (not re-validated).
 * @returns The original path when safe, otherwise the fallback.
 *
 * @example
 *   sanitizeNextPath('/board/abc', '/boards') // => '/board/abc'
 *   sanitizeNextPath('//evil.com', '/boards') // => '/boards'
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
