/**
 * useRepositoryData Hook
 *
 * Fetches the authenticated user's repositories (including org repos) from
 * GitHub API. Triggers after organizations are loaded to merge org repos
 * that may not appear in /user/repos.
 *
 * @example
 * const { userRepos, isLoadingRepos, reposError } =
 *   useRepositoryData(isOpen, organizations, isLoadingOrgs)
 */

import { useState, useEffect, useEffectEvent } from 'react'

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

interface UseRepositoryDataReturn {
  userRepos: GitHubRepository[]
  isLoadingRepos: boolean
  reposError: string | null
}

/**
 * Fetches user + org repositories when combobox opens and orgs are loaded.
 *
 * @param isOpen - Whether the combobox is currently open
 * @param organizations - Loaded organizations (for org-specific repo fetching)
 * @param isLoadingOrgs - Whether organizations are still loading
 * @returns Repository data and loading/error state
 */
export function useRepositoryData(
  isOpen: boolean,
  organizations: GitHubOrganization[],
  isLoadingOrgs: boolean,
): UseRepositoryDataReturn {
  const [userRepos, setUserRepos] = useState<GitHubRepository[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [reposError, setReposError] = useState<string | null>(null)

  const fetchRepositories = useEffectEvent(async () => {
    setIsLoadingRepos(true)
    setReposError(null)

    try {
      const result = await getAuthenticatedUserRepositories({
        sort: 'updated',
        per_page: 100,
        fetchAll: true,
      })

      if (!result.success) {
        if (result.errorCode === 'GITHUB_TOKEN_MISSING') {
          const wasHandledByRefresh = handleGitHubTokenMissing(
            window.location.pathname,
          )
          if (wasHandledByRefresh) return
        }
        setReposError(result.error)
        setUserRepos([])
        return
      }

      clearGitHubRefreshAttempts()

      const allRepos = [...result.data]

      // Supplement with /orgs/{org}/repos to ensure all org repos are visible
      if (organizations.length > 0) {
        const orgRepoPromises = organizations.map(async (org) =>
          getOrganizationRepositories(org.login, { fetchAll: true }),
        )
        const orgResults = await Promise.all(orgRepoPromises)

        // If any org call surfaced a missing token, the cookie went stale
        // mid-batch — trigger silent refresh and abort the merge.
        const hasOrgTokenMissing = orgResults.some(
          (orgResult) =>
            !orgResult.success &&
            orgResult.errorCode === 'GITHUB_TOKEN_MISSING',
        )
        if (hasOrgTokenMissing) {
          const wasHandledByRefresh = handleGitHubTokenMissing(
            window.location.pathname,
          )
          if (wasHandledByRefresh) return
          // Iframe context: keep the user repos we already fetched and surface
          // an auth error so the UI shows something rather than blanking out.
          setReposError('GitHub authentication required. Please sign in again.')
          setUserRepos(allRepos)
          return
        }

        const existingIds = new Set(allRepos.map((repo) => repo.id))
        for (const orgResult of orgResults) {
          if (orgResult.success) {
            for (const repo of orgResult.data) {
              if (!existingIds.has(repo.id)) {
                allRepos.push(repo)
                existingIds.add(repo.id)
              }
            }
          }
        }
      }

      setUserRepos(allRepos)
    } catch (error) {
      setReposError(
        error instanceof Error ? error.message : 'Failed to fetch repositories',
      )
      setUserRepos([])
    } finally {
      setIsLoadingRepos(false)
    }
  })

  /* eslint-disable react-you-might-not-need-an-effect/no-pass-data-to-parent, react-you-might-not-need-an-effect/no-derived-state, react-you-might-not-need-an-effect/no-event-handler -- data fetching after org load is a valid effect */
  useEffect(() => {
    if (isOpen && !isLoadingOrgs) {
      fetchRepositories()
    }
  }, [isOpen, isLoadingOrgs])
  /* eslint-enable react-you-might-not-need-an-effect/no-pass-data-to-parent, react-you-might-not-need-an-effect/no-derived-state, react-you-might-not-need-an-effect/no-event-handler */

  return { userRepos, isLoadingRepos, reposError }
}
