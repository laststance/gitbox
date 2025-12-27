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

import { isTestMode } from '@/tests/isTestMode'

// Public paths that don't require authentication
const publicPaths = ['/', '/login', '/auth/callback']

export async function proxy(request: NextRequest) {
  // In E2E test mode, bypass authentication and allow all requests
  if (isTestMode()) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
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

  // IMPORTANT: Use getUser() not getSession() for proper session refresh
  // This also handles PKCE token exchange correctly
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check path
  const { pathname } = request.nextUrl

  // Allow public paths without authentication
  if (publicPaths.includes(pathname)) {
    return supabaseResponse
  }

  // Redirect to login if not authenticated
  if (!user) {
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
