/**
 * Maintenance Mode Client Component
 *
 * Explorer UI with Grid/List view toggle
 */

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Grid3X3,
  List,
  Search,
  ExternalLink,
  RotateCcw,
  MoreVertical,
  Archive,
  ArrowUpDown,
  ArrowLeft,
  Calendar,
  Star,
  StickyNote,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useState,
  useCallback,
  memo,
  useMemo,
  useRef,
  useTransition,
  useEffect,
  Activity,
} from 'react'

import { CommentActionsMenu } from '@/components/Board/CommentActionsMenu'
import { CommentDisplay } from '@/components/Board/CommentDisplay'
import {
  CommentInlineEdit,
  type CommentSaveOptions,
} from '@/components/Board/CommentInlineEdit'
import { NoteModal } from '@/components/Modals/NoteModal'
import {
  RestoreToBoardDialog,
  type BoardOption,
} from '@/components/Modals/RestoreToBoardDialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type ProjectLink } from '@/components/ui/editable-url-item'
import { Input } from '@/components/ui/input'
import {
  getCommentsForMaintenanceItems,
  updateMaintenanceComment,
  updateMaintenanceCommentColor,
  deleteMaintenanceComment,
  getMaintenanceProjectInfo,
  upsertMaintenanceProjectInfo,
  type CommentData,
} from '@/lib/actions/maintenance-project-info'
import { getUserBoardsWithStatusLists } from '@/lib/actions/repo-cards'
import type { CommentColor } from '@/lib/supabase/types'

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

type ViewMode = 'grid' | 'list'
type SortOption = 'name' | 'updated' | 'stars'

