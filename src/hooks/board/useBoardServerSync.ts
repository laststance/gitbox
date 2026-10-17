/**
 * useBoardServerSync Hook
 *
 * The one place where board data from the server enters the Redux store, and
 * the one place that fetches the board again.
 *
 * The page data used to go straight into the store whenever it arrived. Data
 * fetched before a drag was saved does not contain that drag, so it moved the
 * card back on screen while the database kept the new place, until reload.
 *
 * A refetch is {@link getBoardBundle}. That fails on its own when the browser
 * says it is online and the server cannot be reached; `router.refresh()`
 * replaced the app with the browser's error page in that case. Each fetch has
 * an id, so an answer that arrives after the board was left and opened again
 * is dropped. A fetch that follows a write with no answer is
 * {@link fetchBoardBundle}: a Server Action would wait behind that write.
 */

import * as Sentry from '@sentry/nextjs'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { toast } from 'sonner'

import { useOnlineStatus } from '@/hooks/use-online-status'
import { getBoardBundle } from '@/lib/actions/board-data'
import { PAGE_OUT_OF_DATE_MESSAGE } from '@/lib/constants/stale-page'
import { fetchBoardBundle } from '@/lib/fetch-board-bundle'
import type { RepoCardForRedux, StatusListDomain } from '@/lib/models/domain'
import { setRepoCards, setStatusLists } from '@/lib/redux/slices/boardSlice'
import {
  boardRefreshFailed,
  boardRefreshRequested,
  boardRefreshSent,
  selectIsBoardRefreshDue,
  selectMayApplyServerSnapshot,
  serverSnapshotApplied,
  serverSnapshotSkipped,
} from '@/lib/redux/slices/boardSyncSlice'
import {
  useAppDispatch,
  useAppSelector,
  useAppStore,
  type AppDispatch,
  type RootState,
} from '@/lib/redux/store'
import type { BoardId } from '@/lib/types/brands'
import type { FetchedBoardDetails } from '@/lib/utils/adopt-fetched-board-details'
import { isStalePageAction } from '@/lib/utils/is-stale-page-action'
import { reloadPage } from '@/lib/utils/reload-page'

/** Sonner id of the offline notice, so it can be taken down again. */
const OFFLINE_REFRESH_TOAST_ID = 'board-refresh-offline'

/** Sonner id of the failed-fetch notice, so a second failure replaces it. */
const FAILED_REFRESH_TOAST_ID = 'board-refresh-failed'

/** The cards and columns of one board as the server sent them. */
interface BoardServerSnapshot {
  /** Board the data belongs to. */
  boardId: BoardId
  /** Columns from the page data. */
  statusLists: StatusListDomain[]
  /** Cards from the page data. */
  repoCards: RepoCardForRedux[]
  /**
   * Called when a refetch is applied, with that read's name, subtitle,
   * settings and comments. A fetch that is dropped is not reported. The page
   * props are not reported here: the hooks already start from them.
   */
  onAppliedDetails?: (details: FetchedBoardDetails) => void
}

/**
 * Puts the board's server data into the store and fetches the board again
 * when asked to, without ever replacing something the user just did. Called
 * once by {@link BoardPageClient}; {@link useBoardRollback} asks for a fetch
 * by dispatching {@link boardRefreshRequested}.
 *
 * - Data of a board the store does not hold yet always goes in.
 * - Data of the board already in the store is dropped while a save of that
 *   board is pending, and the board is fetched once more when it settles.
 * - Page data is dropped when the cards or columns have changed since the
 *   last snapshot, which is a drag the Back button would otherwise undo on
 *   screen, and the board is fetched once more.
 * - The answer to a fetch sent from here goes in only when the board did not
 *   change while the fetch was on its way; otherwise it is dropped and the
 *   board is fetched once more.
 * - An answer whose request id is no longer the one in flight is dropped.
 *   That is a fetch of a board that was left and opened again.
 * - A wanted fetch waits for pending writes to settle and for the browser to
 *   be online. While it waits for the connection, a notice says so.
 * - A fetch that fails on the way offers "Try again". A page whose build no
 *   longer has the action, or a read that finds no board, offers "Reload
 *   page": the same read would answer the same way.
 * - A fetch that is applied also reports the board name, the subtitle, the
 *   card display settings and the comments through `onAppliedDetails`. A
 *   fetch that is dropped does not, so a read from before a save is not
 *   handed to the page.
 *
 * The store outlives this component: a board that is left and opened again
 * is mounted anew while the store still holds its cards. So nothing here may
 * depend on whether the component has rendered before: every decision reads
 * the store.
 *
 * @param serverSnapshot - Board id plus the columns and cards of the page data.
 * @example
 * useBoardServerSync({
 *   boardId,
 *   statusLists: initialData.statusLists,
 *   repoCards: initialData.repoCards,
 * })
 */
