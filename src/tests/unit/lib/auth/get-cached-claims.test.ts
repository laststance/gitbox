/**
 * Unit Tests: getCachedClaims()
 *
 * Verifies the request-scoped JWT-claims helper that backs every server-side
 * auth gate (proxy.ts, requireClaims, auth-guard.ts). Covers:
 *
 *  A. Happy path — valid claims pass through unchanged
 *  B. SDK error — returns null (treat as unauthenticated)
 *  C. Missing claims — returns null
 *  D. Defensive expiry check — exp in the past returns null
 *  E. Defensive expiry check — exp omitted/non-number returns null (fail closed)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const MOCK_USER_UUID = '00000000-0000-0000-0000-000000000001'

// Builds a minimal Supabase client mock whose `auth.getClaims()` returns the
// caller-supplied response, so each test can exercise a specific branch.
function buildSupabaseMock(getClaimsResult: {
  data: { claims: Record<string, unknown> | null } | null
  error: unknown
}) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue(getClaimsResult),
    },
  }
}

// React.cache() memoizes per-module-load, so reset the module between tests
// to guarantee each `it` block starts from a fresh cache.
async function importFreshHelper() {
  vi.resetModules()
  return import('@/lib/auth/get-cached-claims')
}

describe('getCachedClaims()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { supabase, claims } when the SDK returns valid claims', async () => {
    // Arrange
    const futureExpInSeconds = Math.floor(Date.now() / 1000) + 3600
    const validClaims = {
      iss: 'supabase-demo',
      sub: MOCK_USER_UUID,
      aud: 'authenticated',
      exp: futureExpInSeconds,
      iat: Math.floor(Date.now() / 1000),
      role: 'authenticated',
      email: 'test@example.com',
    }
    const supabaseMock = buildSupabaseMock({
      data: { claims: validClaims },
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(supabaseMock as never)

    // Act
    const { getCachedClaims } = await importFreshHelper()
    const result = await getCachedClaims()

    // Assert
    expect(result).not.toBeNull()
    expect(result?.claims.sub).toBe(MOCK_USER_UUID)
    expect(result?.claims.exp).toBe(futureExpInSeconds)
    expect(result?.supabase).toBe(supabaseMock)
  })

  it('returns null when the SDK reports an error', async () => {
    // Arrange
    const supabaseMock = buildSupabaseMock({
      data: null,
      error: new Error('JWKS fetch failed'),
    })
    vi.mocked(createClient).mockResolvedValue(supabaseMock as never)

    // Act
    const { getCachedClaims } = await importFreshHelper()
    const result = await getCachedClaims()

    // Assert
    expect(result).toBeNull()
  })

  it('returns null when claims payload is missing', async () => {
    // Arrange
    const supabaseMock = buildSupabaseMock({
      data: { claims: null },
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(supabaseMock as never)

    // Act
    const { getCachedClaims } = await importFreshHelper()
    const result = await getCachedClaims()

    // Assert
    expect(result).toBeNull()
  })

  it('returns null when the defensive exp check trips (token already expired)', async () => {
    // Arrange — exp 60s in the past
    const pastExpInSeconds = Math.floor(Date.now() / 1000) - 60
    const expiredClaims = {
      iss: 'supabase-demo',
      sub: MOCK_USER_UUID,
      aud: 'authenticated',
      exp: pastExpInSeconds,
      iat: pastExpInSeconds - 3600,
      role: 'authenticated',
    }
    const supabaseMock = buildSupabaseMock({
      data: { claims: expiredClaims },
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(supabaseMock as never)

    // Act
    const { getCachedClaims } = await importFreshHelper()
    const result = await getCachedClaims()

    // Assert
    expect(result).toBeNull()
  })

  it('returns null when exp is missing or non-numeric (fail closed)', async () => {
    // Arrange — exp deliberately omitted; a JWT without an expiry must be
    // rejected by the auth gate even if the Supabase SDK accepted it.
    const claimsWithoutExp = {
      iss: 'supabase-demo',
      sub: MOCK_USER_UUID,
      aud: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      role: 'authenticated',
    }
    const supabaseMock = buildSupabaseMock({
      data: { claims: claimsWithoutExp },
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(supabaseMock as never)

    // Act
    const { getCachedClaims } = await importFreshHelper()
    const result = await getCachedClaims()

    // Assert — fail closed: missing exp = unauthenticated
    expect(result).toBeNull()
  })
})
