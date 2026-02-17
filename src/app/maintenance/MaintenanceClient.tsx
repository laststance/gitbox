/**
 * Maintenance Mode Client Component
 *
 * Explorer UI with Grid/List view toggle.
 * Logic is extracted into custom hooks for maintainability:
 * - useMaintenanceViewState: view mode, search, sort
 * - useRestoreDialog: restore-to-board dialog
 * - useMaintenanceComments: comment CRUD with optimistic updates
 * - useMaintenanceNoteModal: note modal with lazy project info loading
 */

'use client'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Grid3X3,
  List,
  Search,
  ExternalLink,
  RotateCcw,
  Archive,
  ArrowUpDown,
  ArrowLeft,
  Calendar,
  Star,
  StickyNote,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, memo, useMemo, useCallback } from 'react'

import { CommentSection } from '@/components/Board/CommentSection'
import { OverflowMenu } from '@/components/Board/OverflowMenu'
import { DeleteMaintenanceDialog } from '@/components/Modals/DeleteMaintenanceDialog'
import { NoteModal } from '@/components/Modals/NoteModal'
import { RestoreToBoardDialog } from '@/components/Modals/RestoreToBoardDialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'

import { useMaintenanceComments } from './hooks/useMaintenanceComments'
import { useMaintenanceNoteModal } from './hooks/useMaintenanceNoteModal'
import { useMaintenanceViewState } from './hooks/useMaintenanceViewState'
import { useRestoreDialog } from './hooks/useRestoreDialog'

/** Base styles for view mode toggle button */
const VIEW_TOGGLE_BASE = 'rounded-md p-2 transition-colors'
const VIEW_TOGGLE_SELECTED = 'bg-primary text-primary-foreground'
const VIEW_TOGGLE_UNSELECTED = 'hover:bg-muted'

export interface MaintenanceRepo {
  id: string
  repo_owner: string
  repo_name: string
  meta: {
    stars?: number
    language?: string
    lastUpdated?: string
  } | null
  created_at: string | null
  updated_at: string | null
  board?: {
    name: string
  } | null
}

interface MaintenanceClientProps {
  repos: MaintenanceRepo[]
}

