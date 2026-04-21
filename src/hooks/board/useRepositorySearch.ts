/**
 * useRepositorySearch Hook
 *
 * Manages search query, multi-select state, and add-to-board operation state
 * for the AddRepositoryCombobox component.
 *
 * All state mutations are exposed as semantic actions — no raw setState setters.
 *
 * @example
 * const search = useRepositorySearch()
 * <input value={search.searchQuery} onChange={e => search.updateSearch(e.target.value)} />
 * search.startAdding()
 * search.finishAdding()
 * search.clearSelection()
 */

import { useCallback, useState, useDeferredValue } from 'react'

import type { GitHubRepository } from '@/lib/actions/github'

interface UseRepositorySearchReturn {
  /** Current search query string */
  searchQuery: string
  /** Update the search query */
  updateSearch: (query: string) => void
  /** Deferred value for non-blocking filtering during heavy renders */
  deferredSearchQuery: string
  /** Currently selected repositories */
  selectedRepos: GitHubRepository[]
  /** Toggle a repository in/out of the selection */
  toggleRepoSelection: (repo: GitHubRepository) => void
  /** Remove a repository from the selection by id */
  removeSelectedRepo: (repoId: number) => void
  /** Clear all selected repositories */
  clearSelection: () => void
  /** Whether an add operation is in progress */
  isAdding: boolean
  /** Mark the start of an add operation (sets isAdding=true, clears error) */
  startAdding: () => void
  /** Mark the end of an add operation (sets isAdding=false) */
  finishAdding: () => void
  /** Current error message from the add operation */
  addError: string | null
  /** Set an error message for the add operation */
  setAddingError: (error: string) => void
  /** Clear the add operation error */
  clearError: () => void
}

/**
 * Hook for repository search, selection, and add operation state.
 *
 * @returns Search state, selection actions, and add operation state
 *
 * @example
 * const { searchQuery, updateSearch, startAdding, finishAdding } = useRepositorySearch()
 * // In handleAdd:
 * startAdding()
 * try { await addRepos(...) } finally { finishAdding() }
 */
export function useRepositorySearch(): UseRepositorySearchReturn {
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [selectedRepos, setSelectedRepos] = useState<GitHubRepository[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const updateSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const toggleRepoSelection = useCallback((repo: GitHubRepository) => {
    setSelectedRepos((prev) => {
      if (prev.some((r) => r.id === repo.id)) {
        return prev.filter((r) => r.id !== repo.id)
      }
      return [...prev, repo]
    })
  }, [])

  const removeSelectedRepo = useCallback((repoId: number) => {
    setSelectedRepos((prev) => prev.filter((r) => r.id !== repoId))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedRepos([])
  }, [])

  const startAdding = useCallback(() => {
    setIsAdding(true)
    setAddError(null)
  }, [])

  const finishAdding = useCallback(() => {
    setIsAdding(false)
  }, [])

  const setAddingError = useCallback((error: string) => {
    setAddError(error)
  }, [])

  const clearError = useCallback(() => {
    setAddError(null)
  }, [])

  return {
    searchQuery,
    updateSearch,
    deferredSearchQuery,
    selectedRepos,
    toggleRepoSelection,
    removeSelectedRepo,
    clearSelection,
    isAdding,
    startAdding,
    finishAdding,
    addError,
    setAddingError,
    clearError,
  }
}
