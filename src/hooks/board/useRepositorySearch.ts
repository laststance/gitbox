/**
 * useRepositorySearch Hook
 *
 * Manages search query, multi-select state, and add-to-board operation state
 * for the AddRepositoryCombobox component.
 *
 * @example
 * const search = useRepositorySearch()
 * <input value={search.searchQuery} onChange={e => search.setSearchQuery(e.target.value)} />
 */

import { useState, useDeferredValue } from 'react'

import type { GitHubRepository } from '@/lib/actions/github'

interface UseRepositorySearchReturn {
  searchQuery: string
  setSearchQuery: (query: string) => void
  /** Deferred value for non-blocking filtering during heavy renders */
  deferredSearchQuery: string
  selectedRepos: GitHubRepository[]
  setSelectedRepos: React.Dispatch<React.SetStateAction<GitHubRepository[]>>
  isAdding: boolean
  setIsAdding: (adding: boolean) => void
  addError: string | null
  setAddError: (error: string | null) => void
  /** Toggle a repository in/out of the selection */
  toggleRepoSelection: (repo: GitHubRepository) => void
  /** Remove a repository from the selection by id */
  removeSelectedRepo: (repoId: number) => void
}

/**
 * Hook for repository search, selection, and add operation state.
 *
 * @returns Search state, selection actions, and add operation state
 */
export function useRepositorySearch(): UseRepositorySearchReturn {
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [selectedRepos, setSelectedRepos] = useState<GitHubRepository[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const toggleRepoSelection = (repo: GitHubRepository) => {
    setSelectedRepos((prev) => {
      const isSelected = prev.some((r) => r.id === repo.id)
      if (isSelected) {
        return prev.filter((r) => r.id !== repo.id)
      } else {
        return [...prev, repo]
      }
    })
  }

  const removeSelectedRepo = (repoId: number) => {
    setSelectedRepos((prev) => prev.filter((r) => r.id !== repoId))
  }

  return {
    searchQuery,
    setSearchQuery,
    deferredSearchQuery,
    selectedRepos,
    setSelectedRepos,
    isAdding,
    setIsAdding,
    addError,
    setAddError,
    toggleRepoSelection,
    removeSelectedRepo,
  }
}
