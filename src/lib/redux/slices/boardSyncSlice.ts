/**
 * Board Sync Slice
 *
 * Bookkeeping that stops data fetched again from the server from replacing
 * what the user did on the board in the meantime. A fetch started before a
 * drag was saved comes back without that drag; putting it in the store would
 * move the card back on screen while the database holds the new place.
 *
 * Not persisted: every value describes requests of the current page load.
 */

import type { Dispatch, PayloadAction } from '@reduxjs/toolkit'
import { createSlice, isAnyOf } from '@reduxjs/toolkit'

import { SERVER_ANSWER_TIME_LIMIT_MS } from '@/lib/constants/requests'
import type { BoardId, RepoCardId } from '@/lib/types/brands'

import {
  addRepoCards,
  removeRepoCard,
  setRepoCards,
  setStatusLists,
} from './boardSlice'

/** Shape of the `state.boardSync` Redux slice. */
interface BoardSyncState {
  /**
   * Board writes sent to the server that have neither settled nor waited
   * longer than {@link SERVER_ANSWER_TIME_LIMIT_MS} for their answer.
   */
  pendingWriteCount: number
  /** Goes up on every change to the cards or columns in the store. */
  contentRevision: number
  /**
   * `contentRevision` when the fetch in flight was sent, or `null` when no
   * fetch is in flight. The fetched data is current only while both match.
   */
  sentRefreshRevision: number | null
  /** The board has to be fetched again and that fetch has not been sent yet. */
  isRefreshWanted: boolean
  /**
   * Board whose server data the store holds, or `null` before any board was
   * opened. Kept here and not in a component because the store outlives the
   * board page: to a page that is mounted again (the board was left and
   * opened again) every copy would look like the first data of a board.
   */
  hydratedBoardId: BoardId | null
}

const initialState: BoardSyncState = {
  pendingWriteCount: 0,
  contentRevision: 0,
  sentRefreshRevision: null,
  isRefreshWanted: false,
  hydratedBoardId: null,
}

export const boardSyncSlice = createSlice({
  name: 'boardSync',
  initialState,
  reducers: {
    /** A board write went to the server. Dispatched by {@link trackBoardWrite}. */
    boardWriteStarted: (state) => {
      state.pendingWriteCount += 1
    },
    /**
     * That write was saved or refused, or got no answer within the time
     * limit. Dispatched by {@link trackBoardWrite}.
     */
    boardWriteSettled: (state) => {
      state.pendingWriteCount = Math.max(0, state.pendingWriteCount - 1)
    },
    /**
     * The store can no longer be trusted to match the database, so the board
     * has to be fetched again. {@link useBoardServerSync} sends the fetch once
     * no write is pending.
     */
    boardRefreshRequested: (state) => {
      state.isRefreshWanted = true
    },
    /** The fetch went out; remember what the board looked like at that moment. */
    boardRefreshSent: (state) => {
      state.isRefreshWanted = false
      state.sentRefreshRevision = state.contentRevision
    },
    /**
     * Server data of this board went into the store, so no fetch is in flight
     * any more. A fetch still wanted for the board shown before is dropped.
     *
     * Pending writes are counted for the whole app, not per board. Data shown
     * for another board while a save is pending may therefore be that save's
     * own board, read before the save landed (drag, open another board, come
     * back). It is shown, and the board is fetched once more when the save
     * has settled. The price is one fetch too many for a board opened while
     * a save of another board was pending.
     *
     * @param action.payload - The {@link BoardId} the data belongs to.
     */
    serverSnapshotApplied: (state, action: PayloadAction<BoardId>) => {
      if (state.hydratedBoardId !== action.payload) {
        state.isRefreshWanted = state.pendingWriteCount > 0
      }
      state.hydratedBoardId = action.payload
      state.sentRefreshRevision = null
    },
    /**
     * Fetched data arrived too old to use (the board changed while it was on
     * its way) and was dropped, so the board has to be fetched once more.
     */
    serverSnapshotSkipped: (state) => {
      state.sentRefreshRevision = null
      state.isRefreshWanted = true
    },
  },
  extraReducers: (builder) => {
    // Every change to the cards or columns makes a fetch in flight out of
    // date. A reducer added to boardSlice that changes either one has to be
    // listed here too, or a stale fetch could replace what it wrote.
    builder.addMatcher(
      isAnyOf(setStatusLists, setRepoCards, addRepoCards, removeRepoCard),
      (state) => {
        state.contentRevision += 1
      },
    )
  },
})

// Not exported: only trackBoardWrite may count a write in and out, so every
// start is paired with exactly one end.
const { boardWriteStarted, boardWriteSettled } = boardSyncSlice.actions

export const {
  boardRefreshRequested,
  boardRefreshSent,
  serverSnapshotApplied,
  serverSnapshotSkipped,
} = boardSyncSlice.actions

export default boardSyncSlice.reducer

