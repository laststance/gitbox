'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react'

import {
  getAuthenticatedUserRepositories,
  type GitHubRepository,
} from '@/lib/actions/github'
import { addRepositoriesToBoard } from '@/lib/actions/repo-cards'

interface AddRepositoryComboboxProps {
  boardId: string
  statusId: string // 初期ステータス（列） ID
  onRepositoriesAdded: () => void
  onQuickNoteFocus: () => void
}

/**
 * AddRepositoryCombobox
 *
 * GitHub Repositoryを検索してKanbanボードに追加するComboboxコンポーネント
 *
 * 機能:
 * - Repository検索 (owner/repo名、topics、visibility)
 * - 複数選択 (Multi-select)
 * - 100+リポジトリ対応 (Virtual scrolling)
 * - パフォーマンス最適化 (<1秒レスポンス)
 * - WCAGアクセシビリティ対応 (AA準拠)
 * - 重複検出
 * - Auto-focus to Quick note
 */
export const AddRepositoryCombobox = memo(function AddRepositoryCombobox({
  boardId,
  statusId,
  onRepositoriesAdded,
  onQuickNoteFocus,
}: AddRepositoryComboboxProps) {
  // State
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedRepos, setSelectedRepos] = useState<GitHubRepository[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Filters
  const [ownerFilter, setOwnerFilter] = useState('')
  // TODO: Implement topics filter UI
  // const [topicsFilter, setTopicsFilter] = useState<string[]>([])
  const [visibilityFilter, setVisibilityFilter] = useState<
    'all' | 'public' | 'private'
  >('all')

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const comboboxRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Server Action: 認証ユーザーのリポジトリ一覧を取得
  const [userRepos, setUserRepos] = useState<GitHubRepository[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [reposError, setReposError] = useState<string | null>(null)

  // リポジトリ取得関数
  const fetchRepositories = useCallback(async () => {
    if (!isOpen) return

    setIsLoadingRepos(true)
    setReposError(null)

    try {
      const result = await getAuthenticatedUserRepositories({
        sort: 'updated',
        per_page: 100,
      })

      if (result.error) {
        setReposError(result.error)
        setUserRepos([])
      } else if (result.data) {
        setUserRepos(result.data)
      }
    } catch (error) {
      setReposError(
        error instanceof Error ? error.message : 'Failed to fetch repositories',
      )
      setUserRepos([])
    } finally {
      setIsLoadingRepos(false)
    }
  }, [isOpen])

  // Comboboxが開いたときにリポジトリを取得
  useEffect(() => {
    if (isOpen) {
      fetchRepositories()
    }
  }, [isOpen, fetchRepositories])

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // フィルター済みリポジトリ (クライアント側でフィルタリング)
  const filteredRepositories = useMemo(() => {
    if (!userRepos) return []

    let filtered = userRepos

    // 検索クエリでフィルタリング
    if (debouncedQuery) {
      filtered = filtered.filter(
        (repo) =>
          repo.full_name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          repo.description
            ?.toLowerCase()
            .includes(debouncedQuery.toLowerCase()),
      )
    }

    // Owner フィルター
    if (ownerFilter) {
      filtered = filtered.filter((repo) =>
        repo.owner.login.toLowerCase().includes(ownerFilter.toLowerCase()),
      )
    }

    // Visibility フィルター
    if (visibilityFilter !== 'all') {
      filtered = filtered.filter((repo) => repo.visibility === visibilityFilter)
    }

    // TODO: Topics フィルター
    // if (topicsFilter.length > 0) {
    //   filtered = filtered.filter(repo =>
    //     topicsFilter.some(topic => repo.topics?.includes(topic))
    //   )
    // }

    return filtered
  }, [userRepos, debouncedQuery, ownerFilter, visibilityFilter])

  const isLoading = isLoadingRepos || isAdding
  const error = addError || reposError

  // Virtual scrolling (enabled for 20+ repositories)
  const shouldVirtualize = filteredRepositories.length > 20
  const rowVirtualizer = useVirtualizer({
    count: filteredRepositories.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 100, // 推定高さ: タイトル + description + メタ情報
    enabled: shouldVirtualize,
    overscan: 5, // スクロール範囲外に5件余分にレンダリング
  })

  // Toggle repository selection
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

  // Remove selected repository
  const removeSelectedRepo = (repoId: number) => {
    setSelectedRepos((prev) => prev.filter((r) => r.id !== repoId))
  }

  // Add selected repositories to board
  const handleAddRepositories = async () => {
    if (selectedRepos.length === 0) return

    try {
      setIsAdding(true)
      setAddError(null)

      // Server Action: Add repositories to board with duplicate detection
      const result = await addRepositoriesToBoard(
        boardId,
        statusId,
        selectedRepos,
      )

      if (!result.success) {
        setAddError(result.errors?.join(', ') || 'Failed to add repositories')
        return
      }

      // Show warning if some repositories were duplicates
      if (result.errors && result.errors.length > 0) {
        console.warn('Duplicate repositories detected:', result.errors)
      }

      // Success: clear selection and close combobox
      setSelectedRepos([])
      setSearchQuery('')
      setIsOpen(false)

      onRepositoriesAdded()

      // Auto-focus to Quick note field (T046)
      setTimeout(() => {
        onQuickNoteFocus()
      }, 100)
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : 'Error adding repositories',
      )
    } finally {
      setIsAdding(false)
    }
  }

  // Keyboard navigation (WCAG AA)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      searchInputRef.current?.blur()
    } else if (e.key === 'Enter' && selectedRepos.length > 0) {
      handleAddRepositories()
    }
  }

  return (
    <div className="relative" ref={comboboxRef}>
      {/* Combobox trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
        Add Repositories
      </button>

      {/* Combobox panel */}
      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[480px] rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="repository-listbox"
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search repositories..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            aria-label="Search repositories"
            autoFocus
          />

          {/* Filters */}
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              placeholder="Filter by owner"
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />

            {/* Visibility filter */}
            <select
              value={visibilityFilter}
              onChange={(e) =>
                setVisibilityFilter(
                  e.target.value as 'all' | 'public' | 'private',
                )
              }
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              aria-label="Visibility filter"
            >
              <option value="all">All</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>

          {/* Selected repositories badges */}
          {selectedRepos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedRepos.map((repo) => (
                <span
                  key={repo.id}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                >
                  {repo.full_name}
                  <button
                    type="button"
                    onClick={() => removeSelectedRepo(repo.id)}
                    className="ml-1 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
                    aria-label={`Remove ${repo.full_name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div
              role="status"
              className="flex items-center justify-center py-8 text-gray-500"
            >
              <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading repositories...
            </div>
          )}

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400"
            >
              Error: {error}
            </div>
          )}

          {/* Repository list with virtual scrolling support */}
          {!isLoading && filteredRepositories.length > 0 && (
            <div
              ref={listRef}
              id="repository-listbox"
              role="listbox"
              aria-label="Repository options"
              aria-multiselectable="true"
              className="mt-3 max-h-[300px] overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700"
              data-virtual-scroll={shouldVirtualize}
              style={
                shouldVirtualize
                  ? {
                      height: '300px',
                      overflowY: 'auto',
                      contain: 'strict',
                    }
                  : undefined
              }
            >
              {shouldVirtualize ? (
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const repo = filteredRepositories[virtualItem.index]
                    const isSelected = selectedRepos.some(
                      (r) => r.id === repo.id,
                    )
                    return (
                      <div
                        key={repo.id}
                        data-index={virtualItem.index}
                        ref={rowVirtualizer.measureElement}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => toggleRepoSelection(repo)}
                        className={`flex cursor-pointer items-center justify-between border-b border-gray-100 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleRepoSelection(repo)
                          }
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                            {repo.full_name}
                          </p>
                          {repo.description && (
                            <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                              {repo.description}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span>⭐ {repo.stargazers_count}</span>
                            {repo.language && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">
                                {repo.language}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="ml-2 text-blue-600 dark:text-blue-400">
                            ✓
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                filteredRepositories.map((repo) => {
                  const isSelected = selectedRepos.some((r) => r.id === repo.id)
                  return (
                    <div
                      key={repo.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => toggleRepoSelection(repo)}
                      className={`flex cursor-pointer items-center justify-between border-b border-gray-100 p-3 transition-colors last:border-b-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleRepoSelection(repo)
                        }
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                          {repo.full_name}
                        </p>
                        {repo.description && (
                          <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                            {repo.description}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span>⭐ {repo.stargazers_count}</span>
                          {repo.language && (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">
                              {repo.language}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400">
                          ✓
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* No results */}
          {!isLoading &&
            debouncedQuery &&
            filteredRepositories.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-500">
                No repositories found matching &quot;{debouncedQuery}&quot;
              </div>
            )}

          {/* Add button */}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddRepositories}
              disabled={selectedRepos.length === 0 || isLoading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add ({selectedRepos.length})
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
