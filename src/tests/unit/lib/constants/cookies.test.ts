/**
 * Unit Tests: Cookie Constants
 *
 * Tests for environment-specific cookie name generation,
 * the 30-day maxAge constant, and the set/delete cookie helpers.
 */

import { cookies } from 'next/headers'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

import {
  getGitHubTokenCookieName,
  GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS,
  setGitHubTokenCookie,
  deleteGitHubTokenCookie,
} from '@/lib/constants/cookies'

describe('getGitHubTokenCookieName', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should extract project ID from dev Supabase URL', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://jqtxjzdxczqwsrvevmyk.supabase.co'

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_jqtxjzdx')
  })

  it('should extract project ID from prod Supabase URL', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://mfeesjmtofgayktirswf.supabase.co'

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_mfeesjmt')
  })

  it('should return default when URL is empty', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_default')
  })

  it('should return default when URL is undefined', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_default')
  })

  it('should return default when URL format is invalid', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url'

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_default')
  })

  it('should return default for non-supabase URLs', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com'

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_default')
  })

  it('should handle short project IDs', () => {
    // Edge case: project ID shorter than 8 chars
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co'

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_abc')
  })
})

describe('GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS', () => {
  it('should equal 30 days in seconds (regression guard for the 8h bug)', () => {
    // The original bug used `60 * 60 * 8` (8 hours) which caused users to lose
    // GitHub access after a workday. 30 days matches Supabase refresh_token TTL.
    expect(GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60)
    expect(GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS).toBe(2_592_000)
  })
})

describe('setGitHubTokenCookie', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://jqtxjzdxczqwsrvevmyk.supabase.co'
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  it('should call cookieStore.set with the env-specific name and 30d maxAge', async () => {
    const setSpy = vi.fn()
    vi.mocked(cookies).mockResolvedValue({ set: setSpy } as never)

    await setGitHubTokenCookie('test-provider-token')

    expect(setSpy).toHaveBeenCalledTimes(1)
    expect(setSpy).toHaveBeenCalledWith(
      'gh_token_jqtxjzdx',
      'test-provider-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS,
        path: '/',
      }),
    )
  })

  it('should set secure=false outside production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV =
      'development'
    const setSpy = vi.fn()
    vi.mocked(cookies).mockResolvedValue({ set: setSpy } as never)

    await setGitHubTokenCookie('token')

    expect(setSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ secure: false }),
    )
  })

  it('should set secure=true in production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const setSpy = vi.fn()
    vi.mocked(cookies).mockResolvedValue({ set: setSpy } as never)

    await setGitHubTokenCookie('token')

    expect(setSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ secure: true }),
    )
  })
})

describe('deleteGitHubTokenCookie', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://jqtxjzdxczqwsrvevmyk.supabase.co'
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  it('should call cookieStore.delete with the env-specific name', async () => {
    const deleteSpy = vi.fn()
    vi.mocked(cookies).mockResolvedValue({ delete: deleteSpy } as never)

    await deleteGitHubTokenCookie()

    expect(deleteSpy).toHaveBeenCalledTimes(1)
    expect(deleteSpy).toHaveBeenCalledWith('gh_token_jqtxjzdx')
  })
})
