import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const actionHarness = vi.hoisted(() => ({
  captureException: vi.fn(),
  checkRateLimit: vi.fn(),
  deleteGitHubTokenCookie: vi.fn(),
  getCachedGitHubRepositoryCatalog: vi.fn(),
  getGitHubCatalogErrorStatus: vi.fn(),
  getGitHubToken: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: actionHarness.captureException,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}))

vi.mock('@/lib/axios-github', () => ({
  getGitHubToken: actionHarness.getGitHubToken,
}))

vi.mock('@/lib/constants/cookies', () => ({
  deleteGitHubTokenCookie: actionHarness.deleteGitHubTokenCookie,
}))

vi.mock('@/lib/github/repository-catalog', () => ({
  getCachedGitHubRepositoryCatalog:
    actionHarness.getCachedGitHubRepositoryCatalog,
  getGitHubCatalogErrorStatus: actionHarness.getGitHubCatalogErrorStatus,
}))

vi.mock('@/lib/logger', () => ({
  createModuleLogger: vi.fn(() => ({
    error: actionHarness.logError,
    warn: actionHarness.logWarn,
  })),
}))

vi.mock('@/lib/rate-limit/check', () => ({
  checkRateLimit: actionHarness.checkRateLimit,
}))

import { getAuthenticatedRepositoryCatalog } from '@/lib/actions/github'

describe('GitHub repository catalog network errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionHarness.getGitHubToken.mockResolvedValue('gho_timeout_secret')
    actionHarness.checkRateLimit.mockReturnValue({ allowed: true })
    actionHarness.getGitHubCatalogErrorStatus.mockReturnValue(null)
  })

  it('returns a safe network error without sending the OAuth token to logs or Sentry', async () => {
    // Arrange
    const rawToken = 'gho_timeout_secret'
    const requestConfig = {
      headers: new axios.AxiosHeaders({
        Authorization: `Bearer ${rawToken}`,
      }),
    }
    const timeoutError = new axios.AxiosError(
      `Timed out while using ${rawToken}`,
      'ECONNABORTED',
      requestConfig,
    )
    actionHarness.getCachedGitHubRepositoryCatalog.mockRejectedValue(
      timeoutError,
    )

    // Act
    const result = await getAuthenticatedRepositoryCatalog()

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'GitHub API error: ECONNABORTED',
    })
    expect(actionHarness.logError).not.toHaveBeenCalled()
    expect(actionHarness.captureException).not.toHaveBeenCalled()
    expect(actionHarness.deleteGitHubTokenCookie).not.toHaveBeenCalled()
    expect(JSON.stringify({ result, calls: actionHarness })).not.toContain(
      rawToken,
    )
  })
})
