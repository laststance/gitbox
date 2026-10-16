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
import { Link, Plus, RefreshCw, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useCallback, useMemo, useRef, memo } from 'react'
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
  useRevealLinkedCard,
} from '@/hooks/board'
import { renameBoardDirect, updateBoardSubtitle } from '@/lib/actions/board'
import type { BoardInitialData } from '@/lib/actions/board-data'
import type { CommentData } from '@/lib/actions/project-info'
import {
  refreshBoardMetadata,
  refreshCardMetadata,
} from '@/lib/actions/refresh-metadata'
import { deleteRepoCard, type CreatedRepoCard } from '@/lib/actions/repo-cards'
import type { RepoCardForRedux } from '@/lib/models/domain'
import {
  addRepoCards,
  applyRefreshedRepoCards,
  selectStatusLists,
  selectRepoCards,
} from '@/lib/redux/slices/boardSlice'
import { removeMovedRepoCard } from '@/lib/redux/slices/boardSyncSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { Board } from '@/lib/supabase/types'
import { parseBoardSettings } from '@/lib/types/board-settings'
import { toBoardId, type RepoCardId } from '@/lib/types/brands'
import { areServerRenderedPropsEqual } from '@/lib/utils/are-server-rendered-props-equal'
import { describeBoardRefresh } from '@/lib/utils/describe-board-refresh'
import {
  describeColumnDeletion,
  holdColumnDeletionDescription,
} from '@/lib/utils/describe-column-deletion'
import { mergeRestoredComments } from '@/lib/utils/merge-restored-comments'
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
  // A held-row link names its card. Scroll to it once this board is showing.
  useRevealLinkedCard(boardId)

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
  // Cancel and Delete clear the column at once. The dialog stays for its
  // 200ms exit, so the sentence is kept from the last render that had it.
  const liveColumnDeletion =
    statusListDialog.isDeleteConfirmOpen &&
    statusListDialog.pendingDeleteStatusTitle !== undefined
      ? {
          title: statusListDialog.pendingDeleteStatusTitle,
          description: describeColumnDeletion(
            statusListDialog.pendingDeleteStatusTitle,
            repoCards.filter(
              (card) =>
                card.statusId === statusListDialog.pendingDeleteStatusId,
            ).length,
          ),
        }
      : null
  const [heldColumnDeletion, setHeldColumnDeletion] = useState({
    title: '',
    description: '',
  })
  const columnDeletion = holdColumnDeletionDescription(
    statusListDialog.isDeleteConfirmOpen,
    liveColumnDeletion,
    heldColumnDeletion,
  )
  if (
    columnDeletion.held.title !== heldColumnDeletion.title ||
    columnDeletion.held.description !== heldColumnDeletion.description
  ) {
    setHeldColumnDeletion(columnDeletion.held)
  }

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

  const [isRefreshingBoard, setIsRefreshingBoard] = useState(false)
  // A second click on the same card would spend another card refresh.
  // A click while the board refresh is running would start a second one.
  const refreshingCardIds = useRef(new Set<RepoCardId>())
  const boardRefreshInFlight = useRef(false)

  const handleRefreshCard = useCallback(
    async (cardId: RepoCardId): Promise<void> => {
      if (
        boardRefreshInFlight.current ||
        refreshingCardIds.current.has(cardId)
      ) {
        return
      }
      refreshingCardIds.current.add(cardId)
      try {
        const result = await refreshCardMetadata(cardId)
        if (!result.success) {
          toast.error(result.error)
          return
        }
        dispatch(applyRefreshedRepoCards([result.data]))
        toast.success('Refreshed from GitHub')
      } finally {
        refreshingCardIds.current.delete(cardId)
      }
    },
    [dispatch],
  )

  const handleRefreshBoard = useCallback(async (): Promise<void> => {
    if (boardRefreshInFlight.current) return
    boardRefreshInFlight.current = true
    setIsRefreshingBoard(true)
    try {
      const result = await refreshBoardMetadata(boardId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      if (result.data.updated.length > 0) {
        dispatch(applyRefreshedRepoCards(result.data.updated))
      }
      const sentence = describeBoardRefresh({
        updated: result.data.updated.length,
        failed: result.data.failed.length,
        remaining: result.data.remaining,
      })
      // Nothing was written and GitHub refused the cards that were asked
      if (result.data.updated.length === 0 && result.data.failed.length > 0) {
        toast.error(sentence)
        return
      }
      toast.success(sentence)
    } finally {
      boardRefreshInFlight.current = false
      setIsRefreshingBoard(false)
    }
  }, [boardId, dispatch])

  // ========================================
  // Comments of repositories added on this page
  // ========================================

  // Comments that repositories added on this page brought back (issue #216).
  // A later load of this page wins: the restored comment is only for a card
  // the server has not sent yet.
  const [restoredComments, setRestoredComments] = useState<
    Record<string, CommentData>
  >({})
  const boardComments = useMemo(
    () => mergeRestoredComments(initialData.comments, restoredComments),
    [initialData.comments, restoredComments],
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

  /**
   * Copy Board Link to Clipboard
   *
   * Copies the board's own address without a query: `?card=<id>` stays in
   * the address bar after a linked card was revealed. The address opens for
   * its owner alone; the toast says so, because everyone else who follows it
   * lands on "Board not found".
   */
  const handleCopyBoardLink = useCallback(async () => {
    const boardLink = `${window.location.origin}/board/${boardId}`
    try {
      await navigator.clipboard.writeText(boardLink)
      toast.success('Link copied!', {
        description: 'Only the account that owns this board can open it.',
      })
    } catch (error) {
      Sentry.captureException(error, { tags: { action: 'copyBoardLink' } })
      toast.error('Failed to copy link', {
        description: 'Please try again.',
      })
    }
  }, [boardId])

  return (
    <>
      {/* A div, not a second <main>: the layout around this page is the
          main region of the document (BoardLayoutClient) */}
      <div className="flex h-screen flex-col">
        {/* Header */}
        <header className="border-border bg-background border-b px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* sm:max-w: in the row the title gives way down to its longest
                word and no further, so a name without a space (50 characters
                are allowed) pushed all four buttons off the screen. The cap
                leaves 10rem, the width of the widest button, and the least
                width of the title is the smaller of the two. wrap-break-word
                on the title and the subtitle breaks the word that is wider
                than that; the least width of an ordinary name stays as it
                was. */}
            <div className="flex flex-col gap-1 sm:max-w-[calc(100%-10rem)]">
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
                className="text-foreground text-xl font-bold wrap-break-word sm:text-2xl"
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
                  className="text-muted-foreground text-sm wrap-break-word"
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
                onRepositoriesAdded={(createdCards: CreatedRepoCard[]) => {
                  // Optimistic UI update: cards appear instantly without a reload.
                  const newCards: RepoCardForRedux[] = createdCards.map(
                    ({ comment: _comment, ...card }) => ({
                      ...card,
                      title: `${card.repoOwner}/${card.repoName}`,
                      description:
                        (card.meta as { description?: string })?.description ||
                        '',
                    }),
                  )
                  dispatch(addRepoCards(newCards))
                  // A repository added again shows the comment it kept (issue #216)
                  setRestoredComments((previous) => ({
                    ...previous,
                    ...Object.fromEntries(
                      createdCards.map((card) => [card.id, card.comment]),
                    ),
                  }))
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
              <Button
                variant="outline"
                size="sm"
                onClick={(): void => {
                  void handleRefreshBoard()
                }}
                disabled={isRefreshingBoard || repoCards.length === 0}
                aria-busy={isRefreshingBoard}
                className="gap-1"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh from GitHub
              </Button>
            </div>
          </div>
        </header>

        {/* Kanban Board - horizontal scroll enabled for 6+ columns */}
        <div className="bg-background flex-1 overflow-x-auto overflow-y-auto">
          <KanbanBoard
            boardId={boardId}
            initialComments={boardComments}
            cardDisplaySettings={boardSettings.cardDisplaySettings}
            onMoveToAnotherBoard={handleMoveToAnotherBoard}
            onNote={noteModal.open}
            onRefresh={(cardId): void => {
              void handleRefreshCard(cardId)
            }}
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
      {noteModal.cardId && noteModal.repoKey && (
        <NoteModal
          isOpen={noteModal.isOpen}
          onClose={noteModal.close}
          onSave={noteModal.save}
          cardId={noteModal.cardId}
          repoKey={noteModal.repoKey}
          userId={board.user_id}
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
        boardSubtitle={boardSettings.displaySubtitle}
        onSubtitleSuccess={boardSettings.handleSubtitleChange}
        showSubtitle={boardSettings.showSubtitle}
        onShowSubtitleChange={boardSettings.handleShowSubtitleChange}
        onRenameSuccess={boardSettings.handleRenameSuccess}
        onCardDisplayChange={boardSettings.handleCardDisplayChange}
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
              {columnDeletion.shown.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={statusListDialog.cancelDelete}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={statusListDialog.confirmDelete}
              aria-label={`Delete column ${columnDeletion.shown.title}`}
            >
              Delete Column
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}, areServerRenderedPropsEqual)
