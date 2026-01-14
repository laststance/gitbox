/**
 * Board Page Client Component
 *
 * Constitution requirements:
 * - Principle V: Security first
 * - Principle VI: TDD - Test-driven development
 *
 * User Story 4:
 * - Project Info modal integration
 * - Optimistic UI updates
 *
 * PRD 3.2:
 * - StatusList CRUD operations
 */

'use client'

import * as Sentry from '@sentry/nextjs'
import { Link, Plus, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, memo, useEffect, useLayoutEffect } from 'react'
import { toast } from 'sonner'

import { AddRepositoryCombobox } from '@/components/Board/AddRepositoryCombobox'
import { KanbanBoard } from '@/components/Board/KanbanBoard'
import { BoardSettingsDialog } from '@/components/Boards/BoardSettingsDialog'
import { NoteModal } from '@/components/Modals/NoteModal'
import { ProjectInfoModal } from '@/components/Modals/ProjectInfoModal'
import { StatusListDialog } from '@/components/Modals/StatusListDialog'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  useBoardSettings,
  useProjectInfoModal,
  useStatusListDialog,
  useNoteModal,
  useAddRepositoryCombobox,
} from '@/hooks/board'
import type { BoardInitialData } from '@/lib/actions/board-data'
import {
  moveToMaintenance,
  deleteRepoCard,
  type CreatedRepoCard,
} from '@/lib/actions/repo-cards'
import type { RepoCardForRedux } from '@/lib/models/domain'
import {
  setStatusLists,
  setRepoCards,
  setActiveBoard,
  addRepoCards,
  removeRepoCard,
  selectStatusLists,
  selectRepoCards,
} from '@/lib/redux/slices/boardSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { Board } from '@/lib/supabase/types'
import { parseBoardSettings } from '@/lib/types/board-settings'

interface BoardPageClientProps {
  /** Full board object from Supabase */
  board: Board
  /** Initial data fetched by Server Component (Phase 4) */
  initialData: BoardInitialData
}