/**
 * Counts a board write as pending until the server answers, for
 * {@link SERVER_ANSWER_TIME_LIMIT_MS} at most.
 * Exists so data fetched from the server is never put in the store while a
 * save is still on its way: that data may not contain the save yet. Called by
 * {@link useKanbanDnD}, {@link useKanbanUndo}, {@link useOptimisticCardAction}
 * and {@link MoveToAnotherBoardDialog} around every server action they send.
 *
 * The count has an end because a request can go without an answer: counted
 * for good, it would keep the board from ever being fetched again. At the
 * limit nobody knows whether the write was saved, while the board may show
 * it as done, so the board is fetched again and `onOverdue` is called. A
 * write whose answer arrives after the limit asks for one more fetch, since
 * the one sent at the limit may have read the board without it.
 *
 * @param dispatch - Dispatch of the store that holds the board.
 * @param write - The server action call, already started.
 * @param onOverdue - Called once when the limit passes without an answer:
 *   the place to tell the user. Not called for a write answered in time.
 * @returns The same result or rejection as `write`, however late it comes.
 * @example
 * dispatch(setRepoCards(cardsAfterDrag))
 * await trackBoardWrite(dispatch, updateRepoCardPosition(cardId, statusId, order), () =>
 *   reportUnconfirmedBoardSave('syncCardPosition'),
 * )
 */
export async function trackBoardWrite<WriteResult>(
  dispatch: Dispatch,
  write: Promise<WriteResult>,
  onOverdue?: () => void,
): Promise<WriteResult> {
  dispatch(boardWriteStarted())

  let isCounted = true
  const countOut = (): void => {
    isCounted = false
    dispatch(boardWriteSettled())
  }
  const timeLimit = setTimeout(() => {
    countOut()
    // No answer in time: what the board shows may not be what was saved
    dispatch(boardRefreshRequested())
    onOverdue?.()
  }, SERVER_ANSWER_TIME_LIMIT_MS)

  try {
    return await write
  } finally {
    clearTimeout(timeLimit)
    if (isCounted) {
      countOut()
    } else {
      // Answered after the limit: the fetch sent then may lack this write
      dispatch(boardRefreshRequested())
    }
  }
}

/**
 * Takes a card out of the store after it was moved to another board, unless
 * the store holds a different board by now. The answer of a slow move can
 * arrive after the user opened another board, the destination for one;
 * removing the id then would take the card off the board it was just moved
 * to. Dispatched by {@link BoardPageClient} when
 * {@link MoveToAnotherBoardDialog} reports a finished move.
 *
 * @param sourceBoardId - Board the card was moved away from.
 * @param cardId - The moved card.
 * @returns A thunk that removes the card only while the store still holds
 * the source board.
 * @example
 * dispatch(removeMovedRepoCard(toBoardId('board-1'), toRepoCardId('card-1')))
 */
export const removeMovedRepoCard =
  (sourceBoardId: BoardId, cardId: RepoCardId) =>
  (dispatch: Dispatch, getState: () => { boardSync: BoardSyncState }): void => {
    // Another board is in the store: its cards are not this move's to change
    if (getState().boardSync.hydratedBoardId !== sourceBoardId) return
    dispatch(removeRepoCard(cardId))
  }

// Selectors

/**
 * Tells whether the board should be fetched again right now. Called by
 * {@link useBoardServerSync}, which sends the fetch when this turns `true`.
 *
 * @param state - Root state holding the `boardSync` slice.
 * @returns
 * - `true` when a fetch is wanted, no save is pending and no fetch is in flight
 * - `false` otherwise: nothing asked for a fetch, or it has to wait for a save
 *   or for the answer to the fetch already sent
 * @example
 * // A failed save asked for a fresh copy while another save is still pending
 * selectIsBoardRefreshDue(state) // => false, until that save settles
 */
export const selectIsBoardRefreshDue = (state: {
  boardSync: BoardSyncState
}): boolean =>
  state.boardSync.isRefreshWanted &&
  state.boardSync.pendingWriteCount === 0 &&
  state.boardSync.sentRefreshRevision === null

/**
 * Tells whether server data that just arrived for a board may replace the
 * cards and columns in the store. Called by {@link useBoardServerSync} every
 * time the page hands it new data.
 *
 * @param state - Root state holding the `boardSync` slice.
 * @param boardId - Board the arriving data belongs to.
 * @returns
 * - `true` when the store holds another board (or none): the data is shown,
 *   whatever is pending, because the screen has nothing else to show
 * - `false` while a save is pending and the store holds this board: the data
 *   may not contain that save
 * - for the answer to a fetch this app sent: `true` only when the board did
 *   not change while the fetch was on its way
 * - `true` for page data of a navigation with nothing in flight
 * @example
 * // A drag is still saving when the board's data arrives again
 * selectMayApplyServerSnapshot(state, boardId) // => false
 */
export const selectMayApplyServerSnapshot = (
  state: { boardSync: BoardSyncState },
  boardId: BoardId,
): boolean => {
  const {
    pendingWriteCount,
    contentRevision,
    sentRefreshRevision,
    hydratedBoardId,
  } = state.boardSync

  // Another board (or the first one of this page load): nothing to protect
  if (hydratedBoardId !== boardId) return true
  // A save is on its way: this data may have been read before it landed
  if (pendingWriteCount > 0) return false
  // The answer to a fetch sent from here: stale if the board changed since
  if (sentRefreshRevision !== null) {
    return sentRefreshRevision === contentRevision
  }
  // Page data of a navigation, with nothing in flight
  return true
}
