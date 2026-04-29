/**
 * GitHub Token Refresh Endpoint
 *
 * Silent re-authentication when the GitHub `provider_token` cookie is missing
 * but the Supabase session is still valid. This happens when a user returns
 * after the GitHub provider token (8h–30d) has expired or the cookie was
 * cleared, while Supabase's longer-lived refresh token (~30d) is still alive.
 *
 * Flow:
 *  1. A Server Action returns `errorCode: 'GITHUB_TOKEN_MISSING'` (see
 *     `src/lib/actions/types.ts`).
 *  2. The client hook in `src/lib/utils/handle-github-token-missing.ts`
 *     redirects the browser to `/api/auth/github/refresh?next=<current path>`.
 *  3. This route checks the Supabase session, then re-initiates GitHub OAuth.
 *  4. After GitHub OAuth, `/auth/callback` exchanges the code, sets a fresh
 *     `provider_token` cookie via `setGitHubTokenCookie`, and redirects to
 *     `<next>`.
 *
 * Defenses:
 *  - Open-redirect prevention on `next` (mirrors `/auth/callback`)
 *  - Attempt cap to break infinite redirect loops if OAuth keeps failing
 *  - Rate limit by IP (reuses the `signInWithGitHub` bucket)
 *  - Supabase session check: refresh requires existing login
 *
 * @example
 *   // From a client hook
 *   window.location.href =
 *     `/api/auth/github/refresh?next=${encodeURIComponent('/board/123')}`
 */

import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

import { createModuleLogger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit/check'
import { logSecurityEvent } from '@/lib/security-events'
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { getForwardedClientIp } from '@/lib/utils/get-client-ip'
import { sanitizeNextPath } from '@/lib/utils/sanitize-next'

const log = createModuleLogger('github-token-refresh')

/**
 * Cap on silent refresh retries before forcing a hard `/login`. One retry
 * covers transient cookie write failures; persistent failures (e.g., revoked
 * OAuth grant) should surface to the user instead of looping.
 */
const MAX_REFRESH_ATTEMPTS = 1

/**
 * Route handler for `GET /api/auth/github/refresh`.
 *
 * Performs the silent re-authentication flow described in the file-level
 * docblock above: enforces an attempt cap, applies per-IP rate limiting,
 * verifies the Supabase session is still alive, then re-initiates GitHub
 * OAuth and 302-redirects the browser to GitHub. On any failure the user
 * lands on `/login?error=<code>` with a stable error code (no raw error
 * messages are reflected into the URL).
 *
 * @param request - Incoming `Request` from Next.js. Read query params
 *   (`next`, `attempt`) and the `x-real-ip` / `x-forwarded-for` headers.
 * @returns A `NextResponse` redirect — either to GitHub's OAuth URL on
 *   success, or to `/login?error=<code>` on failure (`token_refresh_failed`,
 *   `rate_limited`, `oauth_failed`, `unexpected_error`).
 *
 * @example
 *   // Client-side trigger
 *   window.location.href =
 *     `/api/auth/github/refresh?next=${encodeURIComponent('/board/abc')}`
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const next = sanitizeNextPath(searchParams.get('next'), '/boards')

  // Bail if the attempt count exceeds the cap (prevents infinite loops).
  const rawAttempt = Number.parseInt(searchParams.get('attempt') ?? '1', 10)
  const attempt =
    Number.isFinite(rawAttempt) && rawAttempt >= 1 ? rawAttempt : 1

  if (attempt > MAX_REFRESH_ATTEMPTS) {
    log.warn({ attempt, next }, 'Silent refresh attempt cap exceeded')
    logSecurityEvent('login_failure', {
      error: 'refresh_attempt_cap_exceeded',
    })
    return NextResponse.redirect(`${origin}/login?error=token_refresh_failed`)
  }

  // Rate limit by IP. Reuses the `signInWithGitHub` bucket since each refresh
  // triggers a full GitHub OAuth round-trip — same upstream cost as a fresh
  // sign-in. Prefer `x-real-ip` (Vercel sets it to the trusted edge IP) over
  // the first hop of `x-forwarded-for`, which is client-controllable when the
  // proxy *appends* rather than replaces the header (Vercel's behavior).
  const realIp = request.headers.get('x-real-ip')?.trim()
  const forwarded = getForwardedClientIp(request.headers)
  const clientIp = realIp || forwarded || '127.0.0.1'
  if (!realIp && !forwarded) {
    log.warn('No trusted client IP header found — falling back to 127.0.0.1')
  }
  const rateLimitResult = checkRateLimit('signInWithGitHub', clientIp)
  if (!rateLimitResult.allowed) {
    log.warn(
      { ip: clientIp, error: rateLimitResult.error },
      'Refresh rate limit exceeded',
    )
    return NextResponse.redirect(`${origin}/login?error=rate_limited`)
  }

  const supabase = await createRouteHandlerClient(request)

  try {
    // The Supabase session must still be valid. If the user logged out, the
    // session expired, or cookies were cleared, refresh is meaningless —
    // bounce them to /login with `next` preserved so they end up where they
    // intended after a fresh sign-in.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      log.info({ next }, 'No Supabase session — redirecting to login')
      logSecurityEvent('login_failure', {
        error: 'no_session',
        path: 'silent_token_refresh',
      })
      return NextResponse.redirect(
        `${origin}/login?next=${encodeURIComponent(next)}`,
      )
    }

    // Re-initiate GitHub OAuth. The PKCE `code_verifier` cookie is set by
    // the Supabase route-handler client via the cookies() adapter, and Next
    // propagates the cookie mutation onto the redirect response automatically.
    // /auth/callback then reads `next` from the query string and lands the
    // user back on the original page once the new token cookie is in place.
    const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(next)}`

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: callbackUrl,
        scopes: 'read:user user:email repo',
      },
    })

    if (oauthError) {
      log.error({ error: oauthError.message }, 'OAuth refresh failed')
      Sentry.captureException(oauthError, {
        extra: { context: 'GitHub token refresh' },
      })
      logSecurityEvent('login_failure', {
        error: oauthError.message,
        path: 'silent_token_refresh',
      })
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    if (!data.url) {
      log.error('OAuth refresh: no redirect URL returned')
      Sentry.captureMessage(
        'GitHub OAuth refresh: No redirect URL returned',
        'error',
      )
      logSecurityEvent('login_failure', {
        error: 'no_redirect_url',
        path: 'silent_token_refresh',
      })
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    logSecurityEvent('login_success', {
      userId: user.id,
      path: 'silent_token_refresh',
    })
    return NextResponse.redirect(data.url)
  } catch (unexpectedError) {
    log.error({ error: unexpectedError }, 'Unexpected error in token refresh')
    Sentry.captureException(unexpectedError, {
      extra: { context: 'GitHub token refresh' },
    })
    logSecurityEvent('login_failure', {
      error:
        unexpectedError instanceof Error
          ? unexpectedError.message
          : 'unexpected_error',
      path: 'silent_token_refresh',
    })
    return NextResponse.redirect(`${origin}/login?error=unexpected_error`)
  }
}
