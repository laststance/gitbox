/**
 * Next.js 16 Proxy
 *
 * Authentication check
 * - Supabase session validation
 * - Protected route authentication
 *
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
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
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client with cookie operations
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    },
  )

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Check path
  const { pathname } = request.nextUrl

  // Allow public paths without authentication
  if (publicPaths.includes(pathname)) {
    return response
  }

  // Redirect to login if not authenticated
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return response
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
