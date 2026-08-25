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
 * - If stolen, attacker has up to 30 days of API access on this user's GitHub.
 * - Mitigations in place:
 *   - `httpOnly: true` — JavaScript cannot read the cookie (XSS resistant).
 *   - `secure: production` — only sent over HTTPS in prod.
 *   - `sameSite: 'lax'` — not sent on cross-site subrequests.
 *   - 401 interceptor in `axios-github.ts` auto-deletes the cookie when GitHub
 *     rejects the token, shrinking the window if the token is revoked.
 *   - Silent re-auth via `/api/auth/github/refresh` is rate-limited per IP.
 * - Residual risk: full session-token theft (e.g., malicious browser extension)
 *   gives the same 30 days of access. Acceptable — same risk profile as the
 *   Supabase JWT.
 */
export const GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/**
 * Get environment-specific GitHub token cookie name
 *
 * Uses Supabase project ID (first 8 chars) to differentiate between environments.
 * This prevents cookie conflicts when switching between dev/prod on localhost.
 *
 * @returns Cookie name like "gh_token_jqtxjzdx" (dev) or "gh_token_zfcwvzaz" (prod)
 * @example
 * // Dev: https://jqtxjzdxczqwsrvevmyk.supabase.co
 * getGitHubTokenCookieName() // => "gh_token_jqtxjzdx"
 *
 * // Prod: https://zfcwvzazzzsefbkztsyp.supabase.co
 * getGitHubTokenCookieName() // => "gh_token_zfcwvzaz"
 */
export function getGitHubTokenCookieName(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  // Extract project ID from URL: https://PROJECT_ID.supabase.co
  const match = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)
  const projectId = match?.[1]?.slice(0, 8) || 'default'
  return `gh_token_${projectId}`
}

/**
 * Persist the GitHub OAuth provider_token in an httpOnly cookie.
 *
 * Called on:
 * - Initial OAuth callback (`src/app/auth/callback/route.ts`)
 * - Silent re-auth callback (same callback, post `/api/auth/github/refresh`)
 *
 * @param token - GitHub provider_token from `data.session.provider_token`
 * @example
 * await setGitHubTokenCookie(providerToken)
 */
export async function setGitHubTokenCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(getGitHubTokenCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  })
}

/**
 * Remove the GitHub OAuth provider_token cookie.
 *
 * Called on:
 * - Sign out (`src/lib/actions/auth.ts`)
 * - Account deletion (`src/lib/actions/auth.ts`)
 * - 401 response from GitHub API (`src/lib/axios-github.ts`)
 *
 * @example
 * await deleteGitHubTokenCookie()
 */
export async function deleteGitHubTokenCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(getGitHubTokenCookieName())
}