export const MaintenanceClient = memo(function MaintenanceClient({
  repos: initialRepos,
}: MaintenanceClientProps) {
  const router = useRouter()
  const [repos, setRepos] = useState<MaintenanceRepo[]>(initialRepos)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('updated')
  const [sortAsc, setSortAsc] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<MaintenanceRepo | null>(null)

  // Board data for restore dialog
  const [boards, setBoards] = useState<BoardOption[]>([])
  const [boardsError, setBoardsError] = useState<string | null>(null)
  const hasFetchedBoards = useRef(false)
  const [isLoadingBoards, startLoadingBoards] = useTransition()

  // Comment data for all maintenance items (batch loaded)
  const [comments, setComments] = useState<Record<string, CommentData>>({})
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)

  // Note modal state
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [selectedRepoForNote, setSelectedRepoForNote] =
    useState<MaintenanceRepo | null>(null)
  const [currentNote, setCurrentNote] = useState<string>('')
  const [currentLinks, setCurrentLinks] = useState<ProjectLink[]>([])
  const [, startLoadingProjectInfo] = useTransition()
  // Guard for async project info fetch - prevents stale data on repo switch
  const activeNoteRepoId = useRef<string | null>(null)

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

  // Load comments on mount
  useEffect(() => {
    if (initialRepos.length === 0) return
    const ids = initialRepos.map((r) => r.id)
    getCommentsForMaintenanceItems(ids).then(setComments)
  }, [initialRepos])

  /**
   * Fetch boards for restore dialog (event-driven, only once per session)
   * Moved from useEffect to event handler for proper separation of concerns
   */
  const fetchBoardsOnce = useCallback(() => {
    if (hasFetchedBoards.current) return
    hasFetchedBoards.current = true
    startLoadingBoards(async () => {
      const result = await getUserBoardsWithStatusLists()
      if (result.success && result.boards) {
        setBoards(result.boards)
        setBoardsError(null)
      } else {
        setBoardsError(result.error || 'Failed to load boards')
      }
    })
  }, [])

  // Filter repos based on search (searches owner/name only - notes are in projectinfo)
  const filteredRepos = repos.filter((repo) =>
    `${repo.repo_owner}/${repo.repo_name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  // Sort repos
  const sortedRepos = [...filteredRepos].sort((a, b) => {
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

  /**
   * Open GitHub page for repository
   * Not wrapped in useCallback - always used with inline handlers passing repo
   */
  const openGitHubUrl = (repo: MaintenanceRepo) => {
    window.open(
      `https://github.com/${repo.repo_owner}/${repo.repo_name}`,
      '_blank',
    )
  }

  /**
   * Open restore dialog for a specific maintenance item
   * Fetches boards on first open (event-driven, no useEffect needed)
   */
  const handleRestore = useCallback(
    (repo: MaintenanceRepo) => {
      setSelectedRepo(repo)
      setRestoreDialogOpen(true)
      fetchBoardsOnce() // Fetch boards when dialog opens
    },
    [fetchBoardsOnce],
  )

  /**
   * Handle successful restore by removing item from local state
   */
  const handleRestored = useCallback(() => {
    if (selectedRepo) {
      setRepos((prev) => prev.filter((r) => r.id !== selectedRepo.id))
      setSelectedRepo(null)
    }
    // Refresh to ensure server state is synced
    router.refresh()
  }, [selectedRepo, router])

  // ========================================
  // Comment Handlers
  // ========================================

  /**
   * Handle click on comment area to start editing
   */
  const handleCommentClick = useCallback((repoId: string) => {
    setEditingCommentId(repoId)
  }, [])

  /**
   * Handle saving a comment
   */
  const handleCommentSave = useCallback(
    async (repoId: string, newComment: string, options: CommentSaveOptions) => {
      // Optimistic update
      setComments((prev) => {
        const existing = prev[repoId]
        return {
          ...prev,
          [repoId]: {
            comment: newComment,
            color: existing?.color ?? 'neutral',
          },
        }
      })
      // Server update
      await updateMaintenanceComment(repoId, newComment)
      if (options.closeOnSave) {
        setEditingCommentId(null)
      }
    },
    [],
  )

  /**
   * Handle cancelling comment edit
   */
  const handleCommentCancel = useCallback(() => {
    setEditingCommentId(null)
  }, [])

  /**
   * Handle color change from CommentActionsMenu
   */
  const handleColorChange = useCallback(
    async (repoId: string, color: CommentColor) => {
      // Optimistic update
      setComments((prev) => {
        const existing = prev[repoId]
        return {
          ...prev,
          [repoId]: { color, comment: existing?.comment ?? '' },
        }
      })
      await updateMaintenanceCommentColor(repoId, color)
    },
    [],
  )

  /**
   * Handle delete from CommentActionsMenu
   */
  const handleCommentDelete = useCallback(async (repoId: string) => {
    // Optimistic update
    setComments((prev) => ({
      ...prev,
      [repoId]: { comment: '', color: 'primary' },
    }))
    await deleteMaintenanceComment(repoId)
  }, [])

  // ========================================
  // Note Modal Handlers
  // ========================================

  /**
   * Open note modal for a specific repo
   * Not wrapped in useCallback - always used with inline handlers passing repo
   * Uses activeNoteRepoId ref to guard against stale data on repo switch
   */
  const openNoteModal = (repo: MaintenanceRepo) => {
    activeNoteRepoId.current = repo.id
    setSelectedRepoForNote(repo)
    setNoteModalOpen(true)
    // Reset state before async load to prevent showing stale data
    setCurrentNote('')
    setCurrentLinks([])
    // Lazy load project info with guard
    startLoadingProjectInfo(async () => {
      try {
        const data = await getMaintenanceProjectInfo(repo.id)
        // Guard: only update if this repo is still active
        if (activeNoteRepoId.current !== repo.id) return
        setCurrentNote(data?.note || '')
        setCurrentLinks(data?.links || [])
      } catch {
        // Guard: only reset if this repo is still active
        if (activeNoteRepoId.current !== repo.id) return
        setCurrentNote('')
        setCurrentLinks([])
      }
    })
  }

  /**
   * Handle saving project info from modal
   */
  const handleProjectInfoSave = useCallback(
    async (note: string, links: ProjectLink[]) => {
      if (!selectedRepoForNote) return
      // Get current comment from comments state for this repo
      const currentComment = comments[selectedRepoForNote.id]?.comment || ''
      await upsertMaintenanceProjectInfo(selectedRepoForNote.id, {
        note,
        comment: currentComment,
        links,
      })
      setNoteModalOpen(false)
      setSelectedRepoForNote(null)
      setCurrentNote('')
      setCurrentLinks([])
    },
    [selectedRepoForNote, comments],
  )

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
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back to Board link - shows only if user has visited a board */}
            {lastVisitedBoard && (
              <Link
                href={`/board/${lastVisitedBoard.id}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">
                  Back to {lastVisitedBoard.name}
                </span>
                <span className="sm:hidden">Back</span>
              </Link>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Maintenance Mode
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Archived and maintenance projects • {repos.length} items
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
            <div className="flex rounded-lg border border-border p-1">
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
        {sortedRepos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Archive className="h-16 w-16 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">
              {search ? 'No matching repositories' : 'No maintenance projects'}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? 'Try adjusting your search terms'
                : 'Move projects here from your boards when they are archived'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {viewMode === 'grid' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortedRepos.map((repo, index) => (
                  <motion.div
                    key={repo.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => openGitHubUrl(repo)}
                  >
                    {/* Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="absolute right-2 top-2 rounded-md p-1.5 opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openGitHubUrl(repo)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open on GitHub
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRestore(repo)}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore to Board
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Content */}
                    <div
                      className="space-y-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="font-semibold text-foreground truncate pr-8">
                        {repo.repo_name}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {repo.repo_owner}
                      </p>

                      {/* Inline Comment (same as Board RepoCard) */}
                      <Activity
                        mode={
                          editingCommentId === repo.id ? 'visible' : 'hidden'
                        }
                      >
                        <CommentInlineEdit
                          initialValue={comments[repo.id]?.comment ?? ''}
                          onSave={async (newComment, options) =>
                            handleCommentSave(repo.id, newComment, options)
                          }
                          onCancel={handleCommentCancel}
                          style={{
                            borderColor: comments[repo.id]?.color ?? 'neutral',
                          }}
                        />
                      </Activity>
                      <Activity
                        mode={
                          editingCommentId === repo.id ? 'hidden' : 'visible'
                        }
                      >
                        <CommentDisplay
                          comment={comments[repo.id]?.comment}
                          onClick={() => handleCommentClick(repo.id)}
                          style={{
                            borderColor: comments[repo.id]?.color ?? 'neutral',
                          }}
                          showEmptyState={true}
                          renderActions={
                            comments[repo.id]?.comment
                              ? () => (
                                  <CommentActionsMenu
                                    onEdit={() => handleCommentClick(repo.id)}
                                    onColorChange={async (color) =>
                                      handleColorChange(repo.id, color)
                                    }
                                    onDelete={async () =>
                                      handleCommentDelete(repo.id)
                                    }
                                    currentColor={
                                      comments[repo.id]?.color ?? 'neutral'
                                    }
                                  />
                                )
                              : undefined
                          }
                        />
                      </Activity>

                      {/* Meta + Note Button */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.03 }}
                    className="group rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => openGitHubUrl(repo)}
                      >
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground truncate">
                            {repo.repo_owner}/{repo.repo_name}
                          </h3>
                          {repo.meta?.language && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {repo.meta.language}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      </div>
                    </div>

                    {/* Inline Comment for List view */}
                    <div className="mt-3">
                      <Activity
                        mode={
                          editingCommentId === repo.id ? 'visible' : 'hidden'
                        }
                      >
                        <CommentInlineEdit
                          initialValue={comments[repo.id]?.comment ?? ''}
                          onSave={async (newComment, options) =>
                            handleCommentSave(repo.id, newComment, options)
                          }
                          onCancel={handleCommentCancel}
                          style={{
                            borderColor: comments[repo.id]?.color ?? 'neutral',
                          }}
                        />
                      </Activity>
                      <Activity
                        mode={
                          editingCommentId === repo.id ? 'hidden' : 'visible'
                        }
                      >
                        <CommentDisplay
                          comment={comments[repo.id]?.comment}
                          onClick={() => handleCommentClick(repo.id)}
                          style={{
                            borderColor: comments[repo.id]?.color ?? 'neutral',
                          }}
                          showEmptyState={true}
                          renderActions={
                            comments[repo.id]?.comment
                              ? () => (
                                  <CommentActionsMenu
                                    onEdit={() => handleCommentClick(repo.id)}
                                    onColorChange={async (color) =>
                                      handleColorChange(repo.id, color)
                                    }
                                    onDelete={async () =>
                                      handleCommentDelete(repo.id)
                                    }
                                    currentColor={
                                      comments[repo.id]?.color ?? 'neutral'
                                    }
                                  />
                                )
                              : undefined
                          }
                        />
                      </Activity>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Restore to Board Dialog */}
      {selectedRepo && (
        <RestoreToBoardDialog
          isOpen={restoreDialogOpen}
          onClose={() => {
            setRestoreDialogOpen(false)
            setSelectedRepo(null)
          }}
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
          onClose={() => {
            setNoteModalOpen(false)
            setSelectedRepoForNote(null)
            activeNoteRepoId.current = null
            setCurrentNote('')
            setCurrentLinks([])
          }}
          onSave={handleProjectInfoSave}
          cardId={selectedRepoForNote.id}
          initialNote={currentNote}
          initialLinks={currentLinks}
          cardTitle={`${selectedRepoForNote.repo_owner}/${selectedRepoForNote.repo_name}`}
        />
      )}
    </div>
  )
})
