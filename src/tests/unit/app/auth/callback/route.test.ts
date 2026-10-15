/**
 * Unit Tests: the OAuth callback and the first board
 *
 * The callback establishes the session and then gives a user without boards
 * their "First Board". It hands {@link createFirstBoardIfNeeded} its own
 * client and the id of the session it just established: the database takes
 * the owner of the new board from that client's session, and the boards
 * counted are those of that id. A caller that passed anything else would
 * count another user's boards.
 *
 * @see src/app/auth/callback/route.ts
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

import { GET } from '@/app/auth/callback/route'
import { createFirstBoardIfNeeded } from '@/lib/actions/board-creation'
import { checkRateLimit } from '@/lib/rate-limit/check'

/** The code exchange of the client the callback creates; each test sets its answer. */
const exchangeCodeForSession = vi.fn()

/** The new sign-in the callback starts after a verifier collision. */
const signInWithOAuth = vi.fn()

/** The client the callback creates for the request. */
const routeClient = { auth: { exchangeCodeForSession, signInWithOAuth } }

vi.mock('@/lib/supabase/server', () => ({
  createRouteHandlerClient: vi.fn(async () => routeClient),
}))

vi.mock('@/lib/actions/board-creation', () => ({
  createFirstBoardIfNeeded: vi.fn(),
}))

vi.mock('@/lib/constants/cookies', () => ({
  setGitHubTokenCookie: vi.fn(),
}))

vi.mock('@/lib/security-events', () => ({
  logSecurityEvent: vi.fn(),
}))

vi.mock('@/lib/rate-limit/check', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}))

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true })
  })

  test('creates the first board with the client and the user of the session it just established', async () => {
    // Arrange
    exchangeCodeForSession.mockResolvedValue({
      data: {
        session: { provider_token: 'github-token', user: { id: 'user-1' } },
      },
      error: null,
    })
    const request = new Request(
      'http://localhost:3008/auth/callback?code=oauth-code',
    )

    // Act
    const response = await GET(request)

    // Assert
    expect(exchangeCodeForSession).toHaveBeenCalledWith('oauth-code')
    expect(createFirstBoardIfNeeded).toHaveBeenCalledTimes(1)
    expect(createFirstBoardIfNeeded).toHaveBeenCalledWith(routeClient, 'user-1')
    expect(response.headers.get('location')).toBe(
      'http://localhost:3008/boards',
    )
  })

  test('creates no board and sends the user back to the login page when the code exchange fails', async () => {
    // Arrange
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'invalid grant' },
    })
    const request = new Request(
      'http://localhost:3008/auth/callback?code=used-code',
    )

    // Act
    const response = await GET(request)

    // Assert
    expect(createFirstBoardIfNeeded).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'http://localhost:3008/login?error=auth_failed',
    )
  })

  test('starts sign-in again when another tab replaced the code verifier', async () => {
    // Arrange: the slower tab presents the other tab's verifier.
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'code challenge does not match previously saved code verifier',
      },
    })
    signInWithOAuth.mockResolvedValue({
      data: { url: 'https://github.com/login/oauth/authorize?client_id=abc' },
      error: null,
    })
    const request = new Request(
      'http://localhost:3008/auth/callback?code=slower-tab&next=%2Fboard%2Fabc',
    )

    // Act
    const response = await GET(request)

    // Assert: GitHub is opened again, and the verifier text never reaches the login page.
    expect(createFirstBoardIfNeeded).not.toHaveBeenCalled()
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: {
        redirectTo:
          'http://localhost:3008/auth/callback?pkce_retry=1&next=%2Fboard%2Fabc',
        scopes: 'read:user user:email repo',
        skipBrowserRedirect: true,
      },
    })
    expect(response.headers.get('location')).toBe(
      'https://github.com/login/oauth/authorize?client_id=abc',
    )
  })

  test('restarts on the public host when invalid grant is a verifier collision', async () => {
    // Arrange: production sees an internal request URL and the public host.
    vi.stubEnv('NODE_ENV', 'production')
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'invalid grant', code: 'bad_code_verifier' },
    })
    signInWithOAuth.mockResolvedValue({
      data: { url: 'https://github.com/login/oauth/authorize?client_id=abc' },
      error: null,
    })
    const request = new Request(
      'http://localhost:3008/auth/callback?code=slower-tab&next=%2Fboard%2Fabc',
      { headers: { 'x-forwarded-host': 'gitbox-laststance.vercel.app' } },
    )

    try {
      // Act
      const response = await GET(request)

      // Assert
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        options: {
          redirectTo:
            'https://gitbox-laststance.vercel.app/auth/callback?pkce_retry=1&next=%2Fboard%2Fabc',
          scopes: 'read:user user:email repo',
          skipBrowserRedirect: true,
        },
      })
      expect(response.headers.get('location')).toBe(
        'https://github.com/login/oauth/authorize?client_id=abc',
      )
    } finally {
      vi.unstubAllEnvs()
    }
  })

  test('sends the slower tab to login without the verifier text when the restart also mismatches', async () => {
    // Arrange
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'code challenge does not match previously saved code verifier',
      },
    })
    const request = new Request(
      'http://localhost:3008/auth/callback?code=slower-tab&pkce_retry=1&next=%2Fboard%2Fabc',
    )

    // Act
    const response = await GET(request)

    // Assert
    expect(signInWithOAuth).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'http://localhost:3008/login?error=auth_failed',
    )
  })

  test('sends the slower tab to login when the restarted sign-in rejects', async () => {
    // Arrange
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'code challenge does not match previously saved code verifier',
      },
    })
    signInWithOAuth.mockRejectedValue(new Error('network down'))
    const request = new Request(
      'http://localhost:3008/auth/callback?code=slower-tab',
    )

    // Act
    const response = await GET(request)

    // Assert
    expect(response.headers.get('location')).toBe(
      'http://localhost:3008/login?error=oauth_failed',
    )
  })

  test('sends the slower tab to login when another sign-in is not allowed yet', async () => {
    // Arrange
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'code challenge does not match previously saved code verifier',
      },
    })
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      error: 'too many sign-ins',
    })
    const request = new Request(
      'http://localhost:3008/auth/callback?code=slower-tab',
    )

    // Act
    const response = await GET(request)

    // Assert
    expect(signInWithOAuth).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'http://localhost:3008/login?error=rate_limited',
    )
  })

  test('creates no board when the callback is opened without a code', async () => {
    // Arrange
    const request = new Request('http://localhost:3008/auth/callback')

    // Act
    const response = await GET(request)

    // Assert
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(createFirstBoardIfNeeded).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'http://localhost:3008/login?error=missing_code',
    )
  })
})
