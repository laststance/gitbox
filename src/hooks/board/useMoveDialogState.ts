/**
 * useMoveDialogState Hook
 *
 * What one opening of {@link MoveToAnotherBoardDialog} holds besides the
 * boards it loaded: the destination picked so far, whether the create form
 * was asked for, the request the dialog is waiting for and the reason the
 * last move did not go through. The dialog reads them as one
 * {@link MoveDialogView} and changes them through named steps, so a step
 * that has to touch two of them (a refused move ends the wait and sets the
 * reason) cannot be done by half.
 */

import { useCallback, useState } from 'react'

import type { BoardOption } from '@/lib/actions/types'

import type { MoveDestinations } from './useMoveDestinations'

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
export type MoveDialogView =
  | { kind: 'loading' }
  | { kind: 'load-failed'; message: string }
  | { kind: 'create-board'; canChooseExisting: boolean }
  | {
      kind: 'choose-destination'
      boards: BoardOption[]
      selectedBoard: BoardOption
      selectedStatusId: string
    }

/** The request the dialog is waiting for; it cannot be closed meanwhile. */
export type PendingRequest = 'none' | 'move' | 'board-creation'

/** Why the last move did not go through. */
export interface MoveFailure {
  /** Text shown in the dialog. */
  message: string
  /**
   * `false` when the card may have moved all the same: the server answered
   * that the database gave it no answer (`MOVE_UNCONFIRMED`), or the request
   * failed on the way or got no answer in time. Also `false` when
   * {@link MoveFailure.isPageOutOfDate} is set: this page cannot move the
   * card. The dialog then offers to reload the page.
   */
  isOutcomeKnown: boolean
  /**
   * The server rejected the call without running it, because this page's
   * build no longer has that action. The card did not move, so the board is
   * not fetched again. Absent for every other failure.
   */
  isPageOutOfDate?: boolean
}

/**
 * Board and column chosen in this opening of the dialog: picked by hand, or
 * the board that was just created inside the dialog.
 */
interface DestinationSelection {
  boardId: string
  statusId: string
  /** The board was created in this dialog and nothing was picked since. */
  isCreatedBoard: boolean
}

interface UseMoveDialogStateParams {
  /** What {@link useMoveDestinations} loaded. */
  destinations: MoveDestinations
  /** Board the last move from this board went to, when there was one. */
  rememberedBoardId: string | undefined
}

interface UseMoveDialogStateReturn {
  /** What the body of the dialog shows right now. */
  view: MoveDialogView
  /** The request the dialog is waiting for. */
  pendingRequest: PendingRequest
  /** A request is running: the controls are disabled and the dialog stays open. */
  isBusy: boolean
  /** Why the last move did not go through, until the destination changes. */
  moveFailure: MoveFailure | null
  /** The selected board was created in this dialog and nothing was picked since. */
  isCreatedBoardSelected: boolean
  /** The user picked a board; its first column is the target until one is picked. */
  pickBoard: (boardId: string) => void
  /** The user picked a column of the board that is selected. */
  pickColumn: (boardId: string, statusId: string) => void
  /** Shows the create form in place of the selects ("New Board…"). */
  openCreateForm: () => void
  /** Shows the selects again; what was selected before is still selected. */
  closeCreateForm: () => void
  /** The move was sent; the reason of an earlier try is no longer shown. */
  startMove: () => void
  /** The creation of a destination board was sent. */
  startBoardCreation: () => void
  /** The request the dialog waited for is over. */
  endRequest: () => void
  /** The move did not go through: the wait is over and `failure` is shown. */
  failMove: (failure: MoveFailure) => void
  /** A board created in the dialog becomes the destination, selects shown. */
  selectCreatedBoard: (board: BoardOption) => void
}

/**
 * Holds what the user did in one opening of the move dialog and says what
 * the dialog shows for it. Exists so the dialog component is left with the
 * requests, the keyboard focus and the markup. Called once by
 * {@link MoveToAnotherBoardDialog}, which is mounted for each opening, so
 * every opening starts without a selection.
 *
 * A step that is followed by `.focus()` on a control it enables is called
 * inside `flushSync` by the dialog; the steps themselves only set state.
 *
 * @param params - The loaded destinations and the remembered board.
 * @returns The view, the request being waited for and the steps that change
 * them (see {@link UseMoveDialogStateReturn}).
 * @example
 * const { view, isBusy, pickBoard, startMove, failMove } = useMoveDialogState({
 *   destinations: { status: 'ready', boards: [workBoard, archiveBoard] },
 *   rememberedBoardId: archiveBoard.id,
 * })
 * // view => { kind: 'choose-destination', boards: [workBoard, archiveBoard],
 * //           selectedBoard: archiveBoard, selectedStatusId: archiveBoard.statusLists[0].id }
 */
export function useMoveDialogState({
  destinations,
  rememberedBoardId,
}: UseMoveDialogStateParams): UseMoveDialogStateReturn {
  const [selection, setSelection] = useState<DestinationSelection | null>(null)
  const [isCreateFormRequested, setIsCreateFormRequested] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<PendingRequest>('none')
  const [moveFailure, setMoveFailure] = useState<MoveFailure | null>(null)

  const view = toMoveDialogView({
    destinations,
    isCreateFormRequested,
    selection,
    rememberedBoardId,
  })

  // A refusal was about the destination it was sent for; it no longer
  // applies once the target changes.
  const pickBoard = useCallback((boardId: string) => {
    setSelection({ boardId, statusId: '', isCreatedBoard: false })
    setMoveFailure(null)
  }, [])

  const pickColumn = useCallback((boardId: string, statusId: string) => {
    setSelection({ boardId, statusId, isCreatedBoard: false })
    setMoveFailure(null)
  }, [])

  const openCreateForm = useCallback(() => {
    setIsCreateFormRequested(true)
  }, [])

  const closeCreateForm = useCallback(() => {
    setIsCreateFormRequested(false)
  }, [])

  const startMove = useCallback(() => {
    setPendingRequest('move')
    setMoveFailure(null)
  }, [])

  const startBoardCreation = useCallback(() => {
    setPendingRequest('board-creation')
  }, [])

  const endRequest = useCallback(() => {
    setPendingRequest('none')
  }, [])

  const failMove = useCallback((failure: MoveFailure) => {
    setPendingRequest('none')
    setMoveFailure(failure)
  }, [])

  const selectCreatedBoard = useCallback((board: BoardOption) => {
    setSelection({
      boardId: board.id,
      statusId: board.statusLists[0]?.id ?? '',
      isCreatedBoard: true,
    })
    setIsCreateFormRequested(false)
    setMoveFailure(null)
    setPendingRequest('none')
  }, [])

  return {
    view,
    pendingRequest,
    isBusy: pendingRequest !== 'none',
    moveFailure,
    isCreatedBoardSelected: selection?.isCreatedBoard ?? false,
    pickBoard,
    pickColumn,
    openCreateForm,
    closeCreateForm,
    startMove,
    startBoardCreation,
    endRequest,
    failMove,
    selectCreatedBoard,
  }
}

/**
 * Decides what the body of the dialog shows, and which board and column a
 * move would go to. Pure, so every row of the dialog's state table is one
 * return of this function.
 *
 * The board is the one picked by hand, else the one the last move from this
 * board went to, else the first (the newest, the likeliest destination).
 * The column is the one picked by hand when it belongs to that board, else
 * the board's first: the left-most column of its first row, because the
 * columns arrive in the order the board shows them.
 *
 * @param destinations - What {@link useMoveDestinations} loaded.
 * @param isCreateFormRequested - The user pressed "New Board…".
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
