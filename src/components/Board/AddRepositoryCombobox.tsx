'use client'

import * as Sentry from '@sentry/nextjs'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useState,
  useEffect,
  useEffectEvent,
  useRef,
  useMemo,
  memo,
  useCallback,
  useDeferredValue,
} from 'react'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getAuthenticatedUserRepositories,
  getAuthenticatedUser,
  getAuthenticatedUserOrganizations,
  getOrganizationRepositories,
  type GitHubRepository,
  type GitHubUser,
  type GitHubOrganization,
} from '@/lib/actions/github'
import {
  addRepositoriesToBoard,
  type CreatedRepoCard,
} from '@/lib/actions/repo-cards'
import { selectRepoCards } from '@/lib/redux/slices/boardSlice'
import {
  selectOrganizationFilter,
  setOrganizationFilter,
} from '@/lib/redux/slices/settingsSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'

interface AddRepositoryComboboxProps {
  boardId: string
  statusId: string // Initial status (column) ID
  /**
   * Callback when repositories are successfully added
   * @param cards - The created repo cards for optimistic UI update
   */
  onRepositoriesAdded: (cards: CreatedRepoCard[]) => void
  onQuickNoteFocus: () => void
  /**
   * Controlled mode: External open state
   * When provided, the component uses this value instead of internal state
   */
  isOpen?: boolean
  /**
   * Controlled mode: Callback when open state changes
   * Called when the combobox should open or close
   */
  onOpenChange?: (open: boolean) => void
  /**
   * Lowercase "owner/repo" identifiers of repos in maintenance mode.
   * These repos will be filtered out from the combobox options.
   */
  maintenanceRepoIdentifiers?: string[]
}

/**
 * Add Repository Combobox Component
 *
 * A combobox for searching and adding GitHub repositories to a Kanban board.
 * - Repository search (owner/repo name, topics, visibility)
 * - Multi-select support
 * - Virtual scrolling for 100+ repositories
 * - Performance optimized (<1s response)
 * - WCAG AA accessibility compliance
 * - Duplicate detection
 * - Auto-focus to Quick note after adding
 */
