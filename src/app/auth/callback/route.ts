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

import { createFirstBoardIfNeeded } from '@/lib/actions/board'
import { setGitHubTokenCookie } from '@/lib/constants/cookies'
import { createModuleLogger } from '@/lib/logger'
import { logSecurityEvent } from '@/lib/security-events'
import { createRouteHandlerClient } from '@/lib/supabase/server'
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
        await createFirstBoardIfNeeded(data.session.user.id)
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
