/**
 * Move to Another Board Dialog
 *
 * Moves a repository card from the board on screen to another board of the
 * same user. The card keeps its id, so its note, links and comment go with
 * it. This is how a repository is set aside and brought back: park it on a
 * board of its own, move it to a working board again later.
 *
 * What the dialog shows:
 * - the user's other boards and, for the chosen one, its columns
 * - a form that creates the destination board on the spot, when the user has
 *   no other board or asks for a new one
 * - a failed load with "Try again", and a board without columns with a link
 *   to it
 */

'use client'

import { ArrowRightLeft, Columns3, LayoutGrid, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { memo, useCallback, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'
import { match } from 'ts-pattern'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useMoveDestinations,
  type MoveDestinations,
} from '@/hooks/board/useMoveDestinations'
import { createBoard } from '@/lib/actions/board'
import { moveCardToBoard } from '@/lib/actions/repo-cards'
import type { BoardOption } from '@/lib/actions/types'
import { trackBoardWrite } from '@/lib/redux/slices/boardSyncSlice'
import {
  selectMoveDestination,
  setMoveDestination,
} from '@/lib/redux/slices/settingsSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { RepoCardId } from '@/lib/types/brands'

import { CreateDestinationBoardForm } from './CreateDestinationBoardForm'

/** Shown when a move or a board creation fails without a message of its own. */
const MOVE_FAILED_MESSAGE = 'Failed to move card'
const BOARD_CREATION_FAILED_MESSAGE = 'Failed to create board'

interface MoveToAnotherBoardDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when dialog should close */
  onClose: () => void
  /** RepoCard ID to move */
  cardId: RepoCardId
  /** Repository display name (owner/name) */
  repoName: string
  /** Current board ID (excluded from target list) */
  currentBoardId: string
  /** Callback after successful move */
  onMoved: (cardId: RepoCardId) => void
}

/**
 * Dialog for moving a repo card to another board.
 *
 * Its body is mounted for each opening and gone when the dialog closes, so
 * every opening loads the boards afresh and starts without a selection.
 *
 * @param isOpen - Controls dialog visibility
 * @param onClose - Called when dialog closes
 * @param cardId - ID of the card to move
 * @param repoName - Display name of the repository
 * @param currentBoardId - Current board ID (filtered from list)
 * @param onMoved - Called after successful move with the card ID
 *
 * @example
 * <MoveToAnotherBoardDialog
 *   isOpen={!!moveDialogCardId}
 *   onClose={() => setMoveDialogCardId(null)}
 *   cardId="card-uuid-123"
 *   repoName="owner/repo-name"
 *   currentBoardId="board-uuid-456"
 *   onMoved={(id) => dispatch(removeMovedRepoCard(boardId, id))}
 * />
 */
export const MoveToAnotherBoardDialog = memo(function MoveToAnotherBoardDialog({
  isOpen,
  ...openDialogProps
}: MoveToAnotherBoardDialogProps) {
  if (!isOpen) return null
  return <OpenMoveToAnotherBoardDialog {...openDialogProps} />
})

/**
 * What the body of the dialog shows. One value, so the states cannot mix.
 * - `loading`: the boards are on their way
 * - `load-failed`: they could not be loaded
 * - `create-board`: the form that makes a new destination board;
 *   `canChooseExisting` is `false` when the user has no other board
 * - `choose-destination`: the board and column selects, with the board and
 *   the column a move would go to right now (`selectedStatusId` is `''`
 *   when that board has no column)
 */
type MoveDialogView =
  | { kind: 'loading' }
  | { kind: 'load-failed'; message: string }
  | { kind: 'create-board'; canChooseExisting: boolean }
  | {
      kind: 'choose-destination'
      boards: BoardOption[]
      selectedBoard: BoardOption
      selectedStatusId: string
    }

/** Board and column the user picked by hand in this opening of the dialog. */
interface DestinationSelection {
  boardId: string
  statusId: string
}

/** The request the dialog is waiting for; it cannot be closed meanwhile. */
type PendingRequest = 'none' | 'move' | 'board-creation'

/**
 * The open dialog: loads the destinations, lets the user pick or create one
 * and sends the move. Rendered by {@link MoveToAnotherBoardDialog} for each
 * opening.
 */