export function useBoardServerSync(serverSnapshot: BoardServerSnapshot): void {
  const { boardId, statusLists, repoCards, onAppliedDetails } = serverSnapshot
  const store = useAppStore()
  const dispatch = useAppDispatch()
  const isRefreshDue = useAppSelector(selectIsBoardRefreshDue)
  const isRefreshWanted = useAppSelector(
    (state) => state.boardSync.isRefreshWanted,
  )
  const refreshForBoardId = useAppSelector(
    (state) => state.boardSync.refreshForBoardId,
  )
  const hydratedBoardId = useAppSelector(
    (state) => state.boardSync.hydratedBoardId,
  )
  const isOnline = useOnlineStatus()
  const handledSnapshotRef = useRef<BoardServerSnapshot | null>(null)
  // False after this instance unmounts, so its fetch cannot write a board
  // that was opened again. A new instance has its own ref.
  const isMountedRef = useRef(true)

  // Server data → store. useLayoutEffect so the first paint has the board.
  useLayoutEffect(() => {
    // The data this instance already handled (React StrictMode runs effects
    // twice): nothing new
    const handledSnapshot = handledSnapshotRef.current
    if (
      handledSnapshot?.boardId === boardId &&
      handledSnapshot.statusLists === statusLists &&
      handledSnapshot.repoCards === repoCards
    ) {
      return
    }
    handledSnapshotRef.current = { boardId, statusLists, repoCards }

    // Read before a save landed or before the board changed: keep what is on
    // screen and fetch again. The decision reads the store, never this
    // component's own state, because the store outlives the component.
    if (!selectMayApplyServerSnapshot(store.getState(), boardId)) {
      dispatch(serverSnapshotSkipped())
      return
    }

    dispatch(setStatusLists(statusLists))
    dispatch(setRepoCards(repoCards))
    dispatch(serverSnapshotApplied(boardId))
  }, [store, dispatch, boardId, statusLists, repoCards])

  useEffect(() => {
    isMountedRef.current = true
    return (): void => {
      isMountedRef.current = false
    }
  }, [])

  // Fetch the board again once that is due. Offline, it waits for the
  // connection: there is nothing to read.
  useEffect(() => {
    if (!isOnline) return
    const state = store.getState()
    if (!selectIsBoardRefreshDue(state)) return
    if (hydratedBoardId === null) return
    // The fetch was asked for by a save of another board
    if (refreshForBoardId !== null && refreshForBoardId !== hydratedBoardId) {
      return
    }

    const bypassesActionQueue = state.boardSync.refreshBypassesActionQueue
    dispatch(boardRefreshSent())
    const requestId = store.getState().boardSync.sentRefreshRequestId
    if (requestId === null) return

    void applyFetchedBoard({
      boardId: hydratedBoardId,
      requestId,
      bypassesActionQueue,
      isStillMounted: () => isMountedRef.current,
      dispatch,
      getState: store.getState,
      onAppliedDetails,
    })
  }, [
    isRefreshDue,
    isOnline,
    refreshForBoardId,
    hydratedBoardId,
    dispatch,
    store,
    onAppliedDetails,
  ])

  // Say why the board is not reloading for as long as that is the case: the
  // notice stays up while offline, including while a save is still pending,
  // and goes away with the connection back or on leaving the board. A fetch
  // wanted for another board is not this one. A save that starts must not
  // take the notice down: the fetch waits for that save, and the user is
  // still offline.
  useEffect(() => {
    const isThisBoardWanted =
      refreshForBoardId === null || refreshForBoardId === boardId
    if (!isRefreshWanted || isOnline || !isThisBoardWanted) return

    toast.warning("You're offline", {
      id: OFFLINE_REFRESH_TOAST_ID,
      description: 'The board reloads when the connection is back.',
      duration: Infinity,
      closeButton: true,
    })
    return (): void => {
      toast.dismiss(OFFLINE_REFRESH_TOAST_ID)
    }
  }, [isRefreshWanted, isOnline, refreshForBoardId, boardId])
}

