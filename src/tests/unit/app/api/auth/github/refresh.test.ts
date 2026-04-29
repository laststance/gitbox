/**
 * Unit Tests: /api/auth/github/refresh route handler
 *
 * Verifies the silent re-auth endpoint behaves correctly across all branches:
 *
 *  A. Open-redirect prevention (`next=//evil`, `next=\evil`, scheme-relative)
 *  B. Attempt cap exceeded (`attempt > MAX_REFRESH_ATTEMPTS`)
 *  C. Per-IP rate limit hit (reuses `signInWithGitHub` bucket)
 *  D. No Supabase session — bounce to /login with `next` preserved
 *  E. Happy path — Supabase returns OAuth URL, response is a 302 to GitHub
 *  F. signInWithOAuth error — redirect to /login?error=oauth_failed
 *  G. Missing data.url after signInWithOAuth — same /login?error=oauth_failed
 *  H. Unexpected exception — redirect to /login?error=unexpected_error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { checkRateLimit } from '@/lib/rate-limit/check'
import { logSecurityEvent } from '@/lib/security-events'
import { createRouteHandlerClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createRouteHandlerClient: vi.fn(),
}))

vi.mock('@/lib/rate-limit/check', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}))

vi.mock('@/lib/security-events', () => ({
  logSecurityEvent: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001'
const MOCK_GITHUB_OAUTH_URL =
  'https://github.com/login/oauth/authorize?client_id=test&redirect_uri=...'

/**
 * Build a Supabase auth-client mock that returns a happy-path session and a
 * fresh OAuth URL by default. Pass overrides to simulate failure modes.
 */
function buildSupabaseMock(
  overrides: {
    getUser?: () => Promise<{ data: { user: unknown }; error: unknown }>
    signInWithOAuth?: () => Promise<{ data: unknown; error: unknown }>
  } = {},
) {
  return {
    auth: {
      getUser:
        overrides.getUser ??
        (async () => ({
          data: { user: { id: MOCK_USER_ID } },
          error: null,
        })),
      signInWithOAuth:
        overrides.signInWithOAuth ??
        (async () => ({
          data: { url: MOCK_GITHUB_OAUTH_URL },
          error: null,
        })),
    },
  }
}

/**
 * Build a Request that mimics what Next.js hands the route handler.
 *
 * @param search - Query string starting with `?`
 * @param ip - Value forwarded into the `x-forwarded-for` header
 */
