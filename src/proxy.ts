/**
 * Next.js 16 Proxy
 *
 * Authentication check
 * - Supabase session validation
 * - Protected route authentication
 *
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { RATE_LIMIT_CONFIG } from '@/lib/rate-limit/config'
import { edgeRateLimit, getClientIp } from '@/lib/rate-limit/edge-memory'
import { logSecurityEvent } from '@/lib/security-events'
import { isTestMode } from '@/tests/isTestMode'

// Public paths that don't require authentication
export const publicPaths = [
  '/',
  '/login',
  '/auth/callback',
  '/privacy',
  '/terms',
]

export async function proxy(request: NextRequest) {
  // In E2E test mode, bypass authentication and allow all requests
  if (isTestMode()) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }

  // Rate limit OAuth callback by IP
  const { pathname } = request.nextUrl
  if (pathname === '/auth/callback') {
    const ip = getClientIp(request)
    const config = RATE_LIMIT_CONFIG['auth/callback']
    if (!edgeRateLimit(ip, config.maxRequests, config.windowMs)) {
      logSecurityEvent('rate_limited', { ip, path: pathname })
      return new NextResponse(
        'Too many authentication attempts. Please try again later.',
        { status: 429, headers: { 'Retry-After': '60' } },
      )
    }
  }

  // Create response that we'll modify with cookie updates
  let supabaseResponse = NextResponse.next({ request })

  // Create Supabase client with getAll/setAll (required for PKCE flow)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        /**
         * Get all cookies from the incoming request.
         * Required for PKCE flow to retrieve the code verifier.
         */
        getAll() {
          return request.cookies.getAll()
        },
        /**
         * Set cookies on both request (for downstream server code)
         * and response (for browser).
         * This is critical for PKCE flow cookie persistence.
         */
        setAll(cookiesToSet) {
          // Set on request for downstream server code
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          // Create new response with the updated request
          supabaseResponse = NextResponse.next({ request })
          // Set on response for browser
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Use getClaims() over getUser() to validate identity locally via JWKS
  // (~5ms WebCrypto verify) instead of round-tripping to the Auth server
  // (~300ms). The SDK rejects expired tokens by default; a manual exp guard
  // below catches clock skew and any edge case where SDK validation is
  // bypassed. PKCE refresh still fires through the cookie setAll plumbing
  // when the access token is near expiry.
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()
  const claims = claimsData?.claims
  const nowInSeconds = Math.floor(Date.now() / 1000)
  const hasValidClaims =
    !claimsError &&
    !!claims &&
    (typeof claims.exp !== 'number' || nowInSeconds <= claims.exp)

  // Allow public paths without authentication
  if (publicPaths.includes(pathname)) {
    return supabaseResponse
  }

  // Redirect to login if not authenticated
  if (!hasValidClaims) {
    logSecurityEvent('unauthorized_access', { path: pathname })
    const loginUrl = new URL('/login', request.url)
    // Copy cookies to redirect response
    const redirectResponse = NextResponse.redirect(loginUrl)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next (all Next.js internal routes including static, image, HMR)
     * - api (API routes)
     * - favicon.ico (favicon file)
     * - public files (robots.txt, etc.)
     * - static assets
     */
    '/((?!_next|api|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
