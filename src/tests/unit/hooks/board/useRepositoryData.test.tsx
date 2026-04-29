/**
 * Unit Tests: useRepositoryData Hook
 *
 * Verifies the repository fetcher reacts correctly to:
 *  - Idle state while combobox is closed or orgs still loading
 *  - GITHUB_TOKEN_MISSING from the initial /user/repos call → silent refresh
 *  - GITHUB_TOKEN_MISSING from any of the parallel /orgs/{login}/repos calls
 *    → silent refresh
 *  - Iframe fall-through (handler returns false) for the org-batch case
 *    → keep already-fetched user repos and surface a reposError string
 *  - Successful path → merge org repos by id, reset attempt counter
 *  - Generic Server Action error → set reposError, do not redirect
 */

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useRepositoryData } from '@/hooks/board/useRepositoryData'
import {
  getAuthenticatedUserRepositories,
  getOrganizationRepositories,
  type GitHubRepository,
  type GitHubOrganization,
} from '@/lib/actions/github'
import {
  clearGitHubRefreshAttempts,
  handleGitHubTokenMissing,
} from '@/lib/utils/handle-github-token-missing'

vi.mock('@/lib/actions/github', () => ({
  getAuthenticatedUserRepositories: vi.fn(),
  getOrganizationRepositories: vi.fn(),
}))

vi.mock('@/lib/utils/handle-github-token-missing', () => ({
  handleGitHubTokenMissing: vi.fn(),
  clearGitHubRefreshAttempts: vi.fn(),
}))

const buildRepo = (
  overrides: Partial<GitHubRepository> = {},
): GitHubRepository => ({
  id: 1,
  node_id: 'node-1',
  name: 'repo-1',
  full_name: 'octocat/repo-1',
  owner: { login: 'octocat', avatar_url: 'https://example.com/o.png' },
  description: null,
  html_url: 'https://github.com/octocat/repo-1',
  homepage: null,
  stargazers_count: 0,
  watchers_count: 0,
  language: null,
  topics: [],
  visibility: 'public',
  updated_at: '2026-04-29T00:00:00Z',
  created_at: '2026-04-29T00:00:00Z',
  ...overrides,
})

const userRepo = buildRepo({ id: 1, name: 'user-repo' })
const sharedRepo = buildRepo({ id: 2, name: 'shared-repo' })
const orgOnlyRepo = buildRepo({ id: 3, name: 'org-only' })

const orgs: GitHubOrganization[] = [
  {
    id: 100,
    login: 'laststance',
    avatar_url: 'https://example.com/laststance.png',
    description: null,
  },
]

