/**
 * Unit Tests: requireClaims()
 *
 * Verifies the Server Component / Server Action auth gate that wraps
 * `getCachedClaims()` and short-circuits to `/login`. Covers:
 *
 *  A. Happy path — returns the same { supabase, claims } from the helper
 *  B. Unauthenticated — redirects to /login (default ROUTES.LOGIN)
 *  C. Unauthenticated with override — redirects to caller-supplied path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { getCachedClaims } from '@/lib/auth/get-cached-claims'
import { ROUTES } from '@/lib/constants/routes'

vi.mock('@/lib/auth/get-cached-claims', () => ({
  getCachedClaims: vi.fn(),
}))

// next/navigation's `redirect()` throws a NEXT_REDIRECT error in real Next.
// Mirror that contract so test code can `expect(() => ...).toThrow(...)` and
// also assert which path the redirect targeted.
const mockRedirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`)
})
vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}))

describe('requireClaims()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { supabase, claims } when getCachedClaims resolves with a session', async () => {
    // Arrange
    const fakeContext = {
      supabase: { tag: 'supabase-client' } as never,
      claims: {
        iss: 'supabase-demo',
        sub: '00000000-0000-0000-0000-000000000001',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        role: 'authenticated',
      },
    }
    vi.mocked(getCachedClaims).mockResolvedValue(fakeContext as never)

    // Act
    const { requireClaims } = await import('@/lib/auth/require-claims')
    const result = await requireClaims()

    // Assert
    expect(result).toBe(fakeContext)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('redirects to ROUTES.LOGIN when getCachedClaims returns null', async () => {
    // Arrange
    vi.mocked(getCachedClaims).mockResolvedValue(null)

    // Act + Assert — redirect throws NEXT_REDIRECT
    const { requireClaims } = await import('@/lib/auth/require-claims')
    await expect(requireClaims()).rejects.toThrow(
      `NEXT_REDIRECT:${ROUTES.LOGIN}`,
    )
    expect(mockRedirect).toHaveBeenCalledWith(ROUTES.LOGIN)
  })

  it('redirects to the caller-supplied path when unauthenticated', async () => {
    // Arrange
    vi.mocked(getCachedClaims).mockResolvedValue(null)
    const customRedirectTarget = '/boards/favorites'

    // Act + Assert
    const { requireClaims } = await import('@/lib/auth/require-claims')
    await expect(requireClaims(customRedirectTarget)).rejects.toThrow(
      `NEXT_REDIRECT:${customRedirectTarget}`,
    )
    expect(mockRedirect).toHaveBeenCalledWith(customRedirectTarget)
  })
})
