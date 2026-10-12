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
 *
 * While a move or a board creation waits for the server the dialog does not
 * close, so the answer arrives where it was asked for. The wait has an end
 * ({@link SERVER_ANSWER_TIME_LIMIT_MS}): a request that never settles would
 * keep the dialog locked otherwise.
 *
 * Every control is disabled for that time, and a disabled control loses the
 * keyboard focus. So each ending puts the focus on the control the user needs
 * next, and a view that appears takes it when nothing else holds it.
 */

'use client'

import * as Sentry from '@sentry/nextjs'
import {
  ArrowRightLeft,
  Columns3,
  Globe,
  LayoutGrid,
  Loader2,
  Plus,
} from 'lucide-react'
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
import { useCardDialogFocusReturn } from '@/hooks/board/useCardDialogFocusReturn'
import { useMoveDestinations } from '@/hooks/board/useMoveDestinations'
import {
  useMoveDialogState,
  type MoveFailure,
} from '@/hooks/board/useMoveDialogState'
import { moveCardToBoard } from '@/lib/actions/repo-cards'
import type { ActionResult } from '@/lib/actions/types'
import { SERVER_ANSWER_TIME_LIMIT_MS } from '@/lib/constants/requests'
import { TOAST_WITH_ACTION_DURATION_MS } from '@/lib/constants/toast'
import {
  boardRefreshRequested,
  trackBoardWrite,
} from '@/lib/redux/slices/boardSyncSlice'
import {
  selectMoveDestination,
  setMoveDestination,
} from '@/lib/redux/slices/settingsSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { RepoCardId } from '@/lib/types/brands'
import { reloadPage } from '@/lib/utils/reload-page'
import { requestBoardCreation } from '@/lib/utils/request-board-creation'
import { settleWithin, type RequestOutcome } from '@/lib/utils/settle-within'

import {
  CreateDestinationBoardForm,
  type BoardCreationFailure,
} from './CreateDestinationBoardForm'

/** Shown when a refused move comes without a message of its own. */
const MOVE_FAILED_MESSAGE = 'Failed to move card'

/**
 * Shown when it is not known whether the card was moved: the request failed
 * on the way or got no answer in time. The board is fetched again then, so
 * the screen shows where the card is. That fetch waits for the request to
 * settle, so "Reload page" is offered next to this text.
 */
const MOVE_UNCONFIRMED_MESSAGE =
  'Could not confirm that the card was moved. Check the board before trying again.'

/**
 * Id of the sentence shown when the selected board is shared through a
 * public link. The Move button is described by it.
 */
const PUBLIC_DESTINATION_TEXT_ID = 'move-dialog-public-destination'

/**
 * Id of the sentence shown above the create form when the user has no other
 * board. The name field is described by it.
 */
const NO_OTHER_BOARD_TEXT_ID = 'move-dialog-no-other-board'

interface MoveToAnotherBoardDialogProps {
  /** Callback when dialog should close */
  onClose: () => void
  /** RepoCard ID to move */
  cardId: RepoCardId
  /**
   * Repository display name (owner/name). Read when the dialog opens and
   * kept: the card can leave the board while the dialog is still open (a move
   * without a confirmation that went through), and the caller, which reads
   * the name from the cards on the board, then has none to hand over.
   */
  repoName: string
  /** Current board ID (excluded from target list) */
  currentBoardId: string
  /** Callback after successful move */
  onMoved: (cardId: RepoCardId) => void
}

/**
 * Dialog for moving a repo card to another board: loads the destinations,
 * lets the user pick or create one and sends the move.
 *
 * It has no `open` prop. The caller renders it while a card is being moved
 * and removes it afterwards, so every opening loads the boards afresh and
 * starts without a selection.
 *
 * @param onClose - Called when dialog closes
 * @param cardId - ID of the card to move
 * @param repoName - Display name of the repository, as it is when the dialog opens
 * @param currentBoardId - Current board ID (filtered from list)
 * @param onMoved - Called after successful move with the card ID
 *
 * @example
 * {moveDialogCardId && (
 *   <MoveToAnotherBoardDialog
 *     onClose={() => setMoveDialogCardId(null)}
 *     cardId={moveDialogCardId}
 *     repoName="owner/repo-name"
 *     currentBoardId="board-uuid-456"
 *     onMoved={(id) => dispatch(removeMovedRepoCard(boardId, id))}
 *   />
 * )}
 */