function buildRequest(search: string, ip: string = '203.0.113.7'): Request {
  return new Request(`http://localhost:3008/api/auth/github/refresh${search}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

describe('GET /api/auth/github/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true })
    vi.mocked(createRouteHandlerClient).mockResolvedValue(
      buildSupabaseMock() as never,
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────── Branch E: happy path
  it('redirects to GitHub OAuth URL on the happy path', async () => {
    const { GET } = await import('@/app/api/auth/github/refresh/route')

    const response = await GET(buildRequest('?next=%2Fboard%2Fabc'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(MOCK_GITHUB_OAUTH_URL)
    expect(logSecurityEvent).toHaveBeenCalledWith('login_success', {
      userId: MOCK_USER_ID,
      path: 'silent_token_refresh',
    })
  })

  it('forwards the sanitized `next` param into the callback URL handed to Supabase', async () => {
    const supabaseMock = buildSupabaseMock()
    const signInSpy = vi.spyOn(supabaseMock.auth, 'signInWithOAuth')
    vi.mocked(createRouteHandlerClient).mockResolvedValue(supabaseMock as never)
    const { GET } = await import('@/app/api/auth/github/refresh/route')

    await GET(buildRequest('?next=%2Fboard%2Fabc'))

    expect(signInSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'github',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining(
            '/auth/callback?next=%2Fboard%2Fabc',
          ),
          scopes: 'read:user user:email repo',
        }),
      }),
    )
  })

  // ─────────────────────────────────────── Branch A: open-redirect guard
  it('coerces protocol-relative `next` (//evil.com) to /boards', async () => {
    const supabaseMock = buildSupabaseMock()
    const signInSpy = vi.spyOn(supabaseMock.auth, 'signInWithOAuth')
    vi.mocked(createRouteHandlerClient).mockResolvedValue(supabaseMock as never)
    const { GET } = await import('@/app/api/auth/github/refresh/route')

    await GET(buildRequest('?next=%2F%2Fevil.com%2Fpwn'))

    expect(signInSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback?next=%2Fboards'),
        }),
      }),
    )
  })

  it('coerces backslash-prefixed `next` to /boards', async () => {
    const supabaseMock = buildSupabaseMock()
    const signInSpy = vi.spyOn(supabaseMock.auth, 'signInWithOAuth')
    vi.mocked(createRouteHandlerClient).mockResolvedValue(supabaseMock as never)
    const { GET } = await import('@/app/api/auth/github/refresh/route')

    await GET(buildRequest('?next=%5Cevil'))

    expect(signInSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback?next=%2Fboards'),
        }),
      }),
    )
  })

  it('coerces non-relative `next` (https://evil.com) to /boards', async () => {
    const supabaseMock = buildSupabaseMock()
    const signInSpy = vi.spyOn(supabaseMock.auth, 'signInWithOAuth')
    vi.mocked(createRouteHandlerClient).mockResolvedValue(supabaseMock as never)
    const { GET } = await import('@/app/api/auth/github/refresh/route')

    await GET(buildRequest('?next=https%3A%2F%2Fevil.com'))

    expect(signInSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback?next=%2Fboards'),
        }),
      }),
    )
  })

  // ─────────────────────────────────────── Branch B: attempt cap
  it('redirects to /login?error=token_refresh_failed when attempt exceeds the cap', async () => {
    const { GET } = await import('@/app/api/auth/github/refresh/route')

    const response = await GET(buildRequest('?next=%2Fboard%2Fabc&attempt=2'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain(
      '/login?error=token_refresh_failed',
    )
    expect(logSecurityEvent).toHaveBeenCalledWith('login_failure', {
      error: 'refresh_attempt_cap_exceeded',
    })
  })

  it('treats a malformed attempt value as 1 (does not bail)', async () => {
    const { GET } = await import('@/app/api/auth/github/refresh/route')

    const response = await GET(
      buildRequest('?next=%2Fboard%2Fabc&attempt=garbage'),
    )

    // Should still hit the happy path since malformed clamps to 1.
    expect(response.headers.get('location')).toBe(MOCK_GITHUB_OAUTH_URL)
  })

  // ─────────────────────────────────────── Branch C: rate limit
  it('redirects to /login?error=rate_limited when checkRateLimit denies', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      error: 'Too many sign-in requests. Please try again later.',
    })
    const { GET } = await import('@/app/api/auth/github/refresh/route')

    const response = await GET(buildRequest('?next=%2Fboard%2Fabc'))

    const location = response.headers.get('location') ?? ''
    expect(location).toContain('/login?error=rate_limited')
    expect(location).toContain('message=')
  })

  // ─────────────────────────────────────── Branch D: no Supabase session
  it('redirects to /login?next=... when there is no Supabase user', async () => {
    vi.mocked(createRouteHandlerClient).mockResolvedValue(
      buildSupabaseMock({
        getUser: async () => ({
          data: { user: null },
          error: { message: 'no session' },
        }),
      }) as never,
    )
    const { GET } = await import('@/app/api/auth/github/refresh/route')

    const response = await GET(buildRequest('?next=%2Fboard%2Fabc'))

    expect(response.headers.get('location')).toContain(
      '/login?next=%2Fboard%2Fabc',
    )
    // Happy path event must not fire when we bounce to /login.
    expect(logSecurityEvent).not.toHaveBeenCalledWith(
      'login_success',
      expect.anything(),
    )
  })

  // ─────────────────────────────────────── Branch F: signInWithOAuth error
  it('redirects to /login?error=oauth_failed when signInWithOAuth returns an error', async () => {
    vi.mocked(createRouteHandlerClient).mockResolvedValue(
      buildSupabaseMock({
        signInWithOAuth: async () => ({
          data: { url: null },
          error: { message: 'github unreachable' },
        }),
      }) as never,
    )
    const { GET } = await import('@/app/api/auth/github/refresh/route')

    const response = await GET(buildRequest('?next=%2Fboard%2Fabc'))

    const location = response.headers.get('location') ?? ''
    expect(location).toContain('/login?error=oauth_failed')
    expect(location).toContain('message=github%20unreachable')
  })

  // ─────────────────────────────────────── Branch G: missing data.url
  it('redirects to /login?error=oauth_failed when Supabase returns no redirect URL', async () => {
    vi.mocked(createRouteHandlerClient).mockResolvedValue(
      buildSupabaseMock({
        signInWithOAuth: async () => ({
          data: { url: null },
          error: null,
        }),
      }) as never,
    )
    const { GET } = await import('@/app/api/auth/github/refresh/route')

    const response = await GET(buildRequest('?next=%2Fboard%2Fabc'))

    expect(response.headers.get('location')).toContain(
      '/login?error=oauth_failed',
    )
  })

  // ─────────────────────────────────────── Branch H: unexpected exception
  it('redirects to /login?error=unexpected_error when an exception bubbles out', async () => {
    vi.mocked(createRouteHandlerClient).mockResolvedValue(
      buildSupabaseMock({
        getUser: async () => {
          throw new Error('something exploded')
        },
      }) as never,
    )
    const { GET } = await import('@/app/api/auth/github/refresh/route')

    const response = await GET(buildRequest('?next=%2Fboard%2Fabc'))

    expect(response.headers.get('location')).toContain(
      '/login?error=unexpected_error',
    )
  })

  // ─────────────────────────────────────── default-next behavior
  it('defaults `next` to /boards when not provided', async () => {
    const supabaseMock = buildSupabaseMock()
    const signInSpy = vi.spyOn(supabaseMock.auth, 'signInWithOAuth')
    vi.mocked(createRouteHandlerClient).mockResolvedValue(supabaseMock as never)
    const { GET } = await import('@/app/api/auth/github/refresh/route')

    await GET(buildRequest(''))

    expect(signInSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback?next=%2Fboards'),
        }),
      }),
    )
  })
})
