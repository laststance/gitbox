/**
 * Counts silent GitHub token refreshes in an httpOnly cookie.
 *
 * The client also counts in sessionStorage. When that store throws, the
 * client sends `attempt=1` on every visit and the query cap never trips.
 * This cookie is set by the refresh route and is still there after the
 * OAuth round trip, so the server caps the loop itself.
 */

import { LOGIN_ERROR } from '@/lib/constants/login-errors'

/** Cookie that records how many silent refreshes this browser has started. */
export const REFRESH_ATTEMPT_COOKIE = 'gh_refresh_count'

/**
 * How long a counted refresh keeps counting.
 *
 * Long enough for the OAuth round trip to come back still carrying the
 * count. Short enough that a token which expires hours later is not still
 * blocked. The login page after the cap deletes it sooner.
 */
export const REFRESH_ATTEMPT_MAX_AGE_SECONDS = 10 * 60

/** Login error the refresh route sends once the attempt cap is reached. */
export const TOKEN_REFRESH_FAILED_ERROR = LOGIN_ERROR.tokenRefreshFailed

/**
 * Attributes for {@link REFRESH_ATTEMPT_COOKIE}.
 *
 * httpOnly so the page cannot zero the count when sessionStorage throws.
 * The refresh route sets it on the redirect to GitHub. The proxy clears it
 * with the same path when the cap has already sent the user to login.
 *
 * @returns Cookie attributes, including the short max age.
 * @example
 * response.cookies.set(REFRESH_ATTEMPT_COOKIE, '1', refreshAttemptCookieOptions())
 */
export function refreshAttemptCookieOptions(): {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  maxAge: number
  path: '/'
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_ATTEMPT_MAX_AGE_SECONDS,
    path: '/',
  }
}

/**
 * Cookie header the refresh route should count.
 *
 * A real request carries `Cookie`. happy-dom drops that header on
 * `new Request`, and the tests set the jar with `cookies.set` instead.
 * Called by the refresh route.
 *
 * @param request - The route's request. A Next.js request also has `cookies`.
 * @returns A Cookie header, or null when the request has no cookies.
 * @example
 * refreshAttemptCookieHeader(request) // => 'gh_refresh_count=1' or null
 */
export function refreshAttemptCookieHeader(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (header) return header

  const jar = (
    request as Request & {
      cookies?: { getAll?: () => { name: string; value: string }[] }
    }
  ).cookies
  if (typeof jar?.getAll !== 'function') return null

  const pairs = jar.getAll().map((cookie) => `${cookie.name}=${cookie.value}`)
  return pairs.length > 0 ? pairs.join('; ') : null
}

/**
 * Reads the silent-refresh count the browser already carries.
 *
 * Called by the refresh route with the request's Cookie header, before it
 * decides whether another OAuth round trip is allowed.
 *
 * @param cookieHeader - The raw Cookie header, or null when the request has none.
 * @returns The recorded count, or 0 when the cookie is missing or not a positive integer.
 * @example
 * readRefreshAttempt('gh_refresh_count=1') // => 1
 * readRefreshAttempt(null) // => 0
 */
export function readRefreshAttempt(cookieHeader: string | null): number {
  if (!cookieHeader) return 0

  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=')
    if (name !== REFRESH_ATTEMPT_COOKIE) continue

    const parsed = Number.parseInt(rest.join('='), 10)
    // A missing or rewritten value counts as no attempt yet.
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }
  return 0
}

/**
 * The attempt this refresh counts as.
 *
 * A client that cannot use sessionStorage sends `attempt=1` every time.
 * The cookie from the previous refresh still counts, so the second visit
 * is over the cap. Called by the refresh route.
 *
 * @param queryAttempt - The sanitized `attempt` query, at least 1.
 * @param recorded - The count from {@link readRefreshAttempt}.
 * @returns The attempt to compare with the cap and, when it is allowed, to store.
 * @example
 * nextRefreshAttempt(1, 0) // => 1
 * nextRefreshAttempt(1, 1) // => 2
 */
export function nextRefreshAttempt(
  queryAttempt: number,
  recorded: number,
): number {
  return Math.max(queryAttempt, recorded + 1)
}

/**
 * Whether this request is the login page the refresh route sends after the cap.
 *
 * {@link proxy} deletes the attempt cookie there, matching the sessionStorage
 * reset, so a later sign-in can refresh once more.
 *
 * @param pathname - Request path.
 * @param error - The `error` query, or null.
 * @returns True only for `/login` with {@link TOKEN_REFRESH_FAILED_ERROR}.
 * @example
 * isSpentRefreshLogin('/login', 'token_refresh_failed') // => true
 * isSpentRefreshLogin('/login', 'auth_failed') // => false
 */
export function isSpentRefreshLogin(
  pathname: string,
  error: string | null,
): boolean {
  return pathname === '/login' && error === TOKEN_REFRESH_FAILED_ERROR
}
