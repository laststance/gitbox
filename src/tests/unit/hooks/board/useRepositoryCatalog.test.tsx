/**
 * Unit Tests: useRepositoryCatalog Hook
 *
 * Verifies the repository picker catalog remains idle while closed, performs
 * one aggregate request on first open, retains successful data across reopens,
 * and exposes retryable authentication and generic failures.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useRepositoryCatalog } from '@/hooks/board/useRepositoryCatalog'
import {
  getAuthenticatedRepositoryCatalog,
  type GitHubRepositoryCatalog,
} from '@/lib/actions/github'
import {
  clearGitHubRefreshAttempts,
  handleGitHubTokenMissing,
} from '@/lib/utils/handle-github-token-missing'

vi.mock('@/lib/actions/github', () => ({
  getAuthenticatedRepositoryCatalog: vi.fn(),
}))

vi.mock('@/lib/utils/handle-github-token-missing', () => ({
  clearGitHubRefreshAttempts: vi.fn(),
  handleGitHubTokenMissing: vi.fn(),
}))

const repositoryCatalog: GitHubRepositoryCatalog = {
  currentUser: {
    id: 1,
    login: 'octocat',
    avatar_url: 'https://example.com/octocat.png',
    name: 'The Octocat',
    type: 'User',
  },
  organizations: [
    {
      id: 10,
      login: 'laststance',
      avatar_url: 'https://example.com/laststance.png',
      description: 'Laststance organization',
    },
    {
      id: 11,
      login: 'OCTOCAT',
      avatar_url: 'https://example.com/octocat.png',
      description: 'Case-insensitive current-user entry',
    },
  ],
  repositories: [
    {
      id: 100,
      node_id: 'node-100',
      name: 'gitbox',
      full_name: 'laststance/gitbox',
      owner: {
        login: 'laststance',
        avatar_url: 'https://example.com/laststance.png',
      },
      description: 'Repository catalog test fixture',
      html_url: 'https://github.com/laststance/gitbox',
      homepage: null,
      stargazers_count: 42,
      watchers_count: 42,
      language: 'TypeScript',
      topics: ['kanban'],
      visibility: 'public',
      updated_at: '2026-07-16T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
}

describe('useRepositoryCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(handleGitHubTokenMissing).mockReturnValue(true)
    window.history.replaceState({}, '', '/board/board-1')
  })

  it('stays idle without requesting GitHub data while the picker is closed', () => {
    // Arrange
    const isPickerOpen = false

    // Act
    const { result } = renderHook(() => useRepositoryCatalog(isPickerOpen))

    // Assert
    expect(result.current).toEqual({
      currentUser: null,
      organizations: [],
      filteredOrganizations: [],
      userRepos: [],
      isLoadingCatalog: false,
      catalogError: null,
    })
    expect(getAuthenticatedRepositoryCatalog).not.toHaveBeenCalled()
  })

  it('requests the aggregate catalog exactly once when the picker opens', async () => {
    // Arrange
    vi.mocked(getAuthenticatedRepositoryCatalog).mockResolvedValue({
      success: true,
      data: repositoryCatalog,
    })

    // Act
    const { result } = renderHook(() => useRepositoryCatalog(true))

    // Assert
    await waitFor(() => {
      expect(result.current.isLoadingCatalog).toBe(false)
    })
    expect(getAuthenticatedRepositoryCatalog).toHaveBeenCalledTimes(1)
  })

  it('exposes the complete repository catalog and excludes the current user from organization filters', async () => {
    // Arrange
    vi.mocked(getAuthenticatedRepositoryCatalog).mockResolvedValue({
      success: true,
      data: repositoryCatalog,
    })

    // Act
    const { result } = renderHook(() => useRepositoryCatalog(true))

    // Assert
    await waitFor(() => {
      expect(result.current.currentUser).toEqual(repositoryCatalog.currentUser)
    })
    expect(result.current.organizations).toEqual(
      repositoryCatalog.organizations,
    )
    expect(result.current.filteredOrganizations).toEqual([
      repositoryCatalog.organizations[0],
    ])
    expect(result.current.userRepos).toEqual(repositoryCatalog.repositories)
    expect(result.current.catalogError).toBeNull()
    expect(clearGitHubRefreshAttempts).toHaveBeenCalledTimes(1)
    expect(handleGitHubTokenMissing).not.toHaveBeenCalled()
  })

  it('reopens instantly from retained catalog data without another request', async () => {
    // Arrange
    vi.mocked(getAuthenticatedRepositoryCatalog).mockResolvedValue({
      success: true,
      data: repositoryCatalog,
    })
    const { result, rerender } = renderHook(
      ({ isOpen }) => useRepositoryCatalog(isOpen),
      { initialProps: { isOpen: true } },
    )
    await waitFor(() => {
      expect(result.current.userRepos).toEqual(repositoryCatalog.repositories)
    })

    // Act
    rerender({ isOpen: false })
    rerender({ isOpen: true })

    // Assert
    expect(result.current.userRepos).toEqual(repositoryCatalog.repositories)
    expect(getAuthenticatedRepositoryCatalog).toHaveBeenCalledTimes(1)
  })

  it('hands a missing token to the top-level refresh flow without flashing an error', async () => {
    // Arrange
    vi.mocked(getAuthenticatedRepositoryCatalog).mockResolvedValue({
      success: false,
      error: 'GitHub token not found. Please sign in again.',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })

    // Act
    const { result } = renderHook(() => useRepositoryCatalog(true))

    // Assert
    await waitFor(() => {
      expect(handleGitHubTokenMissing).toHaveBeenCalledWith('/board/board-1')
    })
    expect(result.current.isLoadingCatalog).toBe(false)
    expect(result.current.catalogError).toBeNull()
    expect(clearGitHubRefreshAttempts).not.toHaveBeenCalled()
  })

  it('shows the authentication error when an iframe cannot run the refresh flow', async () => {
    // Arrange
    vi.mocked(handleGitHubTokenMissing).mockReturnValue(false)
    vi.mocked(getAuthenticatedRepositoryCatalog).mockResolvedValue({
      success: false,
      error: 'GitHub token not found. Please sign in again.',
      errorCode: 'GITHUB_TOKEN_MISSING',
    })

    // Act
    const { result } = renderHook(() => useRepositoryCatalog(true))

    // Assert
    await waitFor(() => {
      expect(result.current.catalogError).toBe(
        'GitHub token not found. Please sign in again.',
      )
    })
    expect(handleGitHubTokenMissing).toHaveBeenCalledWith('/board/board-1')
    expect(result.current.isLoadingCatalog).toBe(false)
    expect(result.current.userRepos).toEqual([])
  })

  it('retries a generic failure after the picker closes and opens again', async () => {
    // Arrange
    vi.mocked(getAuthenticatedRepositoryCatalog)
      .mockResolvedValueOnce({
        success: false,
        error: 'GitHub API unavailable',
      })
      .mockResolvedValueOnce({
        success: true,
        data: repositoryCatalog,
      })
    const { result, rerender } = renderHook(
      ({ isOpen }) => useRepositoryCatalog(isOpen),
      { initialProps: { isOpen: true } },
    )
    await waitFor(() => {
      expect(result.current.catalogError).toBe('GitHub API unavailable')
    })

    // Act
    rerender({ isOpen: false })
    rerender({ isOpen: true })

    // Assert
    await waitFor(() => {
      expect(result.current.userRepos).toEqual(repositoryCatalog.repositories)
    })
    expect(result.current.catalogError).toBeNull()
    expect(getAuthenticatedRepositoryCatalog).toHaveBeenCalledTimes(2)
    expect(clearGitHubRefreshAttempts).toHaveBeenCalledTimes(1)
    expect(handleGitHubTokenMissing).not.toHaveBeenCalled()
  })
})
