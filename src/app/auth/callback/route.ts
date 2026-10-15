/**
 * OAuth Callback Handler
 *
 * Processes GitHub OAuth authentication callback
 * - Obtains authentication code and establishes session
 * - Saves provider_token in secure cookie (for GitHub API access)
 * - Creates "First Board" for new users (if no boards exist)
 * - Error handling
 * - Redirects to Boards screen
 */

import { NextResponse } from 'next/server'

import { createFirstBoardIfNeeded } from '@/lib/actions/board-creation'
import { setGitHubTokenCookie } from '@/lib/constants/cookies'
import { createModuleLogger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit/check'
import { logSecurityEvent } from '@/lib/security-events'
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { getForwardedClientIp } from '@/lib/utils/get-client-ip'
import { isPkceVerifierMismatch } from '@/lib/utils/is-pkce-verifier-mismatch'
import { sanitizeNextPath } from '@/lib/utils/sanitize-next'

const log = createModuleLogger('auth-callback')

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Set by /api/auth/github/refresh on silent re-auth and reserved for future
  // middleware-driven "return to original page" flows on protected routes.
  const next = sanitizeNextPath(searchParams.get('next'), '/boards')

  if (code) {
    const supabase = await createRouteHandlerClient(request)

    try {
      // Establish session using authentication code
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        log.error({ error }, 'OAuth callback error')
        // Another tab replaced the code-verifier cookie. Sign in again
        // instead of showing that failure on the login page.
        if (isPkceVerifierMismatch(error.message)) {
          return restartSignInAfterVerifierMismatch({
            supabase,
            origin,
            next,
            alreadyRetried: searchParams.get('pkce_retry') === '1',
            clientIp: getForwardedClientIp(request.headers) ?? '127.0.0.1',
          })
        }
        logSecurityEvent('login_failure', { error: error.message })
        return NextResponse.redirect(
          `${origin}/login?error=auth_failed&message=${encodeURIComponent(error.message)}`,
        )
      }

      // Retrieve provider_token and save to cookie (for GitHub API access)
      const providerToken = data.session?.provider_token
      if (providerToken) {
        await setGitHubTokenCookie(providerToken)
      } else {
        log.warn(
          'No provider_token in session - GitHub API access may be limited',
        )
      }

      // Create "First Board" for new users (idempotent - safe on every login)
      if (data.session?.user?.id) {
        logSecurityEvent('login_success', { userId: data.session.user.id })
        await createFirstBoardIfNeeded(supabase, data.session.user.id)
      }

      // Session established successfully - redirect to Boards screen.
      // In production, honor x-forwarded-host (e.g., behind Vercel proxy) so the
      // redirect targets the public host rather than the internal origin.
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      const base =
        !isLocalEnv && forwardedHost ? `https://${forwardedHost}` : origin
      return NextResponse.redirect(`${base}${next}`)
    } catch (error) {
      log.error({ error }, 'Unexpected error in OAuth callback')
      return NextResponse.redirect(`${origin}/login?error=unexpected_error`)
    }
  }

  // Redirect to login page if code parameter is missing
  return NextResponse.redirect(`${origin}/login?error=missing_code`)
}

/** Scopes the restarted sign-in asks for, matching a normal GitHub sign-in. */
const GITHUB_SIGN_IN_SCOPES = 'read:user user:email repo'

/**
 * Starts GitHub sign-in again after another tab replaced the verifier.
 *
 * The first mismatch redirects to GitHub with `pkce_retry=1` on the
 * callback, so a second mismatch stops instead of looping. The login
 * page then gets a stable error code and not the verifier text.
 *
 * Called by {@link GET} when {@link isPkceVerifierMismatch} matches.
 *
 * @param supabase - The route client, which writes the new verifier cookie.
 * @param origin - Origin of this callback request.
 * @param next - Sanitized path to open after the restarted sign-in.
 * @param alreadyRetried - The callback URL already carries `pkce_retry=1`.
 * @param clientIp - Address the sign-in rate limit is counted against.
 * @returns A redirect to GitHub, or to `/login` when the retry is used up.
 */
async function restartSignInAfterVerifierMismatch({
  supabase,
  origin,
  next,
  alreadyRetried,
  clientIp,
}: {
  supabase: Awaited<ReturnType<typeof createRouteHandlerClient>>
  origin: string
  next: string
  alreadyRetried: boolean
  clientIp: string
}): Promise<NextResponse> {
  logSecurityEvent('login_failure', { error: 'pkce_verifier_mismatch' })
  // One restart is enough. A second mismatch is a real failure.
  if (alreadyRetried) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const rateLimitResult = checkRateLimit('signInWithGitHub', clientIp)
  if (!rateLimitResult.allowed) {
    return NextResponse.redirect(`${origin}/login?error=rate_limited`)
  }

  const callbackUrl = `${origin}/auth/callback?pkce_retry=1&next=${encodeURIComponent(next)}`
  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: callbackUrl,
      scopes: GITHUB_SIGN_IN_SCOPES,
    },
  })
  if (oauthError || !data.url) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
  }
  return NextResponse.redirect(data.url)
}
