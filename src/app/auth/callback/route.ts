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
import { LOGIN_ERROR } from '@/lib/constants/login-errors'
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
  const publicOrigin = callbackOrigin(request, origin)
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
        if (isPkceVerifierMismatch(error)) {
          return await restartSignInAfterVerifierMismatch({
            supabase,
            origin: publicOrigin,
            next,
            alreadyRetried: searchParams.get('pkce_retry') === '1',
            clientIp: clientIpForRestart(request),
          })
        }
        logSecurityEvent('login_failure', { error: error.message })
        return NextResponse.redirect(
          `${origin}/login?error=${LOGIN_ERROR.authFailed}`,
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
      return NextResponse.redirect(`${publicOrigin}${next}`)
    } catch (error) {
      log.error({ error }, 'Unexpected error in OAuth callback')
      return NextResponse.redirect(
        `${origin}/login?error=${LOGIN_ERROR.unexpectedError}`,
      )
    }
  }

  // Redirect to login page if code parameter is missing
  return NextResponse.redirect(
    `${origin}/login?error=${LOGIN_ERROR.missingCode}`,
  )
}

/**
 * Origin Supabase will accept as the OAuth callback.
 *
 * On Vercel the request URL can be an internal host. The public host is
 * `x-forwarded-host`, which the success redirect already used. The restarted
 * sign-in has to use it too, or Supabase rejects `redirectTo`.
 *
 * @param request - The callback request.
 * @param origin - `request.url`'s origin.
 * @returns The public origin in production, otherwise `origin`.
 */
/**
 * Address the restart's rate limit is counted against.
 *
 * Prefers `x-real-ip`, which Vercel sets. A missing address is an empty
 * string: {@link checkRateLimit} then skips the check. `127.0.0.1` would
 * put every such request in one bucket.
 *
 * @param request - The callback request.
 * @returns A client address, or `''` when none was provided.
 */
function clientIpForRestart(request: Request): string {
  const realIp = request.headers.get('x-real-ip')?.trim()
  return realIp || getForwardedClientIp(request.headers) || ''
}

function callbackOrigin(request: Request, origin: string): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'
  // Local dev has no public host in front of the request URL.
  if (!isLocalEnv && forwardedHost) return `https://${forwardedHost}`
  return origin
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
  logSecurityEvent('login_failure', {
    error: 'pkce_verifier_mismatch',
    retried: alreadyRetried,
  })
  // One restart is enough. A second mismatch is a real failure.
  if (alreadyRetried) {
    return NextResponse.redirect(
      `${origin}/login?error=${LOGIN_ERROR.authFailed}`,
    )
  }

  const rateLimitResult = checkRateLimit('signInWithGitHub', clientIp)
  if (!rateLimitResult.allowed) {
    // The sentence stays in the log. The login URL keeps the stable code.
    log.warn({ error: rateLimitResult.error }, 'OAuth retry rate limited')
    return NextResponse.redirect(
      `${origin}/login?error=${LOGIN_ERROR.rateLimited}`,
    )
  }

  const callbackUrl = `${origin}/auth/callback?pkce_retry=1&next=${encodeURIComponent(next)}`
  try {
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: callbackUrl,
        scopes: GITHUB_SIGN_IN_SCOPES,
        // The route returns the redirect. The client must not navigate itself.
        skipBrowserRedirect: true,
      },
    })
    if (oauthError || !data.url) {
      log.error({ error: oauthError }, 'OAuth retry failed')
      return NextResponse.redirect(
        `${origin}/login?error=${LOGIN_ERROR.oauthFailed}`,
      )
    }
    return NextResponse.redirect(data.url)
  } catch (error) {
    // A rejected client is not the handled `error` result. Send the same login.
    log.error({ error }, 'OAuth retry exception')
    return NextResponse.redirect(
      `${origin}/login?error=${LOGIN_ERROR.oauthFailed}`,
    )
  }
}