export const MoveToAnotherBoardDialog = memo(function MoveToAnotherBoardDialog({
  onClose,
  cardId,
  repoName: repoNameAtOpening,
  currentBoardId,
  onMoved,
}: MoveToAnotherBoardDialogProps) {
  const dispatch = useAppDispatch()
  const router = useRouter()
  // The name the dialog was opened with; later values of the prop are not read
  const [repoName] = useState(repoNameAtOpening)
  // Board the last move from this board went to; the dialog opens on it
  const rememberedBoardId = useAppSelector((state) =>
    selectMoveDestination(state, currentBoardId),
  )
  const { destinations, reloadDestinations, addDestination } =
    useMoveDestinations(currentBoardId)
  const { rememberCardSuccessor, rememberCardMayLeave, handleCloseAutoFocus } =
    useCardDialogFocusReturn(cardId)

  const {
    view,
    pendingRequest,
    isBusy,
    moveFailure,
    isCreatedBoardSelected,
    pickBoard,
    pickColumn,
    openCreateForm,
    closeCreateForm,
    startMove,
    startBoardCreation,
    endRequest,
    failMove,
    selectCreatedBoard,
  } = useMoveDialogState({ destinations, rememberedBoardId })

  const dialogContentRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const moveButtonRef = useRef<HTMLButtonElement>(null)
  const boardSelectRef = useRef<HTMLButtonElement>(null)

  // Ref callback of the control a view opens on. The dialog opens while the
  // boards are loading, when Cancel is the only control it can focus; the
  // control that appears afterwards takes the keyboard, unless the user has
  // put it somewhere by then.
  const focusWhenAtRest = useCallback(
    (control: HTMLButtonElement | null): void => {
      if (
        control &&
        isFocusAtRest(dialogContentRef.current, cancelButtonRef.current)
      ) {
        control.focus()
      }
    },
    [],
  )

  const attachBoardSelect = useCallback(
    (boardSelect: HTMLButtonElement | null): void => {
      boardSelectRef.current = boardSelect
      focusWhenAtRest(boardSelect)
    },
    [focusWhenAtRest],
  )

  // Read to a screen reader after a board was created here: the keyboard
  // focus goes to Move then, which alone does not say where the card goes
  const createdBoardAnnouncement =
    view.kind === 'choose-destination' && isCreatedBoardSelected
      ? `Board ${view.selectedBoard.name} was created and is selected as the destination.`
      : ''

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

    startMove()
    // Picked while the card surely stands in its column. A move that is not
    // confirmed has the board fetched again, and the card can be gone from it
    // before the dialog closes; its neighbor takes the keyboard then.
    rememberCardMayLeave()

    // Counted as a board write: data fetched meanwhile may not hold it yet.
    // Only the request is guarded here, so nothing that follows a confirmed
    // move can be mistaken for a failed one.
    const outcome = await settleWithin(
      trackBoardWrite(
        dispatch,
        moveCardToBoard(cardId, selectedBoard.id, selectedStatusId),
      ),
      SERVER_ANSWER_TIME_LIMIT_MS,
    )

    const failure = toMoveFailure(outcome)
    if (failure) {
      if (outcome.status === 'failed') {
        Sentry.captureException(outcome.error, {
          tags: { action: 'moveCardToBoard' },
        })
      } else if (outcome.status === 'overdue') {
        Sentry.captureMessage('moveCardToBoard got no answer in time', {
          level: 'warning',
          tags: { action: 'moveCardToBoard' },
        })
      }
      // flushSync: Move is enabled again once this returns, and takes back
      // the focus it lost when it was disabled for the request
      flushSync(() => failMove(failure))
      moveButtonRef.current?.focus()
      // The card may have moved all the same (an answer that was lost on the
      // way, or a refused second try of a move that went through): fetch the
      // board again so the screen shows where it is
      dispatch(boardRefreshRequested())
      return
    }

    endRequest()
    dispatch(
      setMoveDestination({
        sourceBoardId: currentBoardId,
        destinationBoardId: selectedBoard.id,
      }),
    )
    toast.success(`Moved to ${selectedBoard.name}`, {
      description: repoName,
      duration: TOAST_WITH_ACTION_DURATION_MS,
      action: {
        label: 'Open board',
        onClick: () => router.push(`/board/${selectedBoard.id}`),
      },
    })
    // Before the card is gone: its neighbor takes the keyboard focus
    rememberCardSuccessor()
    onMoved(cardId)
    onClose()
  }

  /**
   * Ends the wait for a creation that gave no board to select.
   * flushSync: the form is unlocked on screen once this returns, so it can
   * take the keyboard focus back.
   * @param failure - What the form shows.
   * @returns The same failure, for the form.
   */
  const endCreationWith = (
    failure: BoardCreationFailure,
  ): BoardCreationFailure => {
    flushSync(endRequest)
    return failure
  }

  /**
   * Creates the destination board with one column and selects it.
   * @param boardName - Validated name from the form.
   * @returns `null` when the board exists; otherwise what the form shows,
   * with `isOutcomeKnown: false` when a board may exist all the same.
   */
  const createDestinationBoard = async (
    boardName: string,
  ): Promise<BoardCreationFailure | null> => {
    startBoardCreation()

    const attempt = await requestBoardCreation(boardName, 'single-column')

    if (attempt.status !== 'created') {
      return endCreationWith({
        message: attempt.message,
        // After an unconfirmed creation a board may exist
        isOutcomeKnown: attempt.status === 'not-created',
      })
    }

    const createdBoard = attempt.board
    // flushSync: the selects and the enabled Move button exist once this
    // returns, and focus goes to the button right after
    flushSync(() => {
      addDestination(createdBoard)
      selectCreatedBoard(createdBoard)
    })
    moveButtonRef.current?.focus()
    return null
  }

  const handleChooseExisting = (): void => {
    // flushSync: the board select exists once this returns
    flushSync(closeCreateForm)
    boardSelectRef.current?.focus()
  }

  // After a creation with an unknown outcome the list on screen may lack a
  // board that exists: load it again and show it in place of the form
  const handleReloadBoards = (): void => {
    closeCreateForm()
    reloadDestinations()
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        ref={dialogContentRef}
        className="sm:max-w-md"
        accessibleTitle="Move to Another Board"
        // The dialog does not close while a request runs
        isCloseDisabled={isBusy}
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="text-primary h-5 w-5" />
            Move to Another Board
          </DialogTitle>
          <DialogDescription>
            Move <span className="text-foreground font-medium">{repoName}</span>{' '}
            to a different board. Notes, links, and comments will be preserved.
          </DialogDescription>
        </DialogHeader>

        <p role="status" className="sr-only">
          {createdBoardAnnouncement}
        </p>

        {match(view)
          .with({ kind: 'loading' }, () => (
            <div
              role="status"
              className="flex items-center justify-center py-8"
            >
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
                ref={focusWhenAtRest}
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
                <p
                  id={NO_OTHER_BOARD_TEXT_ID}
                  className="text-muted-foreground pt-2 text-sm"
                >
                  You have no other board yet. Create one to move this
                  repository to.
                </p>
              )}
              <CreateDestinationBoardForm
                isCreating={pendingRequest === 'board-creation'}
                createBoardAction={createDestinationBoard}
                onReloadBoards={handleReloadBoards}
                onChooseExisting={
                  canChooseExisting ? handleChooseExisting : undefined
                }
                introductionId={
                  canChooseExisting ? undefined : NO_OTHER_BOARD_TEXT_ID
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
                    onValueChange={pickBoard}
                    // A request in flight belongs to the destination it was sent for
                    disabled={isBusy}
                  >
                    <SelectTrigger
                      id="board-select"
                      className="w-full"
                      ref={attachBoardSelect}
                    >
                      <SelectValue placeholder="Select a board" />
                    </SelectTrigger>
                    <SelectContent>
                      {boards.map((board) => (
                        <SelectItem key={board.id} value={board.id}>
                          <span className="flex items-center gap-2">
                            {board.name}
                            {/* The mark the board list puts on a shared board */}
                            {board.isPublic && (
                              <Globe
                                className="text-muted-foreground h-4 w-4 shrink-0"
                                role="img"
                                aria-label="Public board"
                              />
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* An outline button: the link variant is text-primary
                        without an underline, which is below AA contrast in
                        most themes. pointer-coarse: a 44px target for a
                        thumb, right under the select. */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="pointer-coarse:min-h-11"
                    disabled={isBusy}
                    onClick={openCreateForm}
                  >
                    <Plus aria-hidden="true" />
                    New Board...
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
                      pickColumn(selectedBoard.id, statusId)
                    }
                    disabled={isBusy || selectedBoard.statusLists.length === 0}
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
                      This board has no columns. Add columns to the board first.{' '}
                      {/* Opening a board without columns gives it the default ones.
                            text-foreground + underline: text-primary is below
                            AA contrast in most themes. */}
                      <Link
                        href={`/board/${selectedBoard.id}`}
                        className="text-foreground focus-visible:ring-primary rounded-sm underline underline-offset-4 hover:decoration-2 focus-visible:ring-2 focus-visible:outline-none"
                        onClick={handleClose}
                      >
                        Open {selectedBoard.name}
                      </Link>
                    </p>
                  )}
                </div>

                {/* A card on a shared board is readable through its link;
                      the board list alone does not say what that means */}
                {selectedBoard.isPublic && (
                  <p
                    id={PUBLIC_DESTINATION_TEXT_ID}
                    className="text-foreground flex items-start gap-2 text-sm"
                  >
                    <Globe
                      className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {selectedBoard.name} is shared by a public link. Anyone
                      who has the link will see this repository there, with its
                      description. Notes, links, and comments stay private.
                    </span>
                  </p>
                )}

                {moveFailure && (
                  <div className="space-y-2">
                    <p className="text-destructive text-sm" role="alert">
                      {moveFailure.message}
                    </p>
                    {/* The fetch of the board waits behind a request that
                          has no answer yet; a reload does not */}
                    {!moveFailure.isOutcomeKnown && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="pointer-coarse:min-h-11"
                        onClick={reloadPage}
                      >
                        Reload page
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ),
          )
          .exhaustive()}

        <DialogFooter>
          <Button
            ref={cancelButtonRef}
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
            // Read with the button: pressing it makes the card public
            aria-describedby={
              view.kind === 'choose-destination' && view.selectedBoard.isPublic
                ? PUBLIC_DESTINATION_TEXT_ID
                : undefined
            }
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
})

/**
 * Tells whether the keyboard focus is where the dialog left it, not where
 * the user put it: outside the dialog (the page takes the focus of a control
 * that was removed or disabled), on the dialog itself, or on Cancel, the one
 * control the dialog can focus when it opens while the boards are loading.
 * Called by the dialog before the first control of a view takes the focus.
 *
 * @param dialogContent - The dialog element, or `null` before it is mounted.
 * @param cancelButton - The Cancel button, or `null` before it is mounted.
 * @returns
 * - `true` when the focus is free to be moved
 * - `false` when it is on a control the user moved it to (Move, the close
 *   button, a field)
 * @example
 * // The dialog just opened and Radix focused Cancel
 * isFocusAtRest(dialogContent, cancelButton) // => true
 */
function isFocusAtRest(
  dialogContent: HTMLElement | null,
  cancelButton: HTMLElement | null,
): boolean {
  const focusedElement = document.activeElement
  return (
    !dialogContent?.contains(focusedElement) ||
    focusedElement === dialogContent ||
    focusedElement === cancelButton
  )
}

/**
 * Says what the dialog shows for a move that did not go through.
 *
 * @param outcome - How the move request ended.
 * @returns
 * - `null` when the server confirmed the move
 * - the server's reason when it refused the move (`isOutcomeKnown: true`)
 * - {@link MOVE_UNCONFIRMED_MESSAGE} with `isOutcomeKnown: false` when the
 *   request failed on the way or got no answer in time, so the card may have
 *   moved all the same
 * @example
 * toMoveFailure({ status: 'overdue' })
 * // => { message: 'Could not confirm that the card was moved. Check the board before trying again.',
 * //      isOutcomeKnown: false }
 */
function toMoveFailure(
  outcome: RequestOutcome<ActionResult<void>>,
): MoveFailure | null {
  return match(outcome)
    .with({ status: 'answered' }, ({ answer }) =>
      answer.success
        ? null
        : {
            message: answer.error || MOVE_FAILED_MESSAGE,
            isOutcomeKnown: true,
          },
    )
    .with({ status: 'failed' }, { status: 'overdue' }, () => ({
      message: MOVE_UNCONFIRMED_MESSAGE,
      isOutcomeKnown: false,
    }))
    .exhaustive()
}
