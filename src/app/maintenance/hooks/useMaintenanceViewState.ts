/**
 * View State Hook for Maintenance Page
 *
 * Manages view mode, search, sorting, and computes filtered/sorted repos.
 *
 * @example
 * const { viewMode, setViewMode, search, setSearch, sortedRepos } =
 *   useMaintenanceViewState({ repos })
 */

import { useState, useMemo } from 'react'

import type { MaintenanceRepo } from '../MaintenanceClient'

type ViewMode = 'grid' | 'list'
type SortOption = 'name' | 'updated' | 'stars'

interface UseMaintenanceViewStateProps {
  repos: MaintenanceRepo[]
}

/**
 * Hook for managing maintenance page view state
 *
 * @param props.repos - Array of maintenance repos to display
 * @returns View state and sorted/filtered repo list
 */
export function useMaintenanceViewState({
  repos,
}: UseMaintenanceViewStateProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('updated')
  const [sortAsc, setSortAsc] = useState(false)

  // Filter repos based on search (searches owner/name only - notes are in projectinfo)
  const filteredRepos = useMemo(
    () =>
      repos.filter((repo) =>
        `${repo.repo_owner}/${repo.repo_name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [repos, search],
  )

  // Sort repos
  const sortedRepos = useMemo(() => {
    const sorted = [...filteredRepos].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = `${a.repo_owner}/${a.repo_name}`.localeCompare(
            `${b.repo_owner}/${b.repo_name}`,
          )
          break
        case 'updated':
          comparison =
            new Date(b.updated_at || 0).getTime() -
            new Date(a.updated_at || 0).getTime()
          break
        case 'stars':
          comparison = (b.meta?.stars || 0) - (a.meta?.stars || 0)
          break
      }
      return sortAsc ? -comparison : comparison
    })
    return sorted
  }, [filteredRepos, sortBy, sortAsc])

  return {
    viewMode,
    setViewMode,
    search,
    setSearch,
    sortBy,
    setSortBy,
    sortAsc,
    setSortAsc,
    sortedRepos,
  }
}
