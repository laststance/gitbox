/**
 * useOrganizationData Hook
 *
 * Fetches and manages the authenticated user's profile and GitHub organizations.
 * Triggers on combobox open. Filters out the current user from the org list to
 * avoid duplicate Radix Select values.
 *
 * @example
 * const { currentUser, filteredOrganizations, isLoadingOrgs } =
 *   useOrganizationData(isOpen)
 */

import * as Sentry from '@sentry/nextjs'
import { useState, useEffect, useEffectEvent, useMemo } from 'react'

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

interface UseOrganizationDataReturn {
  currentUser: GitHubUser | null
  organizations: GitHubOrganization[]
  /** Organizations excluding currentUser (prevents duplicate SelectItem values) */
  filteredOrganizations: GitHubOrganization[]
  isLoadingOrgs: boolean
}

/**
 * Fetches authenticated user and organizations when combobox opens.
 *
 * @param isOpen - Whether the combobox is currently open
 * @returns Organization data and loading state
 */
export function useOrganizationData(
  isOpen: boolean,
): UseOrganizationDataReturn {
  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(null)
  const [organizations, setOrganizations] = useState<GitHubOrganization[]>([])
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false)

  const fetchOrganizations = useEffectEvent(async () => {
    setIsLoadingOrgs(true)

    try {
      const [userResult, orgsResult] = await Promise.all([
        getAuthenticatedUser(),
        getAuthenticatedUserOrganizations(),
      ])

      // If either call surfaces a missing token, fire silent refresh once.
      // The handler is idempotent, so duplicate calls from this hook + the
      // sibling useRepositoryData hook collapse into a single redirect.
      const hasTokenMissing =
        (!userResult.success &&
          userResult.errorCode === 'GITHUB_TOKEN_MISSING') ||
        (!orgsResult.success && orgsResult.errorCode === 'GITHUB_TOKEN_MISSING')
      if (hasTokenMissing) {
        const wasHandledByRefresh = handleGitHubTokenMissing(
          window.location.pathname,
        )
        if (wasHandledByRefresh) return
        // Iframe context: the handler can't navigate, so fall through to
        // populate whichever calls succeeded. The combobox renders the
        // partial data; useRepositoryData surfaces the auth error.
      }

      if (userResult.success) {
        setCurrentUser(userResult.data)
      }

      if (orgsResult.success) {
        setOrganizations(orgsResult.data)
      }

      // At least one call succeeded means the token is alive — reset the
      // refresh attempt counter so a future expiry starts fresh from 1.
      if (userResult.success || orgsResult.success) {
        clearGitHubRefreshAttempts()
      }
    } catch (error) {
      Sentry.captureException(error, { tags: { action: 'fetchOrganizations' } })
    } finally {
      setIsLoadingOrgs(false)
    }
  })

  /* eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change, react-you-might-not-need-an-effect/no-event-handler -- data fetching on open is a valid effect */
  useEffect(() => {
    if (isOpen) {
      fetchOrganizations()
    }
  }, [isOpen])
  /* eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change, react-you-might-not-need-an-effect/no-event-handler */

  const filteredOrganizations = useMemo(
    () =>
      organizations.filter(
        (org) => org.login.toLowerCase() !== currentUser?.login?.toLowerCase(),
      ),
    [organizations, currentUser?.login],
  )

  return { currentUser, organizations, filteredOrganizations, isLoadingOrgs }
}
