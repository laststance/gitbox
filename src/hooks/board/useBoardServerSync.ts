/**
 * useBoardServerSync Hook
 *
 * The one place where board data from the server enters the Redux store, and
 * the one place that fetches the board again.
 *
 * The page data used to go straight into the store whenever it arrived. Data
 * fetched before a drag was saved does not contain that drag, so it moved the
 * card back on screen while the database kept the new place, until reload.
 */

import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { toast } from 'sonner'

import { useOnlineStatus } from '@/hooks/use-online-status'
import type { RepoCardForRedux, StatusListDomain } from '@/lib/models/domain'
import { setRepoCards, setStatusLists } from '@/lib/redux/slices/boardSlice'
import {
  boardRefreshSent,
  selectIsBoardRefreshDue,
  selectMayApplyServerSnapshot,
  serverSnapshotApplied,
  serverSnapshotSkipped,
} from '@/lib/redux/slices/boardSyncSlice'
import { useAppDispatch, useAppSelector, useAppStore } from '@/lib/redux/store'
import type { BoardId } from '@/lib/types/brands'

/** Sonner id of the offline notice, so it can be taken down again. */
const OFFLINE_REFRESH_TOAST_ID = 'board-refresh-offline'

/** The cards and columns of one board as the server sent them. */
interface BoardServerSnapshot {
  /** Board the data belongs to. */
  boardId: BoardId
  /** Columns from the page data. */
  statusLists: StatusListDomain[]
  /** Cards from the page data. */
  repoCards: RepoCardForRedux[]
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
 * - The answer to a fetch sent from here goes in only when the board did not
 *   change while the fetch was on its way; otherwise it is dropped and the
 *   board is fetched once more.
 * - A wanted fetch waits for pending writes to settle and for the browser to
 *   be online. While it waits for the connection, a notice says so.
 *
 * The store outlives this component: a board that is left and opened again
 * is mounted anew while the store still holds its cards. So nothing here may
 * depend on whether the component has rendered before: every decision reads
 * the store. A fetch sent from here does not mount the page again; its data
 * arrives as new `statusLists` and `repoCards` on the same instance.
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
  const { boardId, statusLists, repoCards } = serverSnapshot
  const store = useAppStore()
  const dispatch = useAppDispatch()
  const router = useRouter()
  const isRefreshDue = useAppSelector(selectIsBoardRefreshDue)
  const isOnline = useOnlineStatus()
  const handledSnapshotRef = useRef<BoardServerSnapshot | null>(null)

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

  // Fetch the board again once that is due. Offline, a refresh would replace
  // the app with the browser's error page, so it waits for the connection.
  useEffect(() => {
    if (!isRefreshDue || !isOnline) return

    dispatch(boardRefreshSent())
    router.refresh()
  }, [isRefreshDue, isOnline, dispatch, router])

  // Say why the board is not reloading for as long as that is the case: the
  // notice stays up while offline and goes away with the connection back or
  // on leaving the board.
  useEffect(() => {
    if (!isRefreshDue || isOnline) return

    toast.warning("You're offline", {
      id: OFFLINE_REFRESH_TOAST_ID,
      description: 'The board reloads when the connection is back.',
      duration: Infinity,
    })
    return (): void => {
      toast.dismiss(OFFLINE_REFRESH_TOAST_ID)
    }
  }, [isRefreshDue, isOnline])
}