export const MaintenanceClient = memo(function MaintenanceClient({
  repos: initialRepos,
}: MaintenanceClientProps) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const [repos, setRepos] = useState<MaintenanceRepo[]>(initialRepos)

  // Custom hooks for each concern
  const {
    viewMode,
    setViewMode,
    search,
    setSearch,
    sortBy,
    setSortBy,
    sortAsc,
    setSortAsc,
    sortedRepos,
  } = useMaintenanceViewState({ repos })

  const {
    restoreDialogOpen,
    selectedRepo,
    boards,
    boardsError,
    isLoadingBoards,
    handleRestore,
    handleRestored,
    closeRestoreDialog,
  } = useRestoreDialog({ onReposChange: setRepos, router })

  const {
    comments,
    editingCommentId,
    handleCommentClick,
    handleCommentSave,
    handleCommentCancel,
    handleColorChange,
    handleCommentDelete,
  } = useMaintenanceComments({ initialRepos })

  const {
    noteModalOpen,
    selectedRepoForNote,
    currentNote,
    currentLinks,
    openNoteModal,
    handleProjectInfoSave,
    closeNoteModal,
  } = useMaintenanceNoteModal()

  // Per-card menu state for OverflowMenu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedRepoForDelete, setSelectedRepoForDelete] =
    useState<MaintenanceRepo | null>(null)

  /**
   * Open delete confirmation dialog for a maintenance item
   */
  const handleDelete = useCallback((repo: MaintenanceRepo) => {
    setSelectedRepoForDelete(repo)
    setDeleteDialogOpen(true)
  }, [])

  /**
   * Handle successful deletion by removing item from local state
   */
  const handleDeleteSuccess = useCallback(() => {
    if (selectedRepoForDelete) {
      setRepos((prev) => prev.filter((r) => r.id !== selectedRepoForDelete.id))
      setSelectedRepoForDelete(null)
    }
    router.refresh()
  }, [selectedRepoForDelete, router])

  /**
   * Close the delete confirmation dialog
   */
  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false)
    setSelectedRepoForDelete(null)
  }, [])

  /**
   * Keyboard shortcut handler for maintenance cards.
   * Follows the same pattern as RepoCard keyboard shortcuts.
   */
  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, repo: MaintenanceRepo) => {
      if (e.key === '.' || e.key === 'Period') {
        e.preventDefault()
        setOpenMenuId((prev) => (prev === repo.id ? null : repo.id))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        openNoteModal(repo)
      }
      if (e.key === 'Escape' && openMenuId === repo.id) {
        e.preventDefault()
        setOpenMenuId(null)
      }
    },
    [openMenuId, openNoteModal],
  )

  // Last visited board for navigation - lazy initialization from localStorage
  const [lastVisitedBoard] = useState<{
    id: string
    name: string
  } | null>(() => {
    if (typeof window === 'undefined') return null
    const stored = localStorage.getItem('gitbox:lastVisitedBoard')
    if (!stored) return null
    try {
      return JSON.parse(stored) as { id: string; name: string }
    } catch {
      return null
    }
  })

  /**
   * Open GitHub page for repository
   */
  const openGitHubUrl = (repo: MaintenanceRepo) => {
    window.open(
      `https://github.com/${repo.repo_owner}/${repo.repo_name}`,
      '_blank',
    )
  }

  const gridToggleClassName = useMemo(
    () =>
      `${VIEW_TOGGLE_BASE} ${viewMode === 'grid' ? VIEW_TOGGLE_SELECTED : VIEW_TOGGLE_UNSELECTED}`,
    [viewMode],
  )

  const listToggleClassName = useMemo(
    () =>
      `${VIEW_TOGGLE_BASE} ${viewMode === 'list' ? VIEW_TOGGLE_SELECTED : VIEW_TOGGLE_UNSELECTED}`,
    [viewMode],
  )

  return (
    <div className="bg-background flex h-screen flex-col">
      {/* Header */}
      <header className="border-border border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back to Board link - shows only if user has visited a board */}
            {lastVisitedBoard && (
              <Link
                href={`/board/${lastVisitedBoard.id}`}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">
                  Back to {lastVisitedBoard.name}
                </span>
                <span className="sm:hidden">Back</span>
              </Link>
            )}
            <div>
              <h1 className="text-foreground text-2xl font-bold">
                Maintenance Mode
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Archived and maintenance projects • {repos.length} items
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search repositories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
              />
            </div>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('name')}>
                  Name {sortBy === 'name' && '✓'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('updated')}>
                  Last Updated {sortBy === 'updated' && '✓'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('stars')}>
                  Stars {sortBy === 'stars' && '✓'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortAsc(!sortAsc)}>
                  {sortAsc ? 'Ascending' : 'Descending'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Toggle */}
            <div className="border-border flex rounded-lg border p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={gridToggleClassName}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={listToggleClassName}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto w-full max-w-6xl">
          {sortedRepos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Archive className="text-muted-foreground/50 h-16 w-16" />
              <h3 className="text-foreground mt-4 text-lg font-medium">
                {search
                  ? 'No matching repositories'
                  : 'No maintenance projects'}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {search
                  ? 'Try adjusting your search terms'
                  : 'Move projects here from your boards when they are archived'}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {viewMode === 'grid' ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {sortedRepos.map((repo, index) => (
                    <motion.div
                      key={repo.id}
                      initial={
                        prefersReducedMotion ? false : { opacity: 0, y: 20 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        prefersReducedMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.95 }
                      }
                      transition={{
                        delay: prefersReducedMotion
                          ? 0
                          : Math.min(index * 0.05, 0.5),
                        duration: prefersReducedMotion ? 0 : undefined,
                      }}
                      className="group border-border bg-card hover:border-primary/50 focus-within:border-primary/50 relative rounded-lg border p-4 transition-all hover:shadow-md focus:outline-none"
                      tabIndex={0}
                      onKeyDown={(e) => handleCardKeyDown(e, repo)}
                    >
                      {/* Menu */}
                      <div className="absolute top-2 right-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <OverflowMenu
                          cardId={repo.id}
                          repoOwner={repo.repo_owner}
                          repoName={repo.repo_name}
                          context="maintenance"
                          onRestoreToBoard={() => handleRestore(repo)}
                          onDelete={() => handleDelete(repo)}
                          open={openMenuId === repo.id}
                          onOpenChange={(isOpen) =>
                            setOpenMenuId(isOpen ? repo.id : null)
                          }
                        />
                      </div>

                      {/* Content */}
                      <div className="space-y-2">
                        <h3 className="text-foreground truncate pr-8 font-semibold">
                          {repo.repo_name}
                        </h3>
                        <p className="text-muted-foreground truncate text-sm">
                          {repo.repo_owner}
                        </p>

                        {/* Inline Comment (shared CommentSection) */}
                        <CommentSection
                          comment={comments[repo.id]?.comment}
                          color={comments[repo.id]?.color}
                          isEditing={editingCommentId === repo.id}
                          onStartEdit={() => handleCommentClick(repo.id)}
                          onSave={async (newComment, options) =>
                            handleCommentSave(repo.id, newComment, options)
                          }
                          onCancel={handleCommentCancel}
                          onColorChange={async (color) =>
                            handleColorChange(repo.id, color)
                          }
                          onDelete={async () => handleCommentDelete(repo.id)}
                        />

                        {/* Meta + Note Button */}
                        <div className="flex items-center justify-between pt-2">
                          <div className="text-muted-foreground flex items-center gap-3 text-xs">
                            {repo.meta?.stars !== undefined && (
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                {repo.meta.stars}
                              </span>
                            )}
                            {repo.meta?.language && (
                              <span>{repo.meta.language}</span>
                            )}
                            {repo.updated_at && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(repo.updated_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => openNoteModal(repo)}
                            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                            aria-label="Open note"
                          >
                            <StickyNote className="h-3 w-3" />
                            <span>Note</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedRepos.map((repo, index) => (
                    <motion.div
                      key={repo.id}
                      initial={
                        prefersReducedMotion ? false : { opacity: 0, x: -20 }
                      }
                      animate={{ opacity: 1, x: 0 }}
                      exit={
                        prefersReducedMotion
                          ? { opacity: 0 }
                          : { opacity: 0, x: 20 }
                      }
                      transition={{
                        delay: prefersReducedMotion
                          ? 0
                          : Math.min(index * 0.03, 0.3),
                        duration: prefersReducedMotion ? 0 : undefined,
                      }}
                      className="group border-border bg-card hover:border-primary/50 focus-within:border-primary/50 rounded-lg border p-4 transition-all hover:shadow-sm focus:outline-none"
                      tabIndex={0}
                      onKeyDown={(e) => handleCardKeyDown(e, repo)}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => openGitHubUrl(repo)}
                        >
                          <div className="flex items-center gap-2">
                            <h3 className="text-foreground truncate font-semibold">
                              {repo.repo_owner}/{repo.repo_name}
                            </h3>
                            {repo.meta?.language && (
                              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                                {repo.meta.language}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Meta */}
                        <div className="text-muted-foreground flex items-center gap-4 text-sm">
                          {repo.meta?.stars !== undefined && (
                            <span className="flex items-center gap-1">
                              <Star className="h-4 w-4" />
                              {repo.meta.stars}
                            </span>
                          )}
                          {repo.updated_at && (
                            <span className="hidden sm:inline">
                              {new Date(repo.updated_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openNoteModal(repo)}
                            aria-label="Open note"
                          >
                            <StickyNote className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openGitHubUrl(repo)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestore(repo)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(repo)}
                            className="text-destructive hover:text-destructive"
                            aria-label={`Delete ${repo.repo_owner}/${repo.repo_name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Inline Comment for List view */}
                      <CommentSection
                        comment={comments[repo.id]?.comment}
                        color={comments[repo.id]?.color}
                        isEditing={editingCommentId === repo.id}
                        onStartEdit={() => handleCommentClick(repo.id)}
                        onSave={async (newComment, options) =>
                          handleCommentSave(repo.id, newComment, options)
                        }
                        onCancel={handleCommentCancel}
                        onColorChange={async (color) =>
                          handleColorChange(repo.id, color)
                        }
                        onDelete={async () => handleCommentDelete(repo.id)}
                        className="mt-3"
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Restore to Board Dialog */}
      {selectedRepo && (
        <RestoreToBoardDialog
          isOpen={restoreDialogOpen}
          onClose={closeRestoreDialog}
          maintenanceId={selectedRepo.id}
          repoName={`${selectedRepo.repo_owner}/${selectedRepo.repo_name}`}
          onRestored={handleRestored}
          boards={boards}
          isLoadingBoards={isLoadingBoards}
          boardsError={boardsError}
        />
      )}

      {/* Note Modal for Note + Links editing */}
      {selectedRepoForNote && (
        <NoteModal
          isOpen={noteModalOpen}
          onClose={closeNoteModal}
          onSave={handleProjectInfoSave}
          cardId={selectedRepoForNote.id}
          initialNote={currentNote}
          initialLinks={currentLinks}
          cardTitle={`${selectedRepoForNote.repo_owner}/${selectedRepoForNote.repo_name}`}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {selectedRepoForDelete && (
        <DeleteMaintenanceDialog
          isOpen={deleteDialogOpen}
          onClose={closeDeleteDialog}
          onDeleteSuccess={handleDeleteSuccess}
          maintenanceId={selectedRepoForDelete.id}
          repoName={`${selectedRepoForDelete.repo_owner}/${selectedRepoForDelete.repo_name}`}
        />
      )}
    </div>
  )
})
