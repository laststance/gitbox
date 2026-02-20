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
import { useState, useCallback, memo, useEffect, useLayoutEffect } from 'react'
import { toast } from 'sonner'

import { AddRepositoryCombobox } from '@/components/Board/AddRepositoryCombobox'
import { KanbanBoard } from '@/components/Board/KanbanBoard'
import { BoardSettingsDialog } from '@/components/Boards/BoardSettingsDialog'
import { MoveToAnotherBoardDialog } from '@/components/Modals/MoveToAnotherBoardDialog'
import { NoteModal } from '@/components/Modals/NoteModal'
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
import { InlineEditableText } from '@/components/ui/inline-editable-text'
import {
  useBoardSettings,
  useStatusListDialog,
  useNoteModal,
  useAddRepositoryCombobox,
  useOptimisticCardAction,
} from '@/hooks/board'
import { renameBoardDirect, updateBoardSubtitle } from '@/lib/actions/board'
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
import {
  BOARD_NAME_MAX_LENGTH,
  BOARD_SUBTITLE_MAX_LENGTH,
} from '@/lib/validations/board'

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
    boardSubtitle: board.subtitle,
    boardSettings: board.settings,
  })

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
  // Card Action Handlers (via shared optimistic hook)
  // ========================================

  const executeCardAction = useOptimisticCardAction()

  const handleMoveToMaintenance = useCallback(
    async (cardId: string) =>
      executeCardAction(cardId, moveToMaintenance, {
        actionName: 'moveToMaintenance',
        errorMessage: 'Failed to move to maintenance',
      }),
    [executeCardAction],
  )

  const handleRemoveFromBoard = useCallback(
    async (cardId: string) =>
      executeCardAction(cardId, deleteRepoCard, {
        actionName: 'removeFromBoard',
        errorMessage: 'Failed to remove from board',
        successMessage: 'Repository removed',
      }),
    [executeCardAction],
  )

  // ========================================
  // Move to Another Board Handler
  // ========================================

  const [moveDialogCardId, setMoveDialogCardId] = useState<string | null>(null)

  const handleMoveToAnotherBoard = useCallback((cardId: string) => {
    setMoveDialogCardId(cardId)
  }, [])

  const handleMoveSuccess = useCallback(
    (cardId: string) => {
      dispatch(removeRepoCard(cardId))
      setMoveDialogCardId(null)
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
        <header className="border-border bg-background border-b px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              {/* Board Title - inline editable */}
              <InlineEditableText
                value={boardSettings.displayName}
                onSave={async (newName) => {
                  const result = await renameBoardDirect(boardId, newName)
                  if (!result.success) {
                    toast.error(result.error)
                    throw new Error(result.error)
                  }
                  boardSettings.handleRenameSuccess(result.data.name)
                }}
                maxLength={BOARD_NAME_MAX_LENGTH}
                as="h1"
                className="text-foreground text-xl font-bold sm:text-2xl"
                inputClassName="text-foreground text-xl font-bold sm:text-2xl"
                ariaLabel="Board title"
                data-testid="board-title"
              />
              {/* Board Subtitle - inline editable (conditionally rendered) */}
              {boardSettings.showSubtitle && (
                <InlineEditableText
                  value={boardSettings.displaySubtitle}
                  onSave={async (newSubtitle) => {
                    const result = await updateBoardSubtitle(
                      boardId,
                      newSubtitle,
                    )
                    if (!result.success) {
                      toast.error(result.error)
                      throw new Error(result.error)
                    }
                    boardSettings.handleSubtitleChange(result.data.subtitle)
                  }}
                  maxLength={BOARD_SUBTITLE_MAX_LENGTH}
                  placeholder="Add a subtitle..."
                  as="p"
                  className="text-muted-foreground text-sm"
                  inputClassName="text-muted-foreground text-sm"
                  ariaLabel="Board subtitle"
                  data-testid="board-subtitle"
                />
              )}
            </div>

            {/* Board operation buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Add Repositories - PRD 3.1 */}
              <AddRepositoryCombobox
                boardId={boardId}
                statusId={addRepoCombobox.statusId || statusLists[0]?.id || ''}
                isOpen={addRepoCombobox.isOpen}
                onOpenChange={addRepoCombobox.handleOpenChange}
                maintenanceRepoIdentifiers={
                  initialData.maintenanceRepoIdentifiers
                }
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
        <div className="bg-background flex-1 overflow-x-auto overflow-y-auto">
          <KanbanBoard
            boardId={boardId}
            initialComments={initialData.comments}
            cardDisplaySettings={boardSettings.cardDisplaySettings}
            onMoveToMaintenance={handleMoveToMaintenance}
            onMoveToAnotherBoard={handleMoveToAnotherBoard}
            onNote={noteModal.open}
            onRemove={handleRemoveFromBoard}
            onEditStatus={statusListDialog.openEdit}
            onDeleteStatus={statusListDialog.requestDelete}
            onAddCard={addRepoCombobox.openForStatus}
          />
        </div>
      </main>

      {/* StatusList Dialog */}
      <StatusListDialog
        isOpen={statusListDialog.isOpen}
        onClose={statusListDialog.close}
        onSave={statusListDialog.save}
        statusList={statusListDialog.selectedStatus}
        mode={statusListDialog.mode}
      />

      {/* NoteModal - Unified modal for notes + links (Issue #37) */}
      {noteModal.cardId && (
        <NoteModal
          isOpen={noteModal.isOpen}
          onClose={noteModal.close}
          onSave={noteModal.save}
          cardId={noteModal.cardId}
          initialNote={noteModal.initialNote}
          initialLinks={noteModal.initialLinks}
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
        isPublic={board.is_public}
        shareSlug={board.share_slug}
        boardSubtitle={boardSettings.displaySubtitle}
        onSubtitleSuccess={boardSettings.handleSubtitleChange}
        showSubtitle={boardSettings.showSubtitle}
        onShowSubtitleChange={boardSettings.handleShowSubtitleChange}
        onRenameSuccess={boardSettings.handleRenameSuccess}
        onCardDisplayChange={boardSettings.handleCardDisplayChange}
        onDeleteSuccess={handleDeleteSuccess}
      />

      {/* Move to Another Board Dialog */}
      {moveDialogCardId && (
        <MoveToAnotherBoardDialog
          isOpen={!!moveDialogCardId}
          onClose={() => setMoveDialogCardId(null)}
          cardId={moveDialogCardId}
          repoName={
            repoCards.find((c) => c.id === moveDialogCardId)?.title ?? ''
          }
          currentBoardId={boardId}
          onMoved={handleMoveSuccess}
        />
      )}

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
              &quot;?
              {(() => {
                const cardCount = repoCards.filter(
                  (c) => c.statusId === statusListDialog.pendingDeleteStatusId,
                ).length
                if (cardCount > 0) {
                  return ` This will also remove ${cardCount} card${cardCount !== 1 ? 's' : ''} in this column.`
                }
                return ''
              })()}{' '}
              This action cannot be undone.
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
