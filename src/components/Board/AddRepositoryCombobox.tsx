'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { Globe } from 'lucide-react'
import { useState, useRef, useMemo, memo, useCallback } from 'react'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRepoPlacements } from '@/hooks/board/useRepoPlacements'
import { useRepositoryCatalog } from '@/hooks/board/useRepositoryCatalog'
import { useRepositorySearch } from '@/hooks/board/useRepositorySearch'
import type { GitHubRepository } from '@/lib/actions/github'
import type { BoardPlacement } from '@/lib/actions/repo-card-duplicates'
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
import type { BoardId, StatusListId } from '@/lib/types/brands'
import type { RepoIdentifier } from '@/lib/types/domain-primitives'
import { toRepoIdentifier } from '@/lib/utils/to-repo-identifier'

import { HeldRepositoryList, type HeldRepository } from './HeldRepositoryList'

/**
 * Id of the sentence shown when the board is shared through a public link.
 * The Add button is described by it.
 */
const SHARED_BOARD_TEXT_ID = 'add-repositories-shared-board'

/**
 * Colors of an option row of the list. Hovered or selected it has the accent
 * fill, and what stands under the repository's name (description, stars,
 * language) and the check mark take the color made for that fill. In the
 * muted color those lines were between 1.9:1 and 2.4:1 on it in six dark
 * themes, and the check mark in the theme color between 1.3:1 and 1.8:1.
 * src/tests/unit/styles/accent-fill-contrast.test.ts computes the contrast
 * of the color they have now. The lines and the check mark have no color of
 * their own: they inherit the row's.
 */
const OPTION_ROW_COLOR_CLASS =
  'text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground'

