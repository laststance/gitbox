/**
 * Unit Tests: useOrganizationData Hook
 *
 * Verifies the organization data fetcher reacts correctly to:
 *  - Combobox open transition (idle → fetch → loaded)
 *  - GITHUB_TOKEN_MISSING from either Server Action → silent refresh redirect
 *  - Iframe fall-through (handler returns false) → keep partial successful data
 *  - Successful response → reset attempt counter via clearGitHubRefreshAttempts
 *  - filteredOrganizations strips the current user from the list
 */

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useOrganizationData } from '@/hooks/board/useOrganizationData'
import {
  getAuthenticatedUser,
  getAuthenticatedUserOrganizations,
  type GitHubUser,
  type GitHubOrganization,
} from '@/lib/actions/github'
import {
  clearGitHubRefreshAttempts,
  handleGitHubTokenMissing,
} from '@/lib/utils/handle-github-token-missing'

vi.mock('@/lib/actions/github', () => ({
  getAuthenticatedUser: vi.fn(),
  getAuthenticatedUserOrganizations: vi.fn(),
}))

vi.mock('@/lib/utils/handle-github-token-missing', () => ({
  handleGitHubTokenMissing: vi.fn(),
  clearGitHubRefreshAttempts: vi.fn(),
}))

const mockUser: GitHubUser = {
  id: 1,
  login: 'octocat',
  avatar_url: 'https://example.com/octocat.png',
  name: 'The Octocat',
  type: 'User',
}

const mockOrgs: GitHubOrganization[] = [
  {
    id: 10,
    login: 'laststance',
    avatar_url: 'https://example.com/laststance.png',
    description: 'org',
  },
  {
    id: 11,
    login: 'octocat',
    avatar_url: 'https://example.com/octocat.png',
    description: 'self-as-org',
  },
]

describe('useOrganizationData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: handler claims redirect ownership (real-world happy path).
    vi.mocked(handleGitHubTokenMissing).mockReturnValue(true)
  })

  it('does nothing while combobox is closed', () => {
    const { result } = renderHook(() => useOrganizationData(false))

    expect(result.current.currentUser).toBeNull()
    expect(result.current.organizations).toEqual([])
    expect(result.current.isLoadingOrgs).toBe(false)
    expect(getAuthenticatedUser).not.toHaveBeenCalled()
    expect(getAuthenticatedUserOrganizations).not.toHaveBeenCalled()
  })

  it('fetches user + orgs on open and resets the refresh counter on success', async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue({
      success: true,
      data: mockUser,
    })
    vi.mocked(getAuthenticatedUserOrganizations).mockResolvedValue({
      success: true,
      data: mockOrgs,
    })

    const { result } = renderHook(() => useOrganizationData(true))

    await waitFor(() => {
      expect(result.current.isLoadingOrgs).toBe(false)
    })

    expect(result.current.currentUser).toEqual(mockUser)
    expect(result.current.organizations).toEqual(mockOrgs)
    // octocat (id 11) is dropped because it matches the current user login.
    expect(result.current.filteredOrganizations).toEqual([mockOrgs[0]])
    expect(clearGitHubRefreshAttempts).toHaveBeenCalledTimes(1)
    expect(handleGitHubTokenMissing).not.toHaveBeenCalled()
  })

  it('triggers silent refresh exactly once when both calls report GITHUB_TOKEN_MISSING', async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue({
      success: false,
      error: 'GitHub authentication required',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })
    vi.mocked(getAuthenticatedUserOrganizations).mockResolvedValue({
      success: false,
      error: 'GitHub authentication required',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })

    const { result } = renderHook(() => useOrganizationData(true))

    await waitFor(() => {
      expect(handleGitHubTokenMissing).toHaveBeenCalledTimes(1)
    })

    // Hook returned early — no state was applied, no counter reset fired.
    expect(result.current.currentUser).toBeNull()
    expect(result.current.organizations).toEqual([])
    expect(clearGitHubRefreshAttempts).not.toHaveBeenCalled()
  })

  it('triggers silent refresh when only one of the two calls reports GITHUB_TOKEN_MISSING', async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue({
      success: true,
      data: mockUser,
    })
    vi.mocked(getAuthenticatedUserOrganizations).mockResolvedValue({
      success: false,
      error: 'GitHub authentication required',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })

    renderHook(() => useOrganizationData(true))

    await waitFor(() => {
      expect(handleGitHubTokenMissing).toHaveBeenCalledTimes(1)
    })
    // Even partial token-missing aborts the state writes — we wait for refresh.
    expect(clearGitHubRefreshAttempts).not.toHaveBeenCalled()
  })

  it('falls through to populate partial data when handler reports iframe context', async () => {
    vi.mocked(handleGitHubTokenMissing).mockReturnValue(false)
    vi.mocked(getAuthenticatedUser).mockResolvedValue({
      success: true,
      data: mockUser,
    })
    vi.mocked(getAuthenticatedUserOrganizations).mockResolvedValue({
      success: false,
      error: 'GitHub authentication required',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })

    const { result } = renderHook(() => useOrganizationData(true))

    await waitFor(() => {
      expect(result.current.isLoadingOrgs).toBe(false)
    })

    // User came back, orgs did not — UI should still render the user data.
    expect(result.current.currentUser).toEqual(mockUser)
    expect(result.current.organizations).toEqual([])
    // Counter resets because the user fetch confirmed the token is alive.
    expect(clearGitHubRefreshAttempts).toHaveBeenCalledTimes(1)
  })

  it('does not crash when both Server Actions throw mid-fetch', async () => {
    vi.mocked(getAuthenticatedUser).mockRejectedValue(new Error('network'))
    vi.mocked(getAuthenticatedUserOrganizations).mockRejectedValue(
      new Error('network'),
    )

    const { result } = renderHook(() => useOrganizationData(true))

    await waitFor(() => {
      expect(result.current.isLoadingOrgs).toBe(false)
    })

    expect(result.current.currentUser).toBeNull()
    expect(result.current.organizations).toEqual([])
    expect(handleGitHubTokenMissing).not.toHaveBeenCalled()
    expect(clearGitHubRefreshAttempts).not.toHaveBeenCalled()
  })
})
