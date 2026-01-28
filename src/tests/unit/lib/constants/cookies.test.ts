/**
 * Unit Tests: Cookie Constants
 *
 * Tests for environment-specific cookie name generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getGitHubTokenCookieName } from '@/lib/constants/cookies'

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