const OpenMoveToAnotherBoardDialog = memo(
  function OpenMoveToAnotherBoardDialog({
    onClose,
    cardId,
    repoName,
    currentBoardId,
    onMoved,
  }: Omit<MoveToAnotherBoardDialogProps, 'isOpen'>) {
    const dispatch = useAppDispatch()
    const router = useRouter()
    // Board the last move from this board went to; the dialog opens on it
    const rememberedBoardId = useAppSelector((state) =>
      selectMoveDestination(state, currentBoardId),
    )
    const { destinations, reloadDestinations, addDestination } =
      useMoveDestinations(currentBoardId)

    const [selection, setSelection] = useState<DestinationSelection | null>(
      null,
    )
    const [isCreateFormRequested, setIsCreateFormRequested] = useState(false)
    const [pendingRequest, setPendingRequest] = useState<PendingRequest>('none')
    const [moveError, setMoveError] = useState<string | null>(null)

    const moveButtonRef = useRef<HTMLButtonElement>(null)
    const boardSelectRef = useRef<HTMLButtonElement>(null)

    const view = toMoveDialogView({
      destinations,
      isCreateFormRequested,
      selection,
      rememberedBoardId,
    })
    const isBusy = pendingRequest !== 'none'

    // A previous move error (e.g. the target board already holds this
    // repository) no longer applies once the target changes.
    const handleBoardChange = useCallback((boardId: string) => {
      setSelection({ boardId, statusId: '' })
      setMoveError(null)
    }, [])

    const handleStatusChange = useCallback(
      (boardId: string, statusId: string) => {
        setSelection({ boardId, statusId })
        setMoveError(null)
      },
      [],
    )

    // Escape, a click outside and Cancel all end here. While a request is
    // running the dialog stays open, so its answer never arrives in a dialog
    // that is gone.
    const handleClose = useCallback(() => {
      if (isBusy) return
      onClose()
    }, [isBusy, onClose])

    const handleMove = async (): Promise<void> => {
      // No destination is selected while the create form is shown, and a
      // board without columns cannot take a card
      if (view.kind !== 'choose-destination' || !view.selectedStatusId) return
      const { selectedBoard, selectedStatusId } = view

      setPendingRequest('move')
      setMoveError(null)

      try {
        // Counted as a board write: data fetched meanwhile may not hold it yet
        const result = await trackBoardWrite(
          dispatch,
          moveCardToBoard(cardId, selectedBoard.id, selectedStatusId),
        )

        if (!result.success) {
          setMoveError(result.error || MOVE_FAILED_MESSAGE)
          return
        }

        dispatch(
          setMoveDestination({
            sourceBoardId: currentBoardId,
            destinationBoardId: selectedBoard.id,
          }),
        )
        toast.success(`Moved to ${selectedBoard.name}`, {
          description: repoName,
          action: {
            label: 'Open board',
            onClick: () => router.push(`/board/${selectedBoard.id}`),
          },
        })
        onMoved(cardId)
        onClose()
      } catch {
        setMoveError(MOVE_FAILED_MESSAGE)
      } finally {
        setPendingRequest('none')
      }
    }

    /**
     * Creates the destination board with one column and selects it.
     * @param boardName - Validated name from the form.
     * @returns The text for the form to show when no board was created, else `null`.
     */
    const createDestinationBoard = async (
      boardName: string,
    ): Promise<string | null> => {
      setPendingRequest('board-creation')

      try {
        const result = await createBoard(boardName, 'single-column')
        if (!result.success) return result.error

        const createdBoard = result.data
        // flushSync: the selects and the enabled Move button exist once this
        // returns, and focus goes to the button right after
        flushSync(() => {
          addDestination(createdBoard)
          setSelection({
            boardId: createdBoard.id,
            statusId: createdBoard.statusLists[0]?.id ?? '',
          })
          setIsCreateFormRequested(false)
          setMoveError(null)
          setPendingRequest('none')
        })
        moveButtonRef.current?.focus()
        return null
      } catch {
        // The request itself failed, so it is unknown whether a board exists
        return BOARD_CREATION_FAILED_MESSAGE
      } finally {
        setPendingRequest('none')
      }
    }

    const handleChooseExisting = (): void => {
      // flushSync: the board select exists once this returns
      flushSync(() => setIsCreateFormRequested(false))
      boardSelectRef.current?.focus()
    }

    return (
      <Dialog open onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DialogContent
          className="sm:max-w-md"
          accessibleTitle="Move to Another Board"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="text-primary h-5 w-5" />
              Move to Another Board
            </DialogTitle>
            <DialogDescription>
              Move{' '}
              <span className="text-foreground font-medium">{repoName}</span> to
              a different board. Notes, links, and comments will be preserved.
            </DialogDescription>
          </DialogHeader>

          {match(view)
            .with({ kind: 'loading' }, () => (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                <span className="text-muted-foreground ml-2 text-sm">
                  Loading boards...
                </span>
              </div>
            ))
            .with({ kind: 'load-failed' }, ({ message }) => (
              <div className="space-y-3 py-8 text-center">
                <p className="text-destructive text-sm" role="alert">
                  {message}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={reloadDestinations}
                >
                  Try again
                </Button>
              </div>
            ))
            .with({ kind: 'create-board' }, ({ canChooseExisting }) => (
              <div>
                {!canChooseExisting && (
                  <p className="text-muted-foreground pt-2 text-sm">
                    You have no other board yet. Create one to move this
                    repository to.
                  </p>
                )}
                <CreateDestinationBoardForm
                  isCreating={pendingRequest === 'board-creation'}
                  createBoardAction={createDestinationBoard}
                  onChooseExisting={
                    canChooseExisting ? handleChooseExisting : undefined
                  }
                />
              </div>
            ))
            .with(
              { kind: 'choose-destination' },
              ({ boards, selectedBoard, selectedStatusId }) => (
                <div className="space-y-4 py-2">
                  {/* Board Selection */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="board-select"
                      className="flex items-center gap-2"
                    >
                      <LayoutGrid className="text-muted-foreground h-4 w-4" />
                      Board
                    </Label>
                    <Select
                      value={selectedBoard.id}
                      onValueChange={handleBoardChange}
                    >
                      <SelectTrigger
                        id="board-select"
                        className="w-full"
                        ref={boardSelectRef}
                      >
                        <SelectValue placeholder="Select a board" />
                      </SelectTrigger>
                      <SelectContent>
                        {boards.map((board) => (
                          <SelectItem key={board.id} value={board.id}>
                            {board.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      disabled={isBusy}
                      onClick={() => setIsCreateFormRequested(true)}
                    >
                      New board…
                    </Button>
                  </div>

                  {/* Status (Column) Selection */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="status-select"
                      className="flex items-center gap-2"
                    >
                      <Columns3 className="text-muted-foreground h-4 w-4" />
                      Column
                    </Label>
                    <Select
                      value={selectedStatusId}
                      onValueChange={(statusId) =>
                        handleStatusChange(selectedBoard.id, statusId)
                      }
                      disabled={selectedBoard.statusLists.length === 0}
                    >
                      <SelectTrigger id="status-select" className="w-full">
                        <SelectValue
                          placeholder={
                            selectedBoard.statusLists.length === 0
                              ? 'No columns available'
                              : 'Select a column'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedBoard.statusLists.map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block h-3 w-3 rounded-full"
                                style={{ backgroundColor: status.color }}
                                aria-hidden="true"
                              />
                              {status.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedBoard.statusLists.length === 0 && (
                      <p className="text-muted-foreground text-xs">
                        This board has no columns. Add columns to the board
                        first.{' '}
                        {/* Opening a board without columns gives it the default ones */}
                        <Link
                          href={`/board/${selectedBoard.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                          onClick={handleClose}
                        >
                          Open {selectedBoard.name}
                        </Link>
                      </p>
                    )}
                  </div>

                  {moveError && (
                    <p className="text-destructive text-sm" role="alert">
                      {moveError}
                    </p>
                  )}
                </div>
              ),
            )
            .exhaustive()}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              ref={moveButtonRef}
              onClick={handleMove}
              disabled={
                isBusy ||
                view.kind !== 'choose-destination' ||
                !view.selectedStatusId
              }
            >
              {pendingRequest === 'move' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Moving...
                </>
              ) : (
                'Move'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  },
)

/**
 * Decides what the body of the dialog shows, and which board and column a
 * move would go to. Pure, so every row of the dialog's state table is one
 * return of this function.
 *
 * The board is the one picked by hand, else the one the last move from this
 * board went to, else the first. The column is the one picked by hand when it
 * belongs to that board, else the board's first.
 *
 * @param destinations - What {@link useMoveDestinations} loaded.
 * @param isCreateFormRequested - The user pressed "New board…".
 * @param selection - Board and column picked by hand, or `null`.
 * @param rememberedBoardId - Destination of the last move from this board.
 * @returns The {@link MoveDialogView} to render.
 * @example
 * toMoveDialogView({
 *   destinations: { status: 'ready', boards: [] },
 *   isCreateFormRequested: false,
 *   selection: null,
 *   rememberedBoardId: undefined,
 * }) // => { kind: 'create-board', canChooseExisting: false }
 */
function toMoveDialogView({
  destinations,
  isCreateFormRequested,
  selection,
  rememberedBoardId,
}: {
  destinations: MoveDestinations
  isCreateFormRequested: boolean
  selection: DestinationSelection | null
  rememberedBoardId: string | undefined
}): MoveDialogView {
  if (destinations.status === 'loading') return { kind: 'loading' }
  if (destinations.status === 'failed') {
    return { kind: 'load-failed', message: destinations.message }
  }

  const { boards } = destinations
  const [firstBoard] = boards
  // Without another board there is nothing to choose: only the form is left
  if (!firstBoard || isCreateFormRequested) {
    return { kind: 'create-board', canChooseExisting: Boolean(firstBoard) }
  }

  const selectedBoard =
    boards.find((board) => board.id === selection?.boardId) ??
    boards.find((board) => board.id === rememberedBoardId) ??
    firstBoard
  const isPickedColumnOnBoard = selectedBoard.statusLists.some(
    (status) => status.id === selection?.statusId,
  )
  const selectedStatusId =
    selection && isPickedColumnOnBoard
      ? selection.statusId
      : (selectedBoard.statusLists[0]?.id ?? '')

  return { kind: 'choose-destination', boards, selectedBoard, selectedStatusId }
}
