import * as Sentry from '@sentry/nextjs'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'

import { ADD_REPOSITORY_RETURN_PARAM } from '@/hooks/board/useAddRepositoryCombobox'
import {
  getAuthenticatedRepositoryCatalog,
  type GitHubOrganization,
  type GitHubRepository,
  type GitHubRepositoryCatalog,
  type GitHubUser,
} from '@/lib/actions/github'
import type { StatusListId } from '@/lib/types/brands'
import {
  clearGitHubRefreshAttempts,
  handleGitHubTokenMissing,
} from '@/lib/utils/handle-github-token-missing'

interface RepositoryCatalogState {
  catalog: GitHubRepositoryCatalog | null
  error: string | null
  isLoading: boolean
}

interface UseRepositoryCatalogReturn {
  currentUser: GitHubUser | null
  organizations: GitHubOrganization[]
  filteredOrganizations: GitHubOrganization[]
  userRepos: GitHubRepository[]
  isLoadingCatalog: boolean
  catalogError: string | null
}

const EMPTY_ORGANIZATIONS: GitHubOrganization[] = []
const EMPTY_REPOSITORIES: GitHubRepository[] = []
const INITIAL_CATALOG_STATE: RepositoryCatalogState = {
  catalog: null,
  error: null,
  isLoading: false,
}

/**
 * Loads the cached GitHub picker catalog on open and retains a successful result for instant reopen.
 * A later opening supersedes a request that has not settled, so that answer cannot land in the picker.
 * Called by {@link AddRepositoryCombobox}; keeps loading visible during a GitHub authentication redirect.
 * @param isOpen - Whether the repository picker is currently open.
 * @param statusId - Column to reopen after GitHub reauthentication, when available.
 * @returns User, organization filters, repositories, loading state, and any catalog error.
 * @example
 * const { userRepos, isLoadingCatalog } = useRepositoryCatalog(isOpen)
 */
export function useRepositoryCatalog(
  isOpen: boolean,
  statusId?: StatusListId | null,
): UseRepositoryCatalogReturn {
  const [state, setState] = useState<RepositoryCatalogState>(
    INITIAL_CATALOG_STATE,
  )
  // A catalog that already arrived is reused. A refresh navigation blocks a second one.
  const hasCatalog = useRef(false)
  const oauthNavigationStarted = useRef(false)
  // Open → close → open starts another request. Only the newest may write.
  const latestRequestId = useRef(0)

  // Read the latest committed picker intent after the catalog request settles.
  const refreshAuthentication = useEffectEvent((wasResumedPicker: boolean) => {
    const returnUrl = new URL(window.location.href)
    // A resumed picker without a token must show an error instead of looping OAuth.
    if (wasResumedPicker) return false
    // Discard stale markers before carrying the current picker intent into OAuth.
    returnUrl.searchParams.delete(ADD_REPOSITORY_RETURN_PARAM)
    // A picker closed during the request must remain closed after authentication.
    if (isOpen && statusId) {
      returnUrl.searchParams.set(ADD_REPOSITORY_RETURN_PARAM, statusId)
    }
    return handleGitHubTokenMissing(
      `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`,
    )
  })

  const loadCatalog = useEffectEvent(async () => {
    if (hasCatalog.current || oauthNavigationStarted.current) return

    const requestId = ++latestRequestId.current
    // Classify this request before awaiting, even if its target or URL changes later.
    const returnStatusId = new URL(window.location.href).searchParams.get(
      ADD_REPOSITORY_RETURN_PARAM,
    )
    const wasResumedPicker =
      returnStatusId !== null && returnStatusId === statusId
    setState((currentState) => ({
      ...currentState,
      error: null,
      isLoading: true,
    }))

    try {
      const result = await getAuthenticatedRepositoryCatalog()
      // A newer opening is in flight. This answer must not replace its state.
      if (requestId !== latestRequestId.current) return

      if (!result.success) {
        if (result.errorCode === 'GITHUB_TOKEN_MISSING') {
          const wasHandledByRefresh = refreshAuthentication(wasResumedPicker)
          // Navigation is asynchronous: keep the loading state until this page unloads.
          if (wasHandledByRefresh) {
            oauthNavigationStarted.current = true
            return
          }
        }

        setState({ catalog: null, error: result.error, isLoading: false })
        return
      }

      hasCatalog.current = true
      clearGitHubRefreshAttempts()
      setState({ catalog: result.data, error: null, isLoading: false })
    } catch (error) {
      Sentry.captureException(error, {
        tags: { action: 'fetchRepositoryCatalog' },
      })
      if (requestId !== latestRequestId.current) return
      setState({
        catalog: null,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch repositories',
        isLoading: false,
      })
    }
  })

  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler -- controlled picker open state triggers one cached Server Action */
  useEffect(() => {
    if (isOpen) {
      void loadCatalog()
    }
  }, [isOpen])
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */

  const organizations = state.catalog?.organizations ?? EMPTY_ORGANIZATIONS
  const filteredOrganizations = useMemo(
    () =>
      organizations.filter(
        (organization) =>
          organization.login.toLowerCase() !==
          state.catalog?.currentUser.login.toLowerCase(),
      ),
    [organizations, state.catalog?.currentUser.login],
  )

  return {
    currentUser: state.catalog?.currentUser ?? null,
    organizations,
    filteredOrganizations,
    userRepos: state.catalog?.repositories ?? EMPTY_REPOSITORIES,
    // An already-open picker must show loading before its first effect commits.
    isLoadingCatalog:
      state.isLoading ||
      (isOpen && state.catalog === null && state.error === null),
    catalogError: state.error,
  }
}
