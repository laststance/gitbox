/**
 * Silent GitHub Token Refresh Trigger
 *
 * Client-side helper called when a Server Action returns
 * `errorCode: 'GITHUB_TOKEN_MISSING'`. Redirects the browser to the
 * `/api/auth/github/refresh` route, which re-initiates GitHub OAuth and
 * returns the user to the original page once a fresh provider token
 * cookie is in place.
 *
 * Two layers of idempotency keep this safe:
 *  1. Module-level `isRefreshInFlight` flag prevents duplicate redirects
 *     when several hooks fire `Promise.all` against GitHub Server Actions
 *     in parallel and all receive the same `GITHUB_TOKEN_MISSING` error.
 *  2. `sessionStorage` counter persists across the OAuth round-trip so
 *     that if a refresh fails to land a usable token, the next visit
 *     surfaces a hard error to the user instead of looping forever.
 *
 * Cleanup: callers MUST invoke `clearGitHubRefreshAttempts()` whenever a
 * GitHub Server Action succeeds, so the counter resets after the token
 * starts working again.
 *
 * @example
 *   const result = await getAuthenticatedUserRepositories()
 *   if (result.success) {
 *     clearGitHubRefreshAttempts()
 *     return result.data
 *   }
 *   if (result.errorCode === 'GITHUB_TOKEN_MISSING') {
 *     handleGitHubTokenMissing(window.location.pathname)
 *     return undefined
 *   }
 */

const REFRESH_ATTEMPTS_STORAGE_KEY = 'gh_refresh_attempts'

/**
 * Page-lifetime lock preventing duplicate redirects when many hooks see
 * the same `GITHUB_TOKEN_MISSING` error simultaneously. The browser-level
 * navigation triggered by `window.location.href = ...` is asynchronous, so
 * subsequent calls within the same JS tick must short-circuit until the
 * page actually navigates away (and the module is re-evaluated).
 */
let isRefreshInFlight = false

/**
 * Trigger silent re-authentication by navigating to the refresh route.
 *
 * @param currentPath - Path to return to after OAuth (e.g., '/board/abc').
 *   Forwarded as `?next=<path>` and ultimately validated server-side.
 * @returns
 *   - `true` when the handler took over (either initiated a redirect now,
 *     or another redirect is already in flight from a sibling hook).
 *     Caller should NOT set error UI state — the page is unloading.
 *   - `false` when the handler is a no-op for environmental reasons (SSR,
 *     iframe context). Caller SHOULD fall through to its existing error UI.
 *
 * @example
 *   const handled = handleGitHubTokenMissing(window.location.pathname)
 *   if (!handled) setReposError(result.error)
 */
export function handleGitHubTokenMissing(currentPath: string): boolean {
  if (typeof window === 'undefined') return false
  if (isRefreshInFlight) return true

  // Embedded contexts (Storybook test orchestrator, third-party iframe
  // embeds) cannot have window.location.href reassigned without breaking
  // the parent. Fall back to the surrounding error UI in those cases.
  if (window.parent !== window) return false

  isRefreshInFlight = true

  // sessionStorage can throw in Safari private mode or when quota is exceeded.
  // Fall back to a single-attempt refresh (counter not persisted) if so —
  // the server-side rate limit still bounds total refreshes per IP.
  let nextAttempt = 1
  try {
    const previousAttemptsRaw = window.sessionStorage.getItem(
      REFRESH_ATTEMPTS_STORAGE_KEY,
    )
    const previousAttempts =
      previousAttemptsRaw === null
        ? 0
        : parseStoredAttempts(previousAttemptsRaw)
    nextAttempt = previousAttempts + 1
    window.sessionStorage.setItem(
      REFRESH_ATTEMPTS_STORAGE_KEY,
      String(nextAttempt),
    )
  } catch {
    // Storage unavailable — proceed with attempt=1.
  }

  const params = new URLSearchParams()
  params.set('next', currentPath)
  // The server treats a missing `attempt` param as 1, so we only emit it
  // on the second visit. Keeps the happy-path URL clean.
  if (nextAttempt > 1) {
    params.set('attempt', String(nextAttempt))
  }
  window.location.href = `/api/auth/github/refresh?${params.toString()}`
  return true
}

/**
 * Reset the refresh attempt counter.
 *
 * Call this from any GitHub Server Action success path so the counter
 * does not carry over from a previous failed refresh into a fresh tab
 * session.
 *
 * @example
 *   const result = await getAuthenticatedUserRepositories()
 *   if (result.success) {
 *     clearGitHubRefreshAttempts()
 *     return result.data
 *   }
 */
export function clearGitHubRefreshAttempts(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(REFRESH_ATTEMPTS_STORAGE_KEY)
  } catch {
    // Storage may throw in Safari private mode; safe to ignore.
  }
}

/**
 * Defensive parse for a sessionStorage value that may have been tampered
 * with or polluted across versions. Coerces invalid input to 0.
 *
 * @param raw - The raw string read from sessionStorage.
 * @returns
 *   - A non-negative integer when `raw` parses cleanly.
 *   - `0` for `NaN`, negatives, or otherwise unparseable input.
 *
 * @example
 *   parseStoredAttempts('1')   // => 1
 *   parseStoredAttempts('abc') // => 0
 *   parseStoredAttempts('-5')  // => 0
 */
function parseStoredAttempts(raw: string): number {
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}
