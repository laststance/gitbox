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

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { createFirstBoardIfNeeded } from '@/lib/actions/board'
import { getGitHubTokenCookieName } from '@/lib/constants/cookies'
import { createRouteHandlerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  /**
   * Post-authentication redirect destination.
   *
   * The `next` query parameter allows redirecting users back to their original
   * destination after successful authentication. This enables a "return to
   * original page" flow for protected routes.
   *
   * @example Intended usage flow (not yet implemented in middleware):
   * 1. User visits /board/123 (unauthenticated)
   * 2. Middleware redirects to /login?next=/board/123
   * 3. Login page initiates OAuth with redirectTo: /auth/callback?next=/board/123
   * 4. After successful auth, user is redirected to /board/123
   *
   * @default '/boards' - If `next` is not provided, redirects to the main boards page
   * @note Currently, no code sets this parameter; it exists for future extensibility
   */
  const next = searchParams.get('next') ?? '/boards'

  if (code) {
    const supabase = await createRouteHandlerClient(request)

    try {
      // Establish session using authentication code
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('OAuth callback error:', error)
        return NextResponse.redirect(
          `${origin}/login?error=auth_failed&message=${encodeURIComponent(error.message)}`,
        )
      }

      // Retrieve provider_token and save to cookie (for GitHub API access)
      const providerToken = data.session?.provider_token
      if (providerToken) {
        const cookieStore = await cookies()
        const cookieName = getGitHubTokenCookieName()
        cookieStore.set(cookieName, providerToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days (adjust to match GitHub token expiration)
          path: '/',
        })
      } else {
        console.warn(
          'No provider_token in session - GitHub API access may be limited',
        )
      }

      // Create "First Board" for new users (idempotent - safe on every login)
      if (data.session?.user?.id) {
        await createFirstBoardIfNeeded(data.session.user.id)
      }

      // Session established successfully - redirect to Boards screen
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        // Redirect to localhost in local environment
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        // Use x-forwarded-host in production environment
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        // Fallback
        return NextResponse.redirect(`${origin}${next}`)
      }
    } catch (error) {
      console.error('Unexpected error in OAuth callback:', error)
      return NextResponse.redirect(`${origin}/login?error=unexpected_error`)
    }
  }

  // Redirect to login page if code parameter is missing
  return NextResponse.redirect(`${origin}/login?error=missing_code`)
}
