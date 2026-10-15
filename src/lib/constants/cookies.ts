/**
 * Cookie Name Constants & Helpers
 *
 * Environment-specific cookie names + typed setter/deleter for the GitHub
 * provider_token cookie. Centralizes cookie options so a maxAge typo cannot
 * silently re-introduce the "GitHub token not found after a few hours" bug.
 */

import { cookies } from 'next/headers'

/**
 * Lifetime of the `gh_token_*` cookie holding the GitHub OAuth provider_token.
 *
 * **Value:** 30 days (matches Supabase `refresh_token` default TTL).
 *
 * **Why 30 days, not "forever"?**
 * - Supabase refresh_token also expires at ~30 days, so any longer TTL is wasted —
 *   the user must re-auth Supabase first, which re-issues the provider_token anyway.
 * - The GitHub OAuth App is configured with "Token expiration: OFF" (non-expiring
 *   tokens). The 30-day client-side cookie is our trust horizon, not GitHub's.
 *
 * **Security tradeoff (cookie theft replay window):**
 * - Cookie carries a token with `repo` scope (read/write private repos).
 * - Mitigations in place:
 *   - `httpOnly: true` — JavaScript cannot read the cookie (XSS resistant).
 *   - `secure: production` — only sent over HTTPS in prod.
 *   - `sameSite: 'lax'` — not sent on cross-site subrequests.
 *   - A GitHub 401 deletes the cookie name that request sent. A refresh writes
 *     the new token under the next generation name, so that deletion leaves it.
 *   - Silent re-auth via `/api/auth/github/refresh` is rate-limited per IP.
 * - The browser keeps the cookie for 30 days, the same horizon as the
 *   Supabase refresh token. A copied token still works until it is revoked:
 *   the OAuth app leaves token expiration off, so a shorter cookie would not
 *   expire it.
 *
 * The `repo` scope stays as well. The catalog only reads repositories, and
 * classic OAuth has no read-only scope that includes private ones.
 * `public_repo` would hide them.
 */
export const GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/**
 * Get environment-specific GitHub token cookie name
 *
 * Uses Supabase project ID (first 8 chars) to differentiate between environments.
 * This prevents cookie conflicts when switching between local/prod on localhost.
 *
 * @returns Cookie name like "gh_token_zfcwvzaz" (prod), or "gh_token_default"
 * when the URL is not a hosted project's (the local Supabase)
 * @example
 * // Prod: https://zfcwvzazzzsefbkztsyp.supabase.co
 * getGitHubTokenCookieName() // => "gh_token_zfcwvzaz"
 *
 * // Local: http://127.0.0.1:54321
 * getGitHubTokenCookieName() // => "gh_token_default"
 */
export function getGitHubTokenCookieName(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  // Extract project ID from URL: https://PROJECT_ID.supabase.co
  const match = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)
  const projectId = match?.[1]?.slice(0, 8) || 'default'
  return `gh_token_${projectId}`
}

interface GitHubTokenCookie {
  name: string
  value: string
  generation: number
}

interface GitHubTokenCookieReader {
  get?: (name: string) => { value: string } | undefined
  getAll?: () => { name: string; value: string }[]
}

/**
 * Options shared by every generation of the provider-token cookie.
 *
 * @returns The httpOnly cookie attributes, including the 30-day max age.
 */
function gitHubTokenCookieOptions(): {
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
    maxAge: GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  }
}

/**
 * Tells which generation a cookie name belongs to.
 *
 * Generation 0 is the unsuffixed name from {@link getGitHubTokenCookieName}.
 * A refresh writes generation 1, 2, … as a suffix. A name from outside this
 * scheme is refused, so a 401 cannot delete some other cookie.
 *
 * @param name - Cookie name from the request that sent the token.
 * @returns The generation, or null when the name is not a provider-token cookie.
 * @example
 * gitHubTokenCookieGeneration('gh_token_zfcwvzaz') // => 0
 * gitHubTokenCookieGeneration('gh_token_zfcwvzaz_2') // => 2
 */
export function gitHubTokenCookieGeneration(name: string): number | null {
  const base = getGitHubTokenCookieName()
  if (name === base) return 0
  const prefix = `${base}_`
  if (!name.startsWith(prefix)) return null
  const suffix = name.slice(prefix.length)
  // `_0` is not a generation: generation 0 has no suffix.
  if (!/^[1-9]\d*$/.test(suffix)) return null
  const generation = Number(suffix)
  return Number.isSafeInteger(generation) ? generation : null
}

/**
 * Cookie name for one generation of the provider token.
 *
 * @param generation - 0 for the original name, then 1, 2, … after each refresh.
 * @returns The cookie name that generation is stored under.
 * @example
 * gitHubTokenCookieNameForGeneration(0) // => 'gh_token_zfcwvzaz'
 * gitHubTokenCookieNameForGeneration(1) // => 'gh_token_zfcwvzaz_1'
 */
function gitHubTokenCookieNameForGeneration(generation: number): string {
  const base = getGitHubTokenCookieName()
  return generation === 0 ? base : `${base}_${generation}`
}

/**
 * Lists the provider-token cookies on this request.
 *
 * `cookies()` only knows the Cookie header this request arrived with, plus
 * writes this same request has made. A generation stored by another response
 * is absent here, which is what keeps a late 401 from naming it.
 *
 * @param store - The current request's cookie store.
 * @returns Every non-empty provider-token cookie, generation 0 included.
 */
