/**
 * OAuth Callback Handler
 *
 * Processes GitHub OAuth authentication callback
 * - Obtains authentication code and establishes session
 * - Saves provider_token in secure cookie (for GitHub API access)
 * - Error handling
 * - Redirects to Boards screen
 */

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// Cookie name
const GITHUB_TOKEN_COOKIE = 'github_provider_token'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/boards' // Redirect to Boards screen after login

  if (code) {
    const supabase = await createClient()

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
        cookieStore.set(GITHUB_TOKEN_COOKIE, providerToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days (adjust to match GitHub token expiration)
          path: '/',
        })
        console.log('GitHub provider_token saved to cookie')
      } else {
        console.warn(
          'No provider_token in session - GitHub API access may be limited',
        )
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
