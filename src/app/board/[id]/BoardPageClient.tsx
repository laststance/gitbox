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
import { useState, useCallback, memo } from 'react'
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
  useBoardServerSync,
} from '@/hooks/board'
import { renameBoardDirect, updateBoardSubtitle } from '@/lib/actions/board'
import type { BoardInitialData } from '@/lib/actions/board-data'
import { deleteRepoCard, type CreatedRepoCard } from '@/lib/actions/repo-cards'
import type { RepoCardForRedux } from '@/lib/models/domain'
import {
  addRepoCards,
  selectStatusLists,
  selectRepoCards,
} from '@/lib/redux/slices/boardSlice'
import { removeMovedRepoCard } from '@/lib/redux/slices/boardSyncSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { Board } from '@/lib/supabase/types'
import { parseBoardSettings } from '@/lib/types/board-settings'
import { toBoardId, type RepoCardId } from '@/lib/types/brands'
import { areServerRenderedPropsEqual } from '@/lib/utils/are-server-rendered-props-equal'
import { toPublicBoardUrl } from '@/lib/utils/to-public-board-url'
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
  const boardId = toBoardId(board.id)
  const boardName = board.name

  const router = useRouter()
  const dispatch = useAppDispatch()
  const statusLists = useAppSelector(selectStatusLists)
  const repoCards = useAppSelector(selectRepoCards)

  // Phase 4: Hydrate Redux store with server-fetched data, and fetch the board
  // again when a failed save leaves the store out of step with the database
  useBoardServerSync({
    boardId,
    statusLists: initialData.statusLists,
    repoCards: initialData.repoCards,
  })

  // ========================================
  // Custom Hooks for State Management
  // ========================================

  // Board Settings Dialog (3 states extracted)
  const boardSettings = useBoardSettings({
    boardName,
    boardSubtitle: board.subtitle,
    boardSettings: board.settings,
    isPublic: board.is_public,
    shareSlug: board.share_slug,
  })

  // StatusList Dialog (5 states extracted: 3 original + 2 delete confirmation)
  const statusListDialog = useStatusListDialog({ boardId })

  // NoteModal (4 states extracted)
  const noteModal = useNoteModal({ repoCards })

  // AddRepositoryCombobox (2 states extracted)
  const addRepoCombobox = useAddRepositoryCombobox({ statusLists })

  // ========================================
  // Card Action Handlers (via shared optimistic hook)
  // ========================================

  const executeCardAction = useOptimisticCardAction()

  const handleRemoveFromBoard = useCallback(
    async (cardId: RepoCardId) =>
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

  const [moveDialogCardId, setMoveDialogCardId] = useState<RepoCardId | null>(
    null,
  )

  const handleMoveToAnotherBoard = useCallback((cardId: RepoCardId) => {
    setMoveDialogCardId(cardId)
  }, [])

  const handleMoveSuccess = useCallback(
    (cardId: RepoCardId) => {
      // Leaves the store alone when another board was opened before the
      // answer of the move arrived
      dispatch(removeMovedRepoCard(boardId, cardId))
      setMoveDialogCardId(null)
    },
    [dispatch, boardId],
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

  // Set while the board is shared by link; follows the Sharing switch live
  const { publicShareSlug } = boardSettings

  /**
   * Copy Board Link to Clipboard
   *
   * A shared board has a public link that anyone can open, so that is the
   * link worth handing out. A private board only has this page's address,
   * which opens for its owner alone; the toast says so, because everyone else
   * who follows it lands on "Board not found".
   */
  const handleCopyBoardLink = useCallback(async () => {
    const boardLink = publicShareSlug
      ? toPublicBoardUrl(window.location.origin, publicShareSlug)
      : window.location.href
    try {
      await navigator.clipboard.writeText(boardLink)
      toast.success('Link copied!', {
        description: publicShareSlug
          ? 'Anyone with this link can view the board.'
          : 'Only you can open this link. Turn on Public Sharing in the board settings to get one for others.',
      })
    } catch (error) {
      Sentry.captureException(error, { tags: { action: 'copyBoardLink' } })
      toast.error('Failed to copy link', {
        description: 'Please try again.',
      })
    }
  }, [publicShareSlug])

  return (
    <>
      {/* A div, not a second <main>: the layout around this page is the
          main region of the document (BoardLayoutClient) */}
      <div className="flex h-screen flex-col">
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
                statusId={addRepoCombobox.statusId}
                isOpen={addRepoCombobox.isOpen}
                onOpenChange={addRepoCombobox.handleOpenChange}
                isBoardShared={publicShareSlug !== null}
                onRepositoriesAdded={(createdCards: CreatedRepoCard[]) => {
                  // Optimistic UI update: cards appear instantly without a reload.
                  const newCards: RepoCardForRedux[] = createdCards.map(
                    (card) => ({
                      ...card,
                      title: `${card.repoOwner}/${card.repoName}`,
                      description:
                        (card.meta as { description?: string })?.description ||
                        '',
                    }),
                  )
                  dispatch(addRepoCards(newCards))
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
            onMoveToAnotherBoard={handleMoveToAnotherBoard}
            onNote={noteModal.open}
            onRemove={handleRemoveFromBoard}
            onEditStatus={statusListDialog.openEdit}
            onDeleteStatus={statusListDialog.requestDelete}
            onAddCard={addRepoCombobox.openForStatus}
          />
        </div>
      </div>

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
        onPublicChange={boardSettings.handlePublicChange}
        onDeleteSuccess={handleDeleteSuccess}
      />

      {/* Move to Another Board Dialog. Mounted per opening: it has no open
          prop, so each opening loads the boards afresh. */}
      {moveDialogCardId && (
        <MoveToAnotherBoardDialog
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
              {(() => {
                const cardCount = repoCards.filter(
                  (c) => c.statusId === statusListDialog.pendingDeleteStatusId,
                ).length
                const cardSuffix =
                  cardCount > 0
                    ? ` This will also remove ${cardCount} card${cardCount !== 1 ? 's' : ''} in this column.`
                    : ''
                return `Are you sure you want to delete "${statusListDialog.pendingDeleteStatusTitle}"?${cardSuffix} This action cannot be undone.`
              })()}
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
}, areServerRenderedPropsEqual)
