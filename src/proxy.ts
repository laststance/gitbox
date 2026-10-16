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

import { SENTRY_TUNNEL_ROUTE } from '@/lib/constants/routes'
import {
  SENTRY_ENVELOPE_URL,
  SENTRY_TUNNEL_MAX_BODY_BYTES,
} from '@/lib/constants/sentry'
import { RATE_LIMIT_CONFIG } from '@/lib/rate-limit/config'
import { edgeRateLimit, getClientIp } from '@/lib/rate-limit/edge-memory'
import { logSecurityEvent } from '@/lib/security-events'
import {
  isSpentRefreshLogin,
  REFRESH_ATTEMPT_COOKIE,
  refreshAttemptCookieOptions,
} from '@/lib/utils/refresh-attempt-cookie'
import { isTestMode } from '@/tests/isTestMode'

// Public paths that don't require authentication
export const publicPaths = [
  '/',
  '/login',
  '/auth/callback',
  '/privacy',
  '/terms',
]

/**
 * Files the browser and link-preview crawlers fetch without a session: the
 * PWA manifest (the static file and the generated route) and the generated
 * social and touch images. They hold no user data. Behind the login redirect
 * the app cannot be installed and a shared link shows no preview.
 */
const sessionlessMetadataPaths = [
  '/manifest.json',
  '/manifest.webmanifest',
  '/opengraph-image',
  '/twitter-image',
  '/apple-icon',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Sentry tunnel: the browser SDK posts error reports to this path so ad
  // blockers do not drop them. Signed-out pages report errors too, so this
  // comes before the sign-in check.
  if (isSentryTunnelPath(pathname)) {
    return forwardSentryReport(request)
  }

  // In E2E test mode, bypass authentication and allow all requests
  if (isTestMode()) {
    return dropSpentRefreshAttempt(
      request,
      NextResponse.next({
        request: {
          headers: request.headers,
        },
      }),
    )
  }

  // The manifest and the preview images are the same for everyone
  if (sessionlessMetadataPaths.includes(pathname)) {
    return NextResponse.next()
  }

  // Rate limit OAuth callback by IP
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
    typeof claims.exp === 'number' &&
    nowInSeconds <= claims.exp

  // Allow public paths without authentication
  if (publicPaths.includes(pathname)) {
    return dropSpentRefreshAttempt(request, supabaseResponse)
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

/**
 * Deletes the silent-refresh count on the login page the cap redirects to.
 *
 * The refresh route leaves the count set so a second visit is refused.
 * This page is where that visit ends, and the sessionStorage counter is
 * cleared here too. Leaving the cookie would refuse the next sign-in's
 * first refresh. Called by {@link proxy} for the responses that render
 * `/login`.
 *
 * @param request - Incoming request.
 * @param response - Response already chosen for this request.
 * @returns The same response, with the attempt cookie expired when this is the cap's login page.
 * @example
 * dropSpentRefreshAttempt(request, NextResponse.next())
 */
function dropSpentRefreshAttempt(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (
    !isSpentRefreshLogin(
      request.nextUrl.pathname,
      request.nextUrl.searchParams.get('error'),
    )
  ) {
    return response
  }

  // Same path and site as the cookie the refresh route set, so the browser drops that one.
  response.cookies.set(REFRESH_ATTEMPT_COOKIE, '', {
    ...refreshAttemptCookieOptions(),
    maxAge: 0,
  })
  return response
}

/**
 * Tells whether a request is for the Sentry tunnel. Exists because the
 * `tunnelRoute` option in next.config.ts also adds a rewrite of its own, which
 * takes its destination from the query string, forwards cookies, and matches
 * the path in any letter case with trailing slashes. A tunnel request this
 * check missed would fall through to that rewrite, so the check has to be at
 * least as wide. Called by {@link proxy} for every request.
 *
 * @param pathname - Path of the incoming request, without the query string.
 * @returns
 * - `true` for the tunnel route in any letter case, with or without trailing slashes
 * - `false` for every other path, including ones that only start with it
 * @example
 * isSentryTunnelPath('/monitoring')   // => true
 * isSentryTunnelPath('/Monitoring//') // => true
 * isSentryTunnelPath('/monitoring/x') // => false
 */
const isSentryTunnelPath = (pathname: string): boolean =>
  pathname.toLowerCase().replace(/\/+$/, '') === SENTRY_TUNNEL_ROUTE

/**
 * Forwards a browser error report to this app's own Sentry project. Exists so
 * the tunnel works for signed-out pages and cannot be used to reach anything
 * else: the destination is the constant {@link SENTRY_ENVELOPE_URL}, so
 * nothing in the request can choose it, the `o`, `p` and `r` the SDK writes
 * into the query string included. Called by {@link proxy} for every request
 * on the tunnel path.
 *
 * The Cookie header stays behind: the session cookies are not Sentry's to
 * see, and their size makes the ingest host answer 400.
 *
 * The route answers without a session, so it limits what one client can send
 * through it: a number of reports per minute, and the size a report declares.
 * The count lives in this instance's memory, so with several instances a
 * client gets that number through each of them. The proxy never reads the
 * body, so a report sent without `Content-Length` is counted but not measured.
 *
 * @param request - A request whose path is the Sentry tunnel route.
 * @returns
 * - A rewrite to {@link SENTRY_ENVELOPE_URL}, without the Cookie header, for a `POST`
 * - `404` for every other method
 * - `429` with `Retry-After` once the client address is over its limit for the minute
 * - `413` when `Content-Length` is above {@link SENTRY_TUNNEL_MAX_BODY_BYTES}
 * @example
 * // POST /monitoring?o=1245861&p=4510597804261376&r=us => this app's Sentry project
 * // POST /monitoring?o=999&p=999&r=de                  => this app's Sentry project
 * // GET  /monitoring?o=1245861&p=4510597804261376&r=us => 404
 * // 121st POST of the minute from one address          => 429
 * // POST with Content-Length: 20971521                 => 413
 */
const forwardSentryReport = (request: NextRequest): NextResponse => {
  // The SDK only ever posts; no other method has a reason to be forwarded
  if (request.method !== 'POST') {
    return new NextResponse(null, { status: 404 })
  }

  // Counted under a key of its own: under the bare address, reports would use
  // up the sign-in callback's limit. A refusal is not logged as a security
  // event, which would itself be one Sentry event per refused report.
  const { maxRequests, windowMs } = RATE_LIMIT_CONFIG.sentryTunnel
  const tunnelRateLimitKey = `sentry-tunnel:${getClientIp(request)}`
  if (!edgeRateLimit(tunnelRateLimitKey, maxRequests, windowMs)) {
    // The SDK reads Retry-After and sends nothing for that many seconds
    return new NextResponse(null, {
      status: 429,
      headers: { 'Retry-After': String(windowMs / 1000) },
    })
  }

  // A missing or unreadable Content-Length becomes 0 or NaN and passes
  const declaredBodyBytes = Number(request.headers.get('content-length'))
  if (declaredBodyBytes > SENTRY_TUNNEL_MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 })
  }

  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.delete('cookie')
  return NextResponse.rewrite(SENTRY_ENVELOPE_URL, {
    request: { headers: forwardedHeaders },
  })
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
