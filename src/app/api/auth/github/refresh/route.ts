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
import { sanitizeNextPath } from '@/lib/utils/sanitize-next'

const log = createModuleLogger('github-token-refresh')

/**
 * Maximum allowed `attempt` value before giving up.
 *
 * The client increments `attempt` each time it triggers a silent refresh.
 * On `attempt=2` (the second visit), this route fails to `/login` so the
 * user does not get stuck in a redirect loop when OAuth keeps failing to
 * land a usable provider token.
 *
 * One retry covers transient cookie write issues; a second visit means the
 * underlying issue is persistent (e.g., GitHub OAuth grant revoked) and
 * deserves a hard error instead of another silent attempt.
 */
const MAX_REFRESH_ATTEMPTS = 1

/**
 * Handle silent GitHub token refresh.
 *
 * @param request - The inbound `Request`. Read for `x-forwarded-for` (IP for
 *   rate limiting) and the URL search params (`next`, `attempt`).
 * @returns A 302 `NextResponse.redirect`. Possible destinations:
 *   - GitHub OAuth URL (happy path)
 *   - `/login?next=<safe path>` when there is no Supabase session
 *   - `/login?error=token_refresh_failed` when the attempt cap is exceeded
 *   - `/login?error=oauth_failed&...` when `signInWithOAuth` errors
 *   - `/login?error=rate_limited&...` when the per-IP limit is exceeded
 *   - `/login?error=unexpected_error` for unhandled exceptions
 *
 * @example
 *   // GET /api/auth/github/refresh?next=/board/abc → 302 to GitHub OAuth
 *   // GET /api/auth/github/refresh?next=//evil.com → next coerced to /boards
 *   // GET /api/auth/github/refresh?attempt=2 → 302 /login?error=token_refresh_failed
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  // Sanitize `next` — only allow safe relative paths.
  // Shared with src/app/auth/callback/route.ts via sanitizeNextPath.
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
  // sign-in.
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim()
  if (!forwarded) {
    log.warn('x-forwarded-for header missing — falling back to 127.0.0.1')
  }
  const clientIp = forwarded || '127.0.0.1'
  const rateLimitResult = checkRateLimit('signInWithGitHub', clientIp)
  if (!rateLimitResult.allowed) {
    log.warn({ ip: clientIp }, 'Refresh rate limit exceeded')
    return NextResponse.redirect(
      `${origin}/login?error=rate_limited&message=${encodeURIComponent(rateLimitResult.error!)}`,
    )
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
      return NextResponse.redirect(
        `${origin}/login?error=oauth_failed&message=${encodeURIComponent(oauthError.message)}`,
      )
    }

    if (!data.url) {
      log.error('OAuth refresh: no redirect URL returned')
      Sentry.captureMessage(
        'GitHub OAuth refresh: No redirect URL returned',
        'error',
      )
      return NextResponse.redirect(
        `${origin}/login?error=oauth_failed&message=No%20redirect%20URL%20returned`,
      )
    }

    // The path 'silent_token_refresh' identifies this login_success entry as
    // a silent re-auth (vs. initial OAuth in /auth/callback) for audit trails.
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
    return NextResponse.redirect(`${origin}/login?error=unexpected_error`)
  }
}