function listGitHubTokenCookies(
  store: GitHubTokenCookieReader,
): GitHubTokenCookie[] {
  if (typeof store.getAll === 'function') {
    const found: GitHubTokenCookie[] = []
    for (const cookie of store.getAll()) {
      const generation = gitHubTokenCookieGeneration(cookie.name)
      if (generation === null || cookie.value.length === 0) continue
      found.push({ name: cookie.name, value: cookie.value, generation })
    }
    return found
  }

  // Unit tests stub `get` for the original cookie and omit `getAll`.
  if (typeof store.get !== 'function') return []
  const legacy = store.get(getGitHubTokenCookieName())
  if (!legacy?.value) return []
  return [
    {
      name: getGitHubTokenCookieName(),
      value: legacy.value,
      generation: 0,
    },
  ]
}

/**
 * Reads the newest provider token this request was given.
 *
 * Called by {@link getGitHubToken} before a GitHub request is sent, and by
 * the 401 fallback that still has to find which cookie held the rejected
 * bearer. A newer generation written by another response is not visible here.
 *
 * @returns The highest generation on this request, or null when none is set.
 * @example
 * const stored = await readGitHubTokenCookie()
 * stored?.value // => 'gho_…'
 */
export async function readGitHubTokenCookie(): Promise<{
  name: string
  value: string
} | null> {
  const cookieStore = await cookies()
  const existing = listGitHubTokenCookies(cookieStore)
  let current: GitHubTokenCookie | null = null
  for (const cookie of existing) {
    if (!current || cookie.generation > current.generation) current = cookie
  }
  if (!current) return null
  return { name: current.name, value: current.value }
}

/**
 * Finds the cookie name that holds one exact token value.
 *
 * The 401 interceptor uses this when the failed request did not record the
 * name it sent. The match is the name to delete, so a newer generation with
 * a different value stays.
 *
 * @param token - Bearer token GitHub rejected.
 * @returns That cookie's name, or null when this request does not hold it.
 * @example
 * const name = await findGitHubTokenCookieName('gho_old')
 */
export async function findGitHubTokenCookieName(
  token: string,
): Promise<string | null> {
  const cookieStore = await cookies()
  const match = listGitHubTokenCookies(cookieStore).find(
    (cookie) => cookie.value === token,
  )
  return match?.name ?? null
}

/**
 * Persist the GitHub OAuth provider_token in an httpOnly cookie.
 *
 * Called on:
 * - Initial OAuth callback (`src/app/auth/callback/route.ts`)
 * - Silent re-auth callback (same callback, post `/api/auth/github/refresh`)
 *
 * The first token uses the base name. Each later write uses the next
 * generation (`_1`, `_2`, …) and retires the names this request can see.
 * A 401 from a request that started earlier deletes the old name only, so
 * the browser keeps this token whichever response arrives last.
 *
 * @param token - GitHub provider_token from `data.session.provider_token`
 * @example
 * await setGitHubTokenCookie(providerToken)
 */
export async function setGitHubTokenCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  const existing = listGitHubTokenCookies(cookieStore)
  const nextGeneration =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((cookie) => cookie.generation)) + 1
  const name = gitHubTokenCookieNameForGeneration(nextGeneration)

  // Retire the generations this request can see in the same response.
  for (const cookie of existing) {
    if (cookie.name !== name) cookieStore.delete(cookie.name)
  }
  cookieStore.set(name, token, gitHubTokenCookieOptions())
}

/**
 * Remove every provider-token generation on this request.
 *
 * Called on:
 * - Sign out (`src/lib/actions/auth.ts`)
 * - Account deletion (`src/lib/actions/auth.ts`)
 * - A GitHub 401 whose request can see only the rejected generation
 *   (`src/lib/actions/github.ts`)
 *
 * A generation stored by a response this request cannot see is left in the
 * browser, because this deletion never names it.
 *
 * @example
 * await deleteGitHubTokenCookie()
 */
export async function deleteGitHubTokenCookie(): Promise<void> {
  const cookieStore = await cookies()
  const existing = listGitHubTokenCookies(cookieStore)
  if (existing.length === 0) {
    cookieStore.delete(getGitHubTokenCookieName())
    return
  }
  for (const cookie of existing) {
    cookieStore.delete(cookie.name)
  }
}

/**
 * Deletes the one cookie a rejected GitHub request sent.
 *
 * Called from the axios 401 interceptor with the name captured when that
 * request attached its bearer. {@link setGitHubTokenCookie} stores a refresh
 * under the next generation, so this Set-Cookie cannot remove it, including
 * when the browser applies this response afterwards.
 *
 * @param name - Cookie name captured when the request was sent.
 * @returns Whether `name` is a provider-token cookie and a deletion was issued.
 * @example
 * await deleteRejectedGitHubTokenCookie('gh_token_zfcwvzaz')
 */
export async function deleteRejectedGitHubTokenCookie(
  name: string,
): Promise<boolean> {
  if (gitHubTokenCookieGeneration(name) === null) return false
  const cookieStore = await cookies()
  cookieStore.delete(name)
  return true
}
