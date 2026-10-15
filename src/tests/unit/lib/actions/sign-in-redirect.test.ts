/**
 * Unit tests: sign-in failures put a stable code on the login URL.
 *
 * The rate-limit sentence and the provider's message stay on the server.
 * The browser is sent to `/login?error=<code>` and nothing else.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  checkRateLimit: vi.fn(),
  headerGet: vi.fn(),
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
  signInWithOAuth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: harness.redirect,
}))

vi.mock('next/headers', () => ({
  headers: async () => ({ get: harness.headerGet }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: harness.captureException,
  captureMessage: harness.captureMessage,
}))

vi.mock('@/lib/rate-limit/check', () => ({
  checkRateLimit: harness.checkRateLimit,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: async () => ({
    auth: { signInWithOAuth: harness.signInWithOAuth },
  }),
  createAdminClient: vi.fn(),
}))

import { signInWithGitHub } from '@/lib/actions/auth'
import { LOGIN_ERROR } from '@/lib/constants/login-errors'

const RATE_LIMIT_SENTENCE = 'Too many sign-in requests. Please try again later.'
const PROVIDER_MESSAGE = 'GitHub is down for maintenance'

describe('login error codes', () => {
  test('names the codes a login URL is allowed to carry', () => {
    // Arrange
    const codes = LOGIN_ERROR

    // Act
    const values = Object.values(codes)

    // Assert
    expect(codes).toEqual({
      authFailed: 'auth_failed',
      missingCode: 'missing_code',
      oauthFailed: 'oauth_failed',
      rateLimited: 'rate_limited',
      tokenRefreshFailed: 'token_refresh_failed',
      unexpectedError: 'unexpected_error',
    })
    expect(values).toEqual([
      'auth_failed',
      'missing_code',
      'oauth_failed',
      'rate_limited',
      'token_refresh_failed',
      'unexpected_error',
    ])
  })
})

describe('signInWithGitHub login redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    harness.headerGet.mockImplementation((name: string) => {
      if (name === 'x-forwarded-for') return '203.0.113.9'
      if (name === 'origin') return 'http://localhost:3008'
      return null
    })
    harness.checkRateLimit.mockReturnValue({ allowed: true })
  })

  test('sends a rate-limited sign-in to /login?error=rate_limited without the sentence', async () => {
    // Arrange
    harness.checkRateLimit.mockReturnValue({
      allowed: false,
      error: RATE_LIMIT_SENTENCE,
    })

    // Act
    const attempt = signInWithGitHub()

    // Assert
    await expect(attempt).rejects.toThrow(
      'NEXT_REDIRECT:/login?error=rate_limited',
    )
    expect(harness.redirect).toHaveBeenCalledWith('/login?error=rate_limited')
    expect(harness.redirect.mock.calls.flat().join(' ')).not.toContain(
      RATE_LIMIT_SENTENCE,
    )
    expect(harness.signInWithOAuth).not.toHaveBeenCalled()
  })

  test('sends a provider failure to /login?error=oauth_failed without the provider text', async () => {
    // Arrange
    harness.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: PROVIDER_MESSAGE },
    })

    // Act
    const attempt = signInWithGitHub()

    // Assert
    await expect(attempt).rejects.toThrow(
      'NEXT_REDIRECT:/login?error=oauth_failed',
    )
    expect(harness.redirect.mock.calls.flat().join(' ')).not.toContain(
      PROVIDER_MESSAGE,
    )
  })

  test('sends a missing OAuth URL to /login?error=oauth_failed without explaining it in the URL', async () => {
    // Arrange
    harness.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: null,
    })

    // Act
    const attempt = signInWithGitHub()

    // Assert
    await expect(attempt).rejects.toThrow(
      'NEXT_REDIRECT:/login?error=oauth_failed',
    )
    expect(harness.redirect.mock.calls.flat().join(' ')).not.toContain(
      'No redirect URL',
    )
  })
})
