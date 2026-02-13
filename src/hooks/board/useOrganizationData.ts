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

      if (userResult.success) {
        setCurrentUser(userResult.data)
      }

      if (orgsResult.success) {
        setOrganizations(orgsResult.data)
      }
    } catch (error) {
      Sentry.captureException(error, { tags: { action: 'fetchOrganizations' } })
    } finally {
      setIsLoadingOrgs(false)
    }
  })

  /* eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change -- data fetching on open is a valid effect */
  useEffect(() => {
    if (isOpen) {
      fetchOrganizations()
    }
  }, [isOpen])
  /* eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */

  const filteredOrganizations = useMemo(
    () =>
      organizations.filter(
        (org) => org.login.toLowerCase() !== currentUser?.login?.toLowerCase(),
      ),
    [organizations, currentUser?.login],
  )

  return { currentUser, organizations, filteredOrganizations, isLoadingOrgs }
}
