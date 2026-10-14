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

/** The code exchange of the client the callback creates; each test sets its answer. */
const exchangeCodeForSession = vi.fn()

/** The client the callback creates for the request. */
const routeClient = { auth: { exchangeCodeForSession } }

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
      'http://localhost:3008/login?error=auth_failed&message=invalid%20grant',
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