interface AddRepositoryComboboxProps {
  boardId: BoardId
  /**
   * Initial status (column) ID. `null` when the board has no columns yet —
   * adding is disabled in that case. Using `null` instead of a fake empty
   * string prevents invalid branded IDs from flowing into the server action.
   */
  statusId: StatusListId | null
  /**
   * Callback when repositories are successfully added
   * @param cards - The created repo cards for optimistic UI update
   */
  onRepositoriesAdded: (cards: CreatedRepoCard[]) => void
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
   * The board is shared through a public link. The picker then says that
   * anyone who has the link will see what is added, private repositories
   * included.
   */
  isBoardShared?: boolean
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
 * - One repository per user (Issue #215): repositories already on another
 *   board are listed under "Already placed elsewhere" with a link to where
 *   they live, instead of being offered
 * - On a board that is shared through a public link, a sentence above the
 *   buttons says who will see the added repositories
 */
export const AddRepositoryCombobox = memo(function AddRepositoryCombobox({
  boardId,
  statusId,
  onRepositoriesAdded,
  isOpen: controlledIsOpen,
  onOpenChange,
  isBoardShared = false,
}: AddRepositoryComboboxProps) {
  // State - supports both controlled and uncontrolled modes
  const [internalIsOpen, setInternalIsOpen] = useState(false)

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen ?? internalIsOpen

  /**
   * Toggle the combobox open state
   * Used for the main trigger button
   */
  const handleToggleOpen = (): void => {
    const newOpen = !isOpen
    clearSkippedMessages()
    if (onOpenChange) {
      onOpenChange(newOpen)
    } else {
      setInternalIsOpen(newOpen)
    }
  }

  /**
   * Close the combobox
   * Used for Cancel button, Escape and after successful add
   */
  const handleClose = (): void => {
    clearSkippedMessages()
    if (onOpenChange) {
      onOpenChange(false)
    } else {
      setInternalIsOpen(false)
    }
  }

  // --- Extracted hooks ---
  const {
    searchQuery,
    updateSearch,
    deferredSearchQuery,
    selectedRepos,
    isAdding,
    startAdding,
    finishAdding,
    addError,
    setAddingError,
    toggleRepoSelection,
    removeSelectedRepo,
    clearSelection,
    skippedMessages,
    showSkippedMessages,
    clearSkippedMessages,
  } = useRepositorySearch()

  const {
    currentUser,
    filteredOrganizations,
    userRepos,
    isLoadingCatalog,
    catalogError,
  } = useRepositoryCatalog(isOpen, statusId)

  // Where the user's repositories already live; fetched on every opening
  const { placements, isLoadingPlacements, refreshPlacements } =
    useRepoPlacements(isOpen)

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
        existingRepoCards.map((card) =>
          toRepoIdentifier(card.repoOwner, card.repoName),
        ),
      ),
    [existingRepoCards],
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
  const listRef = useRef<HTMLDivElement>(null)

  // Catalog repositories matching the search and both filters. The same
  // filters apply to the options and to the "Already placed elsewhere" list.
  const matchingRepositories = useMemo(() => {
    if (!userRepos) return []

    let filtered = userRepos

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
  }, [userRepos, deferredSearchQuery, organizationFilter, visibilityFilter])

  // Split into what can be added and what is already placed elsewhere
  const { addable: filteredRepositories, held: heldRepositories } = useMemo(
    () =>
      classifyRepositories({
        repositories: matchingRepositories,
        currentBoardId: boardId,
        currentBoardIdentifiers: existingRepoIdentifiers,
        placements,
      }),
    [matchingRepositories, boardId, existingRepoIdentifiers, placements],
  )

  // Options and held rows render only once both the catalog and the placements
  // have settled, so a held repository never flashes as selectable
  const isLoading = isLoadingCatalog || isLoadingPlacements || isAdding
  // A filter that hides everything is not an empty catalog: the empty states
  // below say which of the two the user is looking at
  const hasActiveFilter =
    organizationFilter !== 'all' || visibilityFilter !== 'all'
  const error = addError || catalogError

  // Virtual scrolling (enabled for 20+ repositories)
  const shouldVirtualize = filteredRepositories.length > 20
  const rowVirtualizer = useVirtualizer({
    count: filteredRepositories.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 100, // Estimated height: title + description + metadata
    enabled: shouldVirtualize,
    overscan: 5, // Render 5 extra items outside scroll area
  })

  // Add selected repositories to board
  const handleAddRepositories = async (): Promise<void> => {
    if (selectedRepos.length === 0) return
    if (!statusId) {
      setAddingError('Add a column before adding repositories')
      return
    }

    try {
      startAdding()

      // Server Action: Add repositories to board with duplicate detection
      const result = await addRepositoriesToBoard(
        boardId,
        statusId,
        selectedRepos,
      )

      if (!result.success) {
        setAddingError(result.error || 'Failed to add repositories')
        // A lost race means the server knows a placement this picker does
        // not: refetch so the raced repository moves to the held list
        void refreshPlacements()
        return
      }

      const { addedCount, cards, skipped } = result.data

      // Nothing added: not an error. The picker stays open, so refetch to move
      // the skipped repositories to the "Already placed elsewhere" list, clear
      // the selection (all of it was skipped) and say where each one lives.
      if (addedCount === 0) {
        void refreshPlacements()
        clearSelection()
        showSkippedMessages(skipped.map((skippedRepo) => skippedRepo.message))
        return
      }

      if (skipped.length > 0) {
        // Some added, some skipped: one toast, one sentence per line
        toast.warning(`${addedCount} added, ${skipped.length} skipped`, {
          description: (
            <>
              {skipped.map((skippedRepo) => (
                <span key={skippedRepo.fullName} className="block">
                  {skippedRepo.message}
                </span>
              ))}
            </>
          ),
        })
      } else {
        // All added. Text comes from the created cards, not from the selection
        const firstCard = cards[0]
        toast.success(
          `${addedCount} ${addedCount === 1 ? 'repository' : 'repositories'} added`,
          {
            description:
              addedCount === 1 && firstCard
                ? `"${firstCard.repoOwner}/${firstCard.repoName}" has been added to the board.`
                : `${addedCount} repositories have been added to the board.`,
          },
        )
      }

      // Success: clear selection and close combobox
      clearSelection()
      updateSearch('')
      handleClose()

      // Pass created cards for optimistic UI update (no page reload needed)
      onRepositoriesAdded(cards)
    } catch (err) {
      setAddingError(
        err instanceof Error ? err.message : 'Error adding repositories',
      )
    } finally {
      finishAdding()
    }
  }

  // Keyboard navigation (WCAG AA)
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    // Enter / Escape that confirm or cancel an IME conversion (e.g. Japanese
    // input) belong to the conversion. 229 covers Safari, where the confirming
    // keydown arrives after compositionend.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return

    if (e.key === 'Escape') {
      handleClose()
      searchInputRef.current?.blur()
    } else if (
      e.key === 'Enter' &&
      // Only Enter typed in the search box submits. Enter on Cancel, on a
      // badge's remove button or on an option row keeps its own meaning.
      e.target === searchInputRef.current &&
      selectedRepos.length > 0 &&
      // Same gate as the Add button: not while loading or while an add is in flight
      !isLoading
    ) {
      handleAddRepositories()
    }
  }

  return (
    <div>
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
          ref={trackButtonBottom}
          // --panel-top: 0.5rem below the button (--button-bottom, which
          // trackButtonBottom measures), but never so low that less than
          // 26rem is left above the 1rem that stays free under the panel:
          // then the panel moves up over the header, to 0.5rem from the top
          // edge at most. 26rem holds the search box, the filters, both
          // lists at their least height, the notice of a shared board and
          // Cancel / Add.
          // max-h: from that top edge down to 1rem above the bottom edge,
          // because with both lists full the panel is taller than a small
          // laptop screen.
          // flex-col: the two lists, which scroll by themselves, give up
          // height first (down to one row each), so the search box and
          // Cancel / Add stay in view. overflow-y-auto: on a window too short
          // even for that the whole panel scrolls.
          // fixed right-6: the panel ends at the right edge of the header
          // (px-6). Hung from the button's own right edge it began left of
          // the page wherever the button stood less than 480px into it:
          // from 640px to about 1135px of window width.
          // max-sm: below 640px the panel spans the screen instead.
          className="border-border bg-background fixed top-(--panel-top) right-6 z-50 flex max-h-[calc(100dvh-var(--panel-top)-1rem)] w-120 flex-col overflow-y-auto rounded-lg border p-4 shadow-xl [--panel-top:max(0.5rem,min(calc(var(--button-bottom,4rem)+0.5rem),calc(100dvh-27rem)))] max-sm:inset-x-2 max-sm:top-2 max-sm:max-h-[calc(100dvh-1rem)] max-sm:w-auto"
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
            onChange={(e) => updateSearch(e.target.value)}
            placeholder="Search repositories..."
            className="border-input bg-background text-foreground focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            aria-label="Search repositories"
            autoFocus
          />

          {/* Filters */}
          <div className="mt-3 flex gap-2">
            {/* Organization Filter */}
            <Select
              value={organizationFilter}
              onValueChange={handleOrganizationFilterChange}
              disabled={isLoadingCatalog}
            >
              <SelectTrigger
                className="h-9 flex-1 text-sm"
                aria-label="Organization filter"
              >
                {/* Persisted filters need a label before their catalog options load. */}
                <SelectValue>
                  {organizationFilter === 'all'
                    ? 'All Organizations'
                    : organizationFilter === currentUser?.login
                      ? `${currentUser.login} (Personal)`
                      : organizationFilter}
                </SelectValue>
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
            {/* One catalog request now loads both organizations and repositories. */}
            {isLoadingCatalog && (
              <span className="text-muted-foreground self-center text-xs">
                Loading GitHub data...
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
              className="border-input bg-background text-foreground focus:ring-primary rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
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
                  // text-foreground: text-primary on this tint is below
                  // 4.5:1 in 12 of the 14 themes (2.9:1 on Sunrise)
                  className="bg-primary/10 text-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
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
              className="bg-destructive/10 text-destructive mt-3 rounded-md p-3 text-sm"
            >
              Error: {error}
            </div>
          )}

          {/* Nothing was added because every selected repository is already
              placed: neutral notice, not an error */}
          {skippedMessages.length > 0 && (
            <div
              role="note"
              aria-live="polite"
              aria-label="Repositories that were not added"
              className="border-border bg-muted text-foreground mt-3 rounded-md border p-3 text-sm"
            >
              <ul className="space-y-1">
                {skippedMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
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
              // min-h-16: what is left of it when the panel is short of room,
              // about one repository
              className="border-border mt-3 max-h-75 min-h-16 overflow-y-auto rounded-md border"
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
                        className={`border-border flex cursor-pointer items-center justify-between border-b p-3 transition-colors ${OPTION_ROW_COLOR_CLASS}`}
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
                            <p className="mt-0.5 truncate text-sm">
                              {repo.description}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-3 text-xs">
                            <span>⭐ {repo.stargazers_count}</span>
                            {repo.language && (
                              <span className="bg-muted rounded px-1.5 py-0.5">
                                {repo.language}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && <span className="ml-2">✓</span>}
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
                      className={`border-border flex cursor-pointer items-center justify-between border-b p-3 transition-colors last:border-b-0 ${OPTION_ROW_COLOR_CLASS}`}
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
                          <p className="mt-0.5 truncate text-sm">
                            {repo.description}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-3 text-xs">
                          <span>⭐ {repo.stargazers_count}</span>
                          {repo.language && (
                            <span className="bg-muted rounded px-1.5 py-0.5">
                              {repo.language}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && <span className="ml-2">✓</span>}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* No results: only when neither list has a match for the query */}
          {!isLoading &&
            deferredSearchQuery &&
            filteredRepositories.length === 0 &&
            heldRepositories.length === 0 && (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No repositories found matching &quot;{deferredSearchQuery}&quot;
              </div>
            )}

          {/* Nothing addable, but some repositories are placed elsewhere */}
          {!isLoading &&
            filteredRepositories.length === 0 &&
            heldRepositories.length > 0 && (
              <p className="text-muted-foreground mt-3 text-sm">
                {deferredSearchQuery || hasActiveFilter
                  ? 'Nothing to add matches the search or filters. The ones below are already placed.'
                  : 'No repositories to add. The ones below are already placed.'}
              </p>
            )}

          {/* Nothing addable and nothing held, without a search */}
          {!isLoading &&
            !catalogError &&
            !deferredSearchQuery &&
            filteredRepositories.length === 0 &&
            heldRepositories.length === 0 && (
              <div className="text-muted-foreground py-8 text-center text-sm">
                {hasActiveFilter
                  ? 'No repositories match the current filters.'
                  : 'No repositories left to add.'}
              </div>
            )}

          {/* Repositories already on another board */}
          {!isLoading && <HeldRepositoryList repositories={heldRepositories} />}

          {/* A card on a shared board is readable through its public link,
              a private repository as much as a public one */}
          {isBoardShared && (
            <p
              id={SHARED_BOARD_TEXT_ID}
              className="text-foreground mt-4 flex items-start gap-2 text-sm"
            >
              <Globe
                className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                This board is shared by a public link. Anyone who has the link
                will see the repositories you add, with their descriptions.
              </span>
            </p>
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
              // Read with the button: pressing it makes the repositories public
              aria-describedby={
                isBoardShared ? SHARED_BOARD_TEXT_ID : undefined
              }
              disabled={selectedRepos.length === 0 || isLoading || !statusId}
              title={
                !statusId
                  ? 'Add a column before adding repositories'
                  : undefined
              }
              // The theme's primary, like every other main action: a fixed blue is
              // off-palette in the 14 themes
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add ({selectedRepos.length})
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

/**
 * Ref callback of the picker's panel: tells the panel how far down its button
 * ends (`--button-bottom`), which its class turns into its top edge and its
 * height. How far down the button stands depends on how the header wraps, and
 * that changes while the panel is open: the sidebar opens or closes, the
 * board's title is edited, the window gets narrower. Measured when React adds
 * the panel to the page and whenever an element around the button changes
 * size (a window that is resized changes the size of the page). Defined
 * outside the component so it stays the same function: React would run a new
 * one on every render.
 *
 * @param panel - The panel React just added, or `null`.
 * @returns What React calls when the panel is removed: it stops watching.
 * `undefined` when there is no panel, or no button before it.
 * @example
 * <div ref={trackButtonBottom} className="top-[calc(var(--button-bottom)+0.5rem)]" />
 */
function trackButtonBottom(
  panel: HTMLDivElement | null,
): (() => void) | undefined {
  const button = panel?.previousElementSibling
  if (!panel || !button) return undefined

  const measureButtonBottom = (): void => {
    panel.style.setProperty(
      '--button-bottom',
      `${button.getBoundingClientRect().bottom}px`,
    )
  }
  measureButtonBottom()
  const layoutObserver = new ResizeObserver(measureButtonBottom)
  // Every element around the button: when one of them changes size, the
  // button may stand somewhere else. border-box: a padding that changes
  // moves the button too, and leaves the content box as it was.
  for (
    let ancestor = button.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    layoutObserver.observe(ancestor, { box: 'border-box' })
  }
  return (): void => layoutObserver.disconnect()
}

/**
 * Splits catalog repositories into those the user can add to the current board
 * and those already placed elsewhere.
 *
 * Called by {@link AddRepositoryCombobox} on every filter or placement change.
 * - Hidden (in neither list): on the current board, according to the live
 *   Redux cards or to the fetched placements.
 * - Held: on another board of the user.
 * - Addable: everything else.
 *
 * When `placements` is `null` (the fetch failed) nothing is listed as held and
 * only repositories on the current board are hidden. The server still rejects
 * an already placed repository.
 *
 * @param params.repositories - Catalog repositories after search and filters.
 * @param params.currentBoardId - Board the picker adds to.
 * @param params.currentBoardIdentifiers - Lowercase `owner/name` of cards on the current board (Redux).
 * @param params.placements - Fetched placements, or `null` when unknown.
 * @returns `{ addable, held }`, both in catalog order.
 * @example
 * classifyRepositories({
 *   repositories: [repoA, repoB],
 *   currentBoardId: 'b1',
 *   currentBoardIdentifiers: new Set(),
 *   placements: [{ identifier: 'o/b', boardId: 'b2', boardName: 'Work' }],
 * })
 * // => { addable: [repoA], held: [{ id: repoB.id, fullName: 'o/b', boardId: 'b2', boardName: 'Work' }] }
 */
function classifyRepositories(params: {
  repositories: GitHubRepository[]
  currentBoardId: string
  currentBoardIdentifiers: Set<RepoIdentifier>
  placements: BoardPlacement[] | null
}): { addable: GitHubRepository[]; held: HeldRepository[] } {
  const { repositories, currentBoardId, currentBoardIdentifiers, placements } =
    params

  // First card wins if legacy data holds the same repository on two boards
  const boardPlacementByIdentifier = new Map<RepoIdentifier, BoardPlacement>()
  for (const placement of placements ?? []) {
    if (!boardPlacementByIdentifier.has(placement.identifier)) {
      boardPlacementByIdentifier.set(placement.identifier, placement)
    }
  }

  const addable: GitHubRepository[] = []
  const held: HeldRepository[] = []

  for (const repository of repositories) {
    // GitHub's own `owner/name`, lowercased: the same string toRepoIdentifier
    // builds, and it survives a repository with missing owner data (GITBOX-1)
    const identifier = repository.full_name.toLowerCase()
    const boardPlacement = boardPlacementByIdentifier.get(identifier)

    // Already on this board: hidden, as before
    if (
      currentBoardIdentifiers.has(identifier) ||
      boardPlacement?.boardId === currentBoardId
    ) {
      continue
    }

    if (boardPlacement) {
      held.push({
        id: repository.id,
        fullName: repository.full_name,
        boardId: boardPlacement.boardId,
        boardName: boardPlacement.boardName,
      })
      continue
    }

    addable.push(repository)
  }

  return { addable, held }
}
