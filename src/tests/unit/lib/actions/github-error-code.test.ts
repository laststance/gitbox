/**
 * Unit Tests: GitHub Server Action Error Codes
 *
 * Verifies that the repository-catalog Server Action returns a
 * structured `ActionResult` with `errorCode: 'GITHUB_TOKEN_MISSING'`
 * when the provider_token cookie is absent. The client-side hook in
 * `src/lib/utils/handle-github-token-missing.ts` keys off this code to
 * trigger silent re-auth instead of surfacing the error to the user.
 *
 * Covered action: getAuthenticatedRepositoryCatalog
 */

import axios from 'axios'
import { cookies } from 'next/headers'
import type * as NextHeaders from 'next/headers'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const actionHarness = vi.hoisted(() => ({
  getCachedGitHubRepositoryCatalog: vi.fn(),
  getGitHubCatalogErrorStatus: vi.fn(),
}))

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

vi.mock('@/lib/github/repository-catalog', () => ({
  getCachedGitHubRepositoryCatalog:
    actionHarness.getCachedGitHubRepositoryCatalog,
  getGitHubCatalogErrorStatus: actionHarness.getGitHubCatalogErrorStatus,
}))

vi.mock('@/lib/rate-limit/check', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}))

describe('GitHub Server Actions: errorCode=GITHUB_TOKEN_MISSING', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    actionHarness.getCachedGitHubRepositoryCatalog.mockReset()
    actionHarness.getGitHubCatalogErrorStatus.mockReset()
    actionHarness.getGitHubCatalogErrorStatus.mockReturnValue(null)
    process.env = { ...originalEnv }
    // Force the production code path so getGitHubToken actually inspects
    // the cookie store (test mode short-circuits to true).
    process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK = 'false'
    process.env.APP_ENV = 'production'
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://zfcwvzazzzsefbkztsyp.supabase.co'

    const cookieStoreMissingToken = {
      get: vi.fn().mockReturnValue(undefined),
    }
    vi.mocked(cookies).mockResolvedValue(cookieStoreMissingToken as never)
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  test('prompts silent re-auth when the repository catalog opens without a GitHub cookie', async () => {
    // Arrange
    const { getAuthenticatedRepositoryCatalog } =
      await import('@/lib/actions/github')

    // Act
    const result = await getAuthenticatedRepositoryCatalog()

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'GitHub token not found. Please sign in again.',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })
  })

  test('deletes a revoked token cookie and returns the stable expiry message after live validation responds 401', async () => {
    // Arrange
    const requestConfig = {
      headers: new axios.AxiosHeaders({
        Authorization: 'Bearer gho_revoked_live_token',
      }),
    }
    const unauthorizedError = new axios.AxiosError(
      'Bad credentials',
      'ERR_BAD_REQUEST',
      requestConfig,
      undefined,
      {
        status: 401,
        data: { message: 'Bad credentials' },
        statusText: 'Unauthorized',
        headers: new axios.AxiosHeaders(),
        config: requestConfig,
      },
    )
    const deleteSpy = vi.fn()
    const cookieStoreWithRevokedToken = {
      get: vi.fn().mockReturnValue({ value: 'gho_revoked_live_token' }),
      delete: deleteSpy,
    }
    vi.mocked(cookies).mockResolvedValue(cookieStoreWithRevokedToken as never)
    actionHarness.getCachedGitHubRepositoryCatalog.mockRejectedValue(
      unauthorizedError,
    )
    const { getAuthenticatedRepositoryCatalog } =
      await import('@/lib/actions/github')

    // Act
    const result = await getAuthenticatedRepositoryCatalog()

    // Assert
    expect(actionHarness.getCachedGitHubRepositoryCatalog).toHaveBeenCalledWith(
      'gho_revoked_live_token',
    )
    expect(deleteSpy).toHaveBeenCalledTimes(1)
    expect(deleteSpy).toHaveBeenCalledWith('gh_token_zfcwvzaz')
    expect(result).toEqual({
      success: false,
      error: 'GitHub token expired. Please sign in again.',
    })
  })

  test('deletes only the rejected generation when the request still carries an older token', async () => {
    // Arrange
    const unauthorizedError = new axios.AxiosError(
      'Bad credentials',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 401,
        data: { message: 'Bad credentials' },
        statusText: 'Unauthorized',
        headers: new axios.AxiosHeaders(),
        config: { headers: new axios.AxiosHeaders() },
      },
    )
    const deleteSpy = vi.fn()
    vi.mocked(cookies).mockResolvedValue({
      getAll: () => [
        { name: 'gh_token_zfcwvzaz', value: 'gho_still_valid' },
        { name: 'gh_token_zfcwvzaz_1', value: 'gho_revoked_live_token' },
      ],
      delete: deleteSpy,
    } as never)
    actionHarness.getCachedGitHubRepositoryCatalog.mockRejectedValue(
      unauthorizedError,
    )
    const { getAuthenticatedRepositoryCatalog } =
      await import('@/lib/actions/github')

    // Act
    const result = await getAuthenticatedRepositoryCatalog()

    // Assert
    expect(actionHarness.getCachedGitHubRepositoryCatalog).toHaveBeenCalledWith(
      'gho_revoked_live_token',
    )
    expect(deleteSpy).toHaveBeenCalledTimes(1)
    expect(deleteSpy).toHaveBeenCalledWith('gh_token_zfcwvzaz_1')
    expect(result).toEqual({
      success: false,
      error: 'GitHub token expired. Please sign in again.',
    })
  })
})