/**
 * Reads the board and puts the answer in the store when it is still the
 * fetch in flight.
 *
 * Called by {@link useBoardServerSync} after it has marked the fetch sent.
 * A Server Action stays behind writes that were already sent, which is what
 * a column edit or an added repository needs. The fetch after a write that
 * got no answer uses the route, which does not wait behind that write.
 *
 * @param request.boardId - Board to read.
 * @param request.requestId - Id this fetch was given. An answer for another id is dropped.
 * @param request.bypassesActionQueue - Read through the route instead of a Server Action.
 * @param request.isStillMounted - Whether the instance that sent the fetch is still on the page.
 * @param request.dispatch - Dispatch of the store that holds the board.
 * @param request.getState - Reads that store.
 * @param request.onAppliedDetails - Receives the name, subtitle, settings and comments when the fetch is applied.
 */
async function applyFetchedBoard(request: {
  boardId: BoardId
  requestId: number
  bypassesActionQueue: boolean
  isStillMounted: () => boolean
  dispatch: AppDispatch
  getState: () => RootState
  onAppliedDetails?: (details: FetchedBoardDetails) => void
}): Promise<void> {
  const {
    boardId,
    requestId,
    bypassesActionQueue,
    isStillMounted,
    dispatch,
    getState,
    onAppliedDetails,
  } = request
  try {
    const bundle = bypassesActionQueue
      ? await fetchBoardBundle(boardId)
      : await getBoardBundle(boardId)
    if (!isCurrentFetch(isStillMounted, getState, requestId)) return
    if (!bundle) {
      // No session, or the board is gone. Reading it again answers the same way.
      dispatch(boardRefreshFailed(requestId))
      toast.error('The board could not be reloaded', {
        id: FAILED_REFRESH_TOAST_ID,
        action: { label: 'Reload page', onClick: () => reloadPage() },
      })
      return
    }
    // The board changed while this was on its way: keep the screen and fetch once more
    if (!selectMayApplyServerSnapshot(getState(), boardId)) {
      dispatch(serverSnapshotSkipped())
      return
    }
    dispatch(setStatusLists(bundle.statusLists))
    dispatch(setRepoCards(bundle.repoCards))
    dispatch(serverSnapshotApplied(boardId))
    // The columns and cards are in the store. The name, the settings and the
    // comments stay in the hooks, which compare them to the last server copy.
    onAppliedDetails?.({
      boardId,
      name: bundle.board.name,
      subtitle: bundle.board.subtitle,
      settings: bundle.board.settings,
      comments: bundle.comments,
    })
  } catch (error) {
    if (!isCurrentFetch(isStillMounted, getState, requestId)) return
    dispatch(boardRefreshFailed(requestId))
    // This page's build no longer has the action. Trying it again fails the same way.
    if (isStalePageAction(error)) {
      toast.error(PAGE_OUT_OF_DATE_MESSAGE, {
        id: FAILED_REFRESH_TOAST_ID,
        action: { label: 'Reload page', onClick: () => reloadPage() },
      })
      return
    }
    Sentry.captureException(error, { tags: { action: 'getBoardBundle' } })
    toast.error('The board could not be reloaded', {
      id: FAILED_REFRESH_TOAST_ID,
      action: {
        label: 'Try again',
        onClick: () => {
          // A route read timed out while a write still has no answer. Trying
          // again through a Server Action would wait behind that write.
          dispatch(
            boardRefreshRequested({
              boardId,
              ...(bypassesActionQueue ? { bypassActionQueue: true } : {}),
            }),
          )
        },
      },
    })
  }
}

/**
 * Tells a fetch's answer from one that arrived after the board was left.
 *
 * @param isStillMounted - Whether the instance that sent the fetch is still mounted.
 * @param getState - Reads the store.
 * @param requestId - Id the answer belongs to.
 * @returns Whether this answer may change the board on screen.
 */
function isCurrentFetch(
  isStillMounted: () => boolean,
  getState: () => RootState,
  requestId: number,
): boolean {
  return (
    isStillMounted() && getState().boardSync.sentRefreshRequestId === requestId
  )
}
