/**
 * useBoardRollback Hook
 *
 * Shared "the save failed" handler for optimistic board writes (card drags,
 * column drags, undo, remove, move to Maintenance).
 *
 * A failed write used to dispatch the snapshot captured when the action
 * started. If the board changed while the request was in flight, that brought
 * back a card removed meanwhile, dropped a card added meanwhile, or, after
 * navigating, replaced another board's cards and columns until reload.
 */

import { useCallback } from 'react'

import type { RepoCardForRedux, StatusListDomain } from '@/lib/models/domain'
import { setRepoCards, setStatusLists } from '@/lib/redux/slices/boardSlice'
import { boardRefreshRequested } from '@/lib/redux/slices/boardSyncSlice'
import { useAppStore } from '@/lib/redux/store'
import type { BoardRollbackOutcome } from '@/lib/utils/notify-failed-board-save'

/**
 * Undoes one failed optimistic write.
 *
 * @param optimisticValue - The exact array the failed write dispatched to the store.
 * @param previousValue - The array the store held before that write.
 * @returns What happened on screen, so the caller can word its error message:
 * - `'restored'`: `previousValue` is back in the store
 * - `'reload-requested'`: the store had moved on, nothing was put back and a
 *   fresh copy of the board was requested
 */
export type RollbackOptimisticWrite<Value> = (
  optimisticValue: Value,
  previousValue: Value,
) => BoardRollbackOutcome

export interface BoardRollback {
  /** Undo a failed card write. */
  rollbackRepoCards: RollbackOptimisticWrite<RepoCardForRedux[]>
  /** Undo a failed column write. */
  rollbackStatusLists: RollbackOptimisticWrite<StatusListDomain[]>
}

/**
 * Returns the rollbacks to call when an optimistic board write fails to save.
 * Called by {@link KanbanBoard} (for {@link useKanbanDnD} and
 * {@link useKanbanUndo}) and by {@link useOptimisticCardAction}.
 *
 * Each rollback puts the previous value back only while the store still holds
 * the array the failed write dispatched. Any other array means the board
 * changed in the meantime or another board is open; the snapshot is stale
 * then, so a fresh copy of the board is requested from the server instead
 * ({@link boardRefreshRequested}, carried out by {@link useBoardServerSync}).
 *
 * @returns Stable `rollbackRepoCards` and `rollbackStatusLists` callbacks.
 * @example
 * const { rollbackRepoCards } = useBoardRollback()
 * dispatch(setRepoCards(cardsAfterDrag))
 * try {
 *   await updateRepoCardPosition(cardId, statusId, order)
 * } catch {
 *   const outcome = rollbackRepoCards(cardsAfterDrag, cardsBeforeDrag)
 *   notifyFailedBoardSave('Failed to move card', outcome)
 * }
 */
export function useBoardRollback(): BoardRollback {
  const store = useAppStore()

  const rollbackRepoCards = useCallback<BoardRollback['rollbackRepoCards']>(
    (optimisticCards, previousCards) => {
      // Still the cards the failed write put on screen: put the old ones back
      if (store.getState().board.repoCards === optimisticCards) {
        store.dispatch(setRepoCards(previousCards))
        return 'restored'
      }
      // The board moved on: the snapshot is stale, so ask the server
      store.dispatch(boardRefreshRequested())
      return 'reload-requested'
    },
    [store],
  )

  const rollbackStatusLists = useCallback<BoardRollback['rollbackStatusLists']>(
    (optimisticStatusLists, previousStatusLists) => {
      // Still the columns the failed write put on screen: put the old ones back
      if (store.getState().board.statusLists === optimisticStatusLists) {
        store.dispatch(setStatusLists(previousStatusLists))
        return 'restored'
      }
      // The board moved on: the snapshot is stale, so ask the server
      store.dispatch(boardRefreshRequested())
      return 'reload-requested'
    },
    [store],
  )

  return { rollbackRepoCards, rollbackStatusLists }
}