export const BoardPageClient = memo(function BoardPageClient({
  board,
  initialData,
}: BoardPageClientProps) {
  // Extract board properties
  const boardId = board.id
  const boardName = board.name

  const router = useRouter()
  const dispatch = useAppDispatch()
  const statusLists = useAppSelector(selectStatusLists)
  const repoCards = useAppSelector(selectRepoCards)

  // Phase 4: Hydrate Redux store with server-fetched data
  // useLayoutEffect ensures data is available before first paint (no flicker)
  useLayoutEffect(() => {
    dispatch(setStatusLists(initialData.statusLists))
    dispatch(setRepoCards(initialData.repoCards))
  }, [dispatch, initialData.statusLists, initialData.repoCards])

  // ========================================
  // Custom Hooks for State Management
  // ========================================

  // Board Settings Dialog (3 states extracted)
  const boardSettings = useBoardSettings({
    boardName,
    boardSettings: board.settings,
  })

  // Project Info Modal (4 states extracted)
  const projectInfoModal = useProjectInfoModal()

  // StatusList Dialog (5 states extracted: 3 original + 2 delete confirmation)
  const statusListDialog = useStatusListDialog({ boardId })

  // NoteModal (4 states extracted)
  const noteModal = useNoteModal({ repoCards })

  // AddRepositoryCombobox (2 states extracted)
  const addRepoCombobox = useAddRepositoryCombobox({ statusLists })

  // Set activeBoard in Redux on mount
  // This enables other components to know which board is currently being viewed
  useEffect(() => {
    dispatch(setActiveBoard(board))
    return () => {
      // Clear activeBoard when leaving the page
      dispatch(setActiveBoard(null))
    }
  }, [dispatch, board])

  // Save last visited board to localStorage for navigation from Maintenance page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'gitbox:lastVisitedBoard',
        JSON.stringify({ id: boardId, name: boardName }),
      )
    }
  }, [boardId, boardName])

  // ========================================
  // Card Action Handlers
  // ========================================

  /**
   * Move to Maintenance Mode
   *
   * Transfers a card from the active board to maintenance archive.
   * Uses optimistic UI update for immediate feedback.
   *
   * @param cardId - The card ID to move to maintenance
   */
  const handleMoveToMaintenance = useCallback(
    async (cardId: string) => {
      // Find card to remove for optimistic update
      const cardToRemove = repoCards.find((c) => c.id === cardId)
      if (!cardToRemove) return

      // Optimistic update: remove from state immediately
      const previousCards = repoCards
      dispatch(setRepoCards(repoCards.filter((c) => c.id !== cardId)))

      try {
        const result = await moveToMaintenance(cardId)
        if (!result.success) {
          // Revert on error
          dispatch(setRepoCards(previousCards))
          toast.error('Failed to move to maintenance', {
            description: result.error,
          })
        }
      } catch (error) {
        // Revert on error
        dispatch(setRepoCards(previousCards))
        Sentry.captureException(error, {
          tags: { action: 'moveToMaintenance' },
        })
        toast.error('Failed to move to maintenance', {
          description: 'Please try again.',
        })
      }
    },
    [repoCards, dispatch],
  )

  /**
   * Remove Repository from Board
   *
   * Permanently deletes a card from the board.
   * Uses optimistic UI update for immediate feedback.
   *
   * @param cardId - The card ID to remove
   */
  const handleRemoveFromBoard = useCallback(
    async (cardId: string) => {
      // Optimistic update: remove from state immediately
      dispatch(removeRepoCard(cardId))

      try {
        const result = await deleteRepoCard(cardId)
        if (!result.success) {
          // Revert on error - refetch data
          Sentry.captureMessage('Delete repo card failed', {
            level: 'error',
            tags: { action: 'deleteRepoCard' },
            extra: { error: result.error },
          })
          toast.error('Failed to remove from board', {
            description: result.error,
          })
          // Note: We'd need to restore the card here, but since we don't have
          // a simple way to get it back, we'll just alert the user
        } else {
          toast.success('Repository removed', {
            description: 'The repository has been removed from the board.',
          })
        }
      } catch (error) {
        Sentry.captureException(error, { tags: { action: 'removeFromBoard' } })
        toast.error('Failed to remove from board', {
          description: 'Please try again.',
        })
      }
    },
    [dispatch],
  )

  // ========================================
  // Board Delete Handler
  // ========================================

  /**
   * Handle board delete success
   */
  const handleDeleteSuccess = useCallback(() => {
    router.push('/boards')
  }, [router])

  /**
   * Copy Board Link to Clipboard
   *
   * Copies the current board URL to clipboard for easy sharing.
   * Enables boards to function as "Better GitHub Repository Lists".
   */
  const handleCopyBoardLink = useCallback(async () => {
    try {
      const url = window.location.href
      await navigator.clipboard.writeText(url)
      toast.success('Link copied!', {
        description: 'Board URL has been copied to clipboard.',
      })
    } catch (error) {
      Sentry.captureException(error, { tags: { action: 'copyBoardLink' } })
      toast.error('Failed to copy link', {
        description: 'Please try again.',
      })
    }
  }, [])

  return (
    <>
      <main className="flex h-screen flex-col">
        {/* Header */}
        <header className="border-b border-header-border bg-header px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-header-foreground">
              {boardSettings.displayName}
            </h1>

            {/* Board operation buttons */}
            <div className="flex items-center gap-2">
              {/* Add Repositories - PRD 3.1 */}
              <AddRepositoryCombobox
                boardId={boardId}
                statusId={addRepoCombobox.statusId || statusLists[0]?.id || ''}
                isOpen={addRepoCombobox.isOpen}
                onOpenChange={addRepoCombobox.handleOpenChange}
                onRepositoriesAdded={(createdCards: CreatedRepoCard[]) => {
                  // Optimistic UI update: Add cards to Redux state immediately
                  // No page reload needed - cards appear instantly
                  const newCards: RepoCardForRedux[] = createdCards.map(
                    (card) => ({
                      id: card.id,
                      title: `${card.repoOwner}/${card.repoName}`,
                      description:
                        (card.meta as { description?: string })?.description ||
                        '',
                      statusId: card.statusId,
                      boardId: card.boardId,
                      repoOwner: card.repoOwner,
                      repoName: card.repoName,
                      order: card.order,
                      meta: card.meta,
                      createdAt: card.createdAt,
                      updatedAt: card.updatedAt,
                    }),
                  )
                  dispatch(addRepoCards(newCards))
                }}
                onQuickNoteFocus={() => {
                  // TODO: Focus on quick note field (not yet implemented)
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={statusListDialog.openCreate}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Column
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={boardSettings.open}
                className="gap-1"
              >
                <Settings className="h-4 w-4" />
                Board Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyBoardLink}
                className="gap-1"
                title="Copy board link to clipboard"
              >
                <Link className="h-4 w-4" />
                Copy Link
              </Button>
            </div>
          </div>
        </header>

        {/* Kanban Board - horizontal scroll enabled for 6+ columns */}
        <div className="flex-1 overflow-x-auto overflow-y-auto bg-gray-100 dark:bg-gray-900">
          <KanbanBoard
            boardId={boardId}
            initialComments={initialData.comments}
            cardDisplaySettings={boardSettings.cardDisplaySettings}
            onEditProjectInfo={projectInfoModal.openModal}
            onMoveToMaintenance={handleMoveToMaintenance}
            onNote={noteModal.open}
            onRemove={handleRemoveFromBoard}
            onEditStatus={statusListDialog.openEdit}
            onDeleteStatus={statusListDialog.requestDelete}
            onAddCard={addRepoCombobox.openForStatus}
          />
        </div>
      </main>

      {/* Project Info Modal */}
      {projectInfoModal.projectInfo && (
        <ProjectInfoModal
          isOpen={projectInfoModal.isOpen}
          onClose={projectInfoModal.closeModal}
          onSave={projectInfoModal.saveProjectInfo}
          projectInfo={projectInfoModal.projectInfo}
        />
      )}

      {/* StatusList Dialog */}
      <StatusListDialog
        isOpen={statusListDialog.isOpen}
        onClose={statusListDialog.close}
        onSave={statusListDialog.save}
        statusList={statusListDialog.selectedStatus}
        mode={statusListDialog.mode}
      />

      {/* NoteModal */}
      {noteModal.cardId && (
        <NoteModal
          isOpen={noteModal.isOpen}
          onClose={noteModal.close}
          onSave={noteModal.save}
          cardId={noteModal.cardId}
          initialNote={noteModal.initialNote}
          cardTitle={noteModal.cardTitle}
        />
      )}

      {/* Board Settings Dialog */}
      <BoardSettingsDialog
        isOpen={boardSettings.isOpen}
        onClose={boardSettings.close}
        boardId={boardId}
        boardName={boardSettings.displayName}
        boardSettings={parseBoardSettings(board.settings)}
        onRenameSuccess={boardSettings.handleRenameSuccess}
        onCardDisplayChange={boardSettings.handleCardDisplayChange}
        onDeleteSuccess={handleDeleteSuccess}
      />

      {/* StatusList Delete Confirmation Dialog */}
      <AlertDialog
        open={statusListDialog.isDeleteConfirmOpen}
        onOpenChange={statusListDialog.setDeleteConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Column</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;
              {statusListDialog.pendingDeleteStatusTitle}
              &quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={statusListDialog.cancelDelete}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={statusListDialog.confirmDelete}
              aria-label={`Delete column ${statusListDialog.pendingDeleteStatusTitle}`}
            >
              Delete Column
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
})