describe('useRepositoryData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(handleGitHubTokenMissing).mockReturnValue(true)
  })

  it('does not fetch while orgs are still loading', () => {
    renderHook(() => useRepositoryData(true, orgs, true))
    expect(getAuthenticatedUserRepositories).not.toHaveBeenCalled()
    expect(getOrganizationRepositories).not.toHaveBeenCalled()
  })

  it('does not fetch while combobox is closed', () => {
    renderHook(() => useRepositoryData(false, orgs, false))
    expect(getAuthenticatedUserRepositories).not.toHaveBeenCalled()
    expect(getOrganizationRepositories).not.toHaveBeenCalled()
  })

  it('merges user + org repos and dedupes by id on the success path', async () => {
    vi.mocked(getAuthenticatedUserRepositories).mockResolvedValue({
      success: true,
      data: [userRepo, sharedRepo],
    })
    vi.mocked(getOrganizationRepositories).mockResolvedValue({
      success: true,
      data: [sharedRepo, orgOnlyRepo],
    })

    const { result } = renderHook(() => useRepositoryData(true, orgs, false))

    await waitFor(() => {
      expect(result.current.isLoadingRepos).toBe(false)
    })

    expect(result.current.userRepos.map((r) => r.id)).toEqual([1, 2, 3])
    expect(result.current.reposError).toBeNull()
    expect(clearGitHubRefreshAttempts).toHaveBeenCalledTimes(1)
    expect(handleGitHubTokenMissing).not.toHaveBeenCalled()
  })

  it('triggers silent refresh when the initial /user/repos call reports GITHUB_TOKEN_MISSING', async () => {
    vi.mocked(getAuthenticatedUserRepositories).mockResolvedValue({
      success: false,
      error: 'GitHub authentication required',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })

    const { result } = renderHook(() => useRepositoryData(true, orgs, false))

    await waitFor(() => {
      expect(handleGitHubTokenMissing).toHaveBeenCalledTimes(1)
    })

    expect(getOrganizationRepositories).not.toHaveBeenCalled()
    expect(clearGitHubRefreshAttempts).not.toHaveBeenCalled()
    // Refresh redirect owns the UX — surfacing reposError on top would flash
    // an error toast right before the page navigates away.
    expect(result.current.reposError).toBeNull()
    expect(result.current.userRepos).toEqual([])
  })

  it('surfaces reposError without redirect for a non-token-missing initial failure', async () => {
    vi.mocked(getAuthenticatedUserRepositories).mockResolvedValue({
      success: false,
      error: 'Network error',
    })

    const { result } = renderHook(() => useRepositoryData(true, orgs, false))

    await waitFor(() => {
      expect(result.current.isLoadingRepos).toBe(false)
    })

    expect(handleGitHubTokenMissing).not.toHaveBeenCalled()
    expect(result.current.reposError).toBe('Network error')
    expect(result.current.userRepos).toEqual([])
  })

  it('triggers silent refresh when an org repo call reports GITHUB_TOKEN_MISSING mid-batch', async () => {
    vi.mocked(getAuthenticatedUserRepositories).mockResolvedValue({
      success: true,
      data: [userRepo],
    })
    vi.mocked(getOrganizationRepositories).mockResolvedValue({
      success: false,
      error: 'GitHub authentication required',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })

    const { result } = renderHook(() => useRepositoryData(true, orgs, false))

    await waitFor(() => {
      expect(handleGitHubTokenMissing).toHaveBeenCalledTimes(1)
    })

    // Counter reset is intentional: the initial /user/repos call proved the
    // token was alive at that moment, so the loop-protection counter SHOULD
    // forget any earlier failure before the org batch discovers staleness.
    expect(clearGitHubRefreshAttempts).toHaveBeenCalledTimes(1)
    expect(result.current.userRepos).toEqual([])
    expect(result.current.reposError).toBeNull()
  })

  it('keeps user repos and surfaces an auth error when iframe fall-through hits the org batch', async () => {
    vi.mocked(handleGitHubTokenMissing).mockReturnValue(false)
    vi.mocked(getAuthenticatedUserRepositories).mockResolvedValue({
      success: true,
      data: [userRepo],
    })
    vi.mocked(getOrganizationRepositories).mockResolvedValue({
      success: false,
      error: 'GitHub authentication required',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })

    const { result } = renderHook(() => useRepositoryData(true, orgs, false))

    await waitFor(() => {
      expect(result.current.isLoadingRepos).toBe(false)
    })

    expect(handleGitHubTokenMissing).toHaveBeenCalledTimes(1)
    expect(result.current.userRepos).toEqual([userRepo])
    expect(result.current.reposError).toBe(
      'GitHub authentication required. Please sign in again.',
    )
  })

  it('skips org fetch entirely when there are no organizations', async () => {
    vi.mocked(getAuthenticatedUserRepositories).mockResolvedValue({
      success: true,
      data: [userRepo],
    })

    const { result } = renderHook(() => useRepositoryData(true, [], false))

    await waitFor(() => {
      expect(result.current.isLoadingRepos).toBe(false)
    })

    expect(getOrganizationRepositories).not.toHaveBeenCalled()
    expect(result.current.userRepos).toEqual([userRepo])
    expect(clearGitHubRefreshAttempts).toHaveBeenCalledTimes(1)
  })

  it('captures thrown errors as reposError without crashing', async () => {
    vi.mocked(getAuthenticatedUserRepositories).mockRejectedValue(
      new Error('boom'),
    )

    const { result } = renderHook(() => useRepositoryData(true, orgs, false))

    await waitFor(() => {
      expect(result.current.isLoadingRepos).toBe(false)
    })

    expect(result.current.reposError).toBe('boom')
    expect(result.current.userRepos).toEqual([])
    expect(handleGitHubTokenMissing).not.toHaveBeenCalled()
  })
})