export const AddRepositoryCombobox = memo(function AddRepositoryCombobox({
  boardId,
  statusId,
  onRepositoriesAdded,
  onQuickNoteFocus,
  isOpen: controlledIsOpen,
  onOpenChange,
  maintenanceRepoIdentifiers,
}: AddRepositoryComboboxProps) {
  // State - supports both controlled and uncontrolled modes
  const [internalIsOpen, setInternalIsOpen] = useState(false)

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen ?? internalIsOpen

  /**
   * Toggle the combobox open state
   * Used for the main trigger button
   */
  const handleToggleOpen = () => {
    const newOpen = !isOpen
    if (onOpenChange) {
      onOpenChange(newOpen)
    } else {
      setInternalIsOpen(newOpen)
    }
  }

  /**
   * Close the combobox
   * Used for Cancel button and after successful add
   */
  const handleClose = () => {
    if (onOpenChange) {
      onOpenChange(false)
    } else {
      setInternalIsOpen(false)
    }
  }

  const [searchQuery, setSearchQuery] = useState('')
  // useDeferredValue replaces manual setTimeout debouncing
  // React automatically defers the value during heavy renders
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [selectedRepos, setSelectedRepos] = useState<GitHubRepository[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Filters (organizationFilter persisted to localStorage via Redux)
  const dispatch = useAppDispatch()
  // Nullish coalescing ensures safe default during Redux hydration (fixes GITBOX-1)
  const organizationFilter = useAppSelector(selectOrganizationFilter) ?? 'all'
  const [visibilityFilter, setVisibilityFilter] = useState<
    'all' | 'public' | 'private'
  >('all')

  // Get existing repo cards on this board for duplicate filtering
  const existingRepoCards = useAppSelector(selectRepoCards)

  /**
   * Set of "owner/repo" identifiers for repos already on the board.
   * Used to filter out duplicates from the combobox options.
   * @example Set { "facebook/react", "vercel/next.js" }
   */
  const existingRepoIdentifiers = useMemo(
    () =>
      new Set(
        existingRepoCards.map(
          (card) =>
            `${card.repoOwner.toLowerCase()}/${card.repoName.toLowerCase()}`,
        ),
      ),
    [existingRepoCards],
  )

  /**
   * Set of "owner/repo" identifiers for repos in maintenance mode.
   * Used to filter these repos from the combobox options.
   * @example Set { "archived/project", "old/repo" }
   */
  const maintenanceIdentifiers = useMemo(
    () => new Set(maintenanceRepoIdentifiers || []),
    [maintenanceRepoIdentifiers],
  )

  // Organization filter state
  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(null)
  const [organizations, setOrganizations] = useState<GitHubOrganization[]>([])
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false)

  /**
   * Filter organizations to exclude currentUser (prevents duplicate SelectItem values)
   * This avoids Radix Select reconciliation issues when the same value appears multiple times
   */
  const filteredOrganizations = useMemo(
    () =>
      organizations.filter(
        (org) => org.login.toLowerCase() !== currentUser?.login?.toLowerCase(),
      ),
    [organizations, currentUser?.login],
  )

  /**
   * Guarded organization filter change handler
   * Dispatches Redux action to persist organization filter to localStorage
   */
  const handleOrganizationFilterChange = useCallback(
    (value: string) => {
      if (value !== organizationFilter) {
        dispatch(setOrganizationFilter(value))
      }
    },
    [dispatch, organizationFilter],
  )

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const comboboxRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Server Action: Fetch authenticated user's repository list
  const [userRepos, setUserRepos] = useState<GitHubRepository[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [reposError, setReposError] = useState<string | null>(null)

  /**
   * Fetch repositories from GitHub API
   * Uses useEffectEvent to avoid circular dependencies with isOpen
   * The effect that calls this already guards with `if (isOpen)`
   */
  const fetchRepositories = useEffectEvent(async () => {
    setIsLoadingRepos(true)
    setReposError(null)

    try {
      // Fetch ALL repos with pagination to ensure all repos are available
      // This fixes the bug where repos beyond the first 100 were not visible
      const result = await getAuthenticatedUserRepositories({
        sort: 'updated',
        per_page: 100,
        fetchAll: true, // Enable pagination to fetch all repos
      })

      if (!result.success) {
        setReposError(result.error)
        setUserRepos([])
        return
      }

      const allRepos = [...result.data]

      // Additionally fetch organization repos to ensure org repos are visible
      // The /user/repos API may not return all org repos, so we need to supplement
      // with /orgs/{org}/repos for each organization the user belongs to
      if (organizations.length > 0) {
        const orgRepoPromises = organizations.map(async (org) =>
          getOrganizationRepositories(org.login, { fetchAll: true }),
        )
        const orgResults = await Promise.all(orgRepoPromises)

        // Merge org repos with user repos, deduplicating by repo id
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

  /**
   * Fetch current user and organizations for the Organization Filter
   * Uses useEffectEvent to avoid circular dependencies with isOpen
   * The effect that calls this already guards with `if (isOpen)`
   */
  const fetchOrganizations = useEffectEvent(async () => {
    setIsLoadingOrgs(true)

    try {
      // Fetch user and organizations in parallel
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

  // Fetch organizations when combobox opens
  // fetchOrganizations is useEffectEvent - no deps needed for event callbacks
  useEffect(() => {
    if (isOpen) {
      fetchOrganizations()
    }
  }, [isOpen])

  // Fetch repositories after organizations are loaded (or if no orgs)
  // This ensures org repos are included in the fetch
  // fetchRepositories is useEffectEvent - no deps needed for event callbacks
  useEffect(() => {
    if (isOpen && !isLoadingOrgs) {
      fetchRepositories()
    }
  }, [isOpen, isLoadingOrgs])

  // Filtered repositories (client-side filtering)
  const filteredRepositories = useMemo(() => {
    if (!userRepos) return []

    let filtered = userRepos

    // Filter out repos already on this board (highest priority filter)
    filtered = filtered.filter(
      (repo) => !existingRepoIdentifiers.has(repo.full_name.toLowerCase()),
    )

    // Filter out repos in maintenance mode
    filtered = filtered.filter(
      (repo) => !maintenanceIdentifiers.has(repo.full_name.toLowerCase()),
    )

    // Filter by search query (uses deferred value for non-blocking filtering)
    if (deferredSearchQuery) {
      filtered = filtered.filter(
        (repo) =>
          repo.full_name
            .toLowerCase()
            .includes(deferredSearchQuery.toLowerCase()) ||
          repo.description
            ?.toLowerCase()
            .includes(deferredSearchQuery.toLowerCase()),
      )
    }

    // Organization filter (exact match on owner login)
    // Defensive null check for repos with missing owner data (GITBOX-1 fix)
    if (organizationFilter !== 'all') {
      filtered = filtered.filter(
        (repo) =>
          repo.owner?.login?.toLowerCase() === organizationFilter.toLowerCase(),
      )
    }

    // Visibility filter
    if (visibilityFilter !== 'all') {
      filtered = filtered.filter((repo) => repo.visibility === visibilityFilter)
    }

    return filtered
  }, [
    userRepos,
    deferredSearchQuery,
    organizationFilter,
    visibilityFilter,
    existingRepoIdentifiers,
    maintenanceIdentifiers,
  ])

  const isLoading = isLoadingRepos || isAdding
  const error = addError || reposError

  // Virtual scrolling (enabled for 20+ repositories)
  const shouldVirtualize = filteredRepositories.length > 20
  const rowVirtualizer = useVirtualizer({
    count: filteredRepositories.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 100, // Estimated height: title + description + metadata
    enabled: shouldVirtualize,
    overscan: 5, // Render 5 extra items outside scroll area
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
        toast.warning('Some repositories already exist', {
          description: result.errors.join(', '),
        })
      }

      // Show success toast
      toast.success(
        `${result.addedCount} ${result.addedCount === 1 ? 'repository' : 'repositories'} added`,
        {
          description:
            result.addedCount === 1 && selectedRepos[0]
              ? `"${selectedRepos[0].full_name}" has been added to the board.`
              : `${result.addedCount} repositories have been added to the board.`,
        },
      )

      // Success: clear selection and close combobox
      setSelectedRepos([])
      setSearchQuery('')
      // Close combobox (supports both controlled and uncontrolled modes)
      if (onOpenChange) {
        onOpenChange(false)
      } else {
        setInternalIsOpen(false)
      }

      // Pass created cards for optimistic UI update (no page reload needed)
      onRepositoriesAdded(result.cards || [])

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
      // Close combobox (supports both controlled and uncontrolled modes)
      if (onOpenChange) {
        onOpenChange(false)
      } else {
        setInternalIsOpen(false)
      }
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
        onClick={handleToggleOpen}
        className="border-input bg-background text-foreground hover:bg-accent focus:ring-primary inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium shadow-sm focus:ring-2 focus:outline-none"
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
          className="border-border bg-background absolute top-full right-0 z-50 mt-2 w-120 rounded-lg border p-4 shadow-xl"
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
            className="border-input bg-background text-foreground focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            aria-label="Search repositories"
            autoFocus
          />

          {/* Filters */}
          <div className="mt-3 flex gap-2">
            {/* Organization Filter */}
            <Select
              value={organizationFilter}
              onValueChange={handleOrganizationFilterChange}
            >
              <SelectTrigger
                className="h-9 flex-1 text-sm"
                aria-label="Organization filter"
              >
                <SelectValue placeholder="Organization Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {currentUser && (
                  <SelectItem value={currentUser.login}>
                    {currentUser.login} (Personal)
                  </SelectItem>
                )}
                {filteredOrganizations.map((org) => (
                  <SelectItem key={org.id} value={org.login}>
                    {org.login}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Loading indicator for organizations */}
            {isLoadingOrgs && (
              <span className="text-muted-foreground self-center text-xs">
                Loading orgs...
              </span>
            )}

            {/* Visibility filter */}
            <select
              value={visibilityFilter}
              onChange={(e) =>
                setVisibilityFilter(
                  e.target.value as 'all' | 'public' | 'private',
                )
              }
              className="border-input bg-background text-foreground focus:border-primary rounded-md border px-3 py-1.5 text-sm focus:outline-none"
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
                  className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                >
                  {repo.full_name}
                  <button
                    type="button"
                    onClick={() => removeSelectedRepo(repo.id)}
                    className="hover:bg-primary/20 ml-1 rounded-full p-0.5"
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
              className="text-muted-foreground flex items-center justify-center py-8"
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
              className="border-border mt-3 max-h-75 overflow-y-auto rounded-md border"
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
                    if (!repo) return null
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
                        className={`border-border hover:bg-accent flex cursor-pointer items-center justify-between border-b p-3 transition-colors ${isSelected ? 'bg-accent' : ''}`}
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
                          <p className="text-foreground truncate font-medium">
                            {repo.full_name}
                          </p>
                          {repo.description && (
                            <p className="text-muted-foreground mt-0.5 truncate text-sm">
                              {repo.description}
                            </p>
                          )}
                          <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                            <span>⭐ {repo.stargazers_count}</span>
                            {repo.language && (
                              <span className="bg-muted rounded px-1.5 py-0.5">
                                {repo.language}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-primary ml-2">✓</span>
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
                      className={`border-border hover:bg-accent flex cursor-pointer items-center justify-between border-b p-3 transition-colors last:border-b-0 ${isSelected ? 'bg-accent' : ''}`}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleRepoSelection(repo)
                        }
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate font-medium">
                          {repo.full_name}
                        </p>
                        {repo.description && (
                          <p className="text-muted-foreground mt-0.5 truncate text-sm">
                            {repo.description}
                          </p>
                        )}
                        <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                          <span>⭐ {repo.stargazers_count}</span>
                          {repo.language && (
                            <span className="bg-muted rounded px-1.5 py-0.5">
                              {repo.language}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-primary ml-2">✓</span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* No results */}
          {!isLoading &&
            deferredSearchQuery &&
            filteredRepositories.length === 0 && (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No repositories found matching &quot;{deferredSearchQuery}&quot;
              </div>
            )}

          {/* Add button */}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="border-input bg-background text-foreground hover:bg-accent rounded-md border px-4 py-2 text-sm font-medium"
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
