/**
 * Unit Tests: GitHub Server Action Error Codes
 *
 * Verifies that the four token-gated GitHub Server Actions return a
 * structured `ActionResult` with `errorCode: 'GITHUB_TOKEN_MISSING'`
 * when the provider_token cookie is absent. The client-side hook in
 * `src/lib/utils/handle-github-token-missing.ts` keys off this code to
 * trigger silent re-auth instead of surfacing the error to the user.
 *
 * Covered actions:
 *  - getAuthenticatedUser
 *  - getAuthenticatedUserRepositories
 *  - getAuthenticatedUserOrganizations
 *  - getOrganizationRepositories
 */

import { cookies } from 'next/headers'
import type * as NextHeaders from 'next/headers'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', async () => {
  const actual = await vi.importActual<typeof NextHeaders>('next/headers')
  return {
    ...actual,
    cookies: vi.fn(),
    headers: vi.fn().mockResolvedValue({
      get: vi.fn().mockReturnValue('127.0.0.1'),
    }),
  }
})

describe('GitHub Server Actions: errorCode=GITHUB_TOKEN_MISSING', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    // Force the production code path so hasGitHubToken actually inspects
    // the cookie store (test mode short-circuits to true).
    process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK = 'false'
    process.env.APP_ENV = 'production'
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://jqtxjzdxczqwsrvevmyk.supabase.co'

    const cookieStoreMissingToken = {
      get: vi.fn().mockReturnValue(undefined),
    }
    vi.mocked(cookies).mockResolvedValue(cookieStoreMissingToken as never)
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  it('getAuthenticatedUser returns errorCode when cookie is absent', async () => {
    const { getAuthenticatedUser } = await import('@/lib/actions/github')

    const result = await getAuthenticatedUser()

    expect(result).toEqual({
      success: false,
      error: 'GitHub token not found. Please sign in again.',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })
  })

  it('getAuthenticatedUserRepositories returns errorCode when cookie is absent', async () => {
    const { getAuthenticatedUserRepositories } =
      await import('@/lib/actions/github')

    const result = await getAuthenticatedUserRepositories({ fetchAll: true })

    expect(result).toEqual({
      success: false,
      error: 'GitHub token not found. Please sign in again.',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })
  })

  it('getAuthenticatedUserOrganizations returns errorCode when cookie is absent', async () => {
    const { getAuthenticatedUserOrganizations } =
      await import('@/lib/actions/github')

    const result = await getAuthenticatedUserOrganizations()

    expect(result).toEqual({
      success: false,
      error: 'GitHub token not found. Please sign in again.',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })
  })

  it('getOrganizationRepositories returns errorCode when cookie is absent', async () => {
    const { getOrganizationRepositories } = await import('@/lib/actions/github')

    const result = await getOrganizationRepositories('laststance', {
      fetchAll: true,
    })

    expect(result).toEqual({
      success: false,
      error: 'GitHub token not found. Please sign in again.',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })
  })
})
