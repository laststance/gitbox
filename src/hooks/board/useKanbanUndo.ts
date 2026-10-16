/**
 * useKanbanUndo Hook
 *
 * Manages undo history for both card and column drag operations.
 * Includes keyboard shortcut (Z key) registration internally.
 *
 * History stacks are capped at 10 entries to prevent unbounded memory growth.
 * Column undo takes priority over card undo.
 *
 * @example
 * const { pushCardHistory, pushColumnHistory } = useKanbanUndo({ dispatch, cards, statuses, rollbackRepoCards, rollbackStatusLists })
 * // Pass to useKanbanDnD:
 * useKanbanDnD({ ...params, pushCardHistory, pushColumnHistory })
 */

import * as Sentry from '@sentry/nextjs'
import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'

import {
  batchUpdateRepoCardOrders,
  batchUpdateStatusListPositions,
} from '@/lib/actions/board'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import { setStatusLists, setRepoCards } from '@/lib/redux/slices/boardSlice'
import { trackBoardWrite } from '@/lib/redux/slices/boardSyncSlice'
import type { AppDispatch } from '@/lib/redux/store'
import { isOverlayOpen } from '@/lib/utils/is-overlay-open'
import { notifyFailedBoardSave } from '@/lib/utils/notify-failed-board-save'
import { reconcileUndoSnapshot } from '@/lib/utils/reconcile-undo-snapshot'
import { reportUnconfirmedBoardSave } from '@/lib/utils/report-unconfirmed-board-save'
import { rollbackIfPositionWriteFailed } from '@/lib/utils/rollback-if-position-write-failed'
import {
  toColumnPositions,
  type CardColumnPosition,
} from '@/lib/utils/to-column-positions'

import type { BoardRollback } from './useBoardRollback'

/**
 * Sonner id shared by an undo's "restored" toast and its "failed" toast, so a
 * refused undo replaces the success message instead of standing next to it.
 */
const UNDO_TOAST_ID = 'board-undo'

/** First line of the toast shown when an undo was not saved. */
const UNDO_FAILED_TOAST_TITLE = 'Failed to sync undo to database'

interface UseKanbanUndoParams {
  /** Redux dispatch function */
  dispatch: AppDispatch
  /** Cards on the board right now; an undo never touches a card that left it */
  cards: RepoCardForRedux[]
  /** Columns on the board right now; a refused column undo goes back to them */
  statuses: StatusListDomain[]
  /** Puts the cards back when the undo fails to save (from {@link useBoardRollback}) */
  rollbackRepoCards: BoardRollback['rollbackRepoCards']
  /** Puts the columns back when the undo fails to save (from {@link useBoardRollback}) */
  rollbackStatusLists: BoardRollback['rollbackStatusLists']
}

interface UseKanbanUndoReturn {
  /** Push a card snapshot to the undo history stack (max 10) */
  pushCardHistory: (snapshot: RepoCardForRedux[]) => void
  /** Push a column snapshot to the undo history stack (max 10) */
  pushColumnHistory: (snapshot: StatusListDomain[]) => void
}

/**
 * Hook for Kanban board undo functionality.
 *
 * Manages card and column history stacks, handles undo operations with
 * DB sync, and registers the Z-key keyboard shortcut internally.
 *
 * @param params - Redux dispatch, the board's current cards and columns, and the failed-save rollbacks
 * @returns Push callbacks for DnD handlers to record history
 *
 * @example
 * const { pushCardHistory, pushColumnHistory } = useKanbanUndo({ dispatch, cards, statuses, rollbackRepoCards, rollbackStatusLists })
 * // DnD handlers call pushCardHistory(cards) before mutations
 */
export function useKanbanUndo(
  params: UseKanbanUndoParams,
): UseKanbanUndoReturn {
  const { dispatch, cards, statuses, rollbackRepoCards, rollbackStatusLists } =
    params

  // History stacks (max 10 entries each)
  const [history, setHistory] = useState<RepoCardForRedux[][]>([])
  const [columnHistory, setColumnHistory] = useState<StatusListDomain[][]>([])

  const pushCardHistory = useCallback((snapshot: RepoCardForRedux[]) => {
    setHistory((prev) => [...prev, snapshot].slice(-10))
  }, [])

  const pushColumnHistory = useCallback((snapshot: StatusListDomain[]) => {
    setColumnHistory((prev) => [...prev, snapshot].slice(-10))
  }, [])

  /**
   * Undo the last drag & drop operation.
   * Column undo takes priority over card undo.
   * Syncs reverted state to database.
   */
  const handleUndo = useCallback(() => {
    if (columnHistory.length > 0) {
      // Non-null: `length > 0` guarantees the last entry exists, and
      // `columnHistory` only holds `StatusListDomain[]` snapshots pushed by
      // `pushColumnHistory`. A copy, because the next drag pushes the store's
      // array back onto the history: a second undo would dispatch the very
      // same array, and the failed-save rollback tells writes apart by it.
      const columnsAfterUndo = [...columnHistory[columnHistory.length - 1]!]
      dispatch(setStatusLists(columnsAfterUndo))
      setColumnHistory((prev) => prev.slice(0, -1))
      toast.success('Column order restored', { id: UNDO_TOAST_ID })

      const updates = columnsAfterUndo.map((s) => ({
        id: s.id,
        gridRow: s.gridRow,
        gridCol: s.gridCol,
      }))
      rollbackIfPositionWriteFailed(
        trackBoardWrite(dispatch, batchUpdateStatusListPositions(updates), () =>
          reportUnconfirmedBoardSave('undoColumnPositions'),
        ),
        UNDO_FAILED_TOAST_TITLE,
        () => rollbackStatusLists(columnsAfterUndo, statuses),
        UNDO_TOAST_ID,
      ).catch((error) => {
        Sentry.captureException(error, {
          tags: { action: 'undoColumnPositions' },
        })
        // The write was refused: go back to the columns the database still holds
        const rollbackOutcome = rollbackStatusLists(columnsAfterUndo, statuses)
        notifyFailedBoardSave(
          UNDO_FAILED_TOAST_TITLE,
          rollbackOutcome,
          UNDO_TOAST_ID,
        )
      })
      return
    }

    if (history.length === 0) return

    // A drag that put the card back where it was is still on the stack.
    // One Z walks past it. The entry that moved a card is the one that returns.
    const currentPositions = toColumnPositions(cards)
    let remaining = history
    let cardsAfterUndo = cards
    let positionsAfterUndo = currentPositions
    while (remaining.length > 0) {
      const previousState = remaining[remaining.length - 1]!
      remaining = remaining.slice(0, -1)
      // The board may have changed since the snapshot (card moved to another
      // board, removed, added): only cards still here go back to their old place
      cardsAfterUndo = reconcileUndoSnapshot(previousState, cards)
      positionsAfterUndo = toColumnPositions(cardsAfterUndo)
      if (!hasSameLayout(currentPositions, positionsAfterUndo)) break
    }

    setHistory(remaining)

    // Every remembered drag left the board as it is
    if (hasSameLayout(currentPositions, positionsAfterUndo)) {
      toast.info('Nothing to undo on this board')
      return
    }

    dispatch(setRepoCards(cardsAfterUndo))
    toast.success('Card operation undone', { id: UNDO_TOAST_ID })

    // Positions come from the restored layout, not from each card's `order`
    // field, which drags never update
    trackBoardWrite(
      dispatch,
      batchUpdateRepoCardOrders(positionsAfterUndo),
      () => reportUnconfirmedBoardSave('undoCardPositions'),
    ).catch((error) => {
      Sentry.captureException(error, {
        tags: { action: 'undoCardPositions' },
      })
      // The write was refused (e.g. the old column was deleted since): go
      // back to the layout the database still holds
      const rollbackOutcome = rollbackRepoCards(cardsAfterUndo, cards)
      notifyFailedBoardSave(
        UNDO_FAILED_TOAST_TITLE,
        rollbackOutcome,
        UNDO_TOAST_ID,
      )
    })
  }, [
    history,
    columnHistory,
    dispatch,
    cards,
    statuses,
    rollbackRepoCards,
    rollbackStatusLists,
  ])

  // Keyboard shortcut: Z key to execute undo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Skip if user is typing in an input field, textarea, or contentEditable element
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Bare Z key only (no Cmd/Ctrl/Alt modifiers to avoid conflict with browser undo)
      const isBareZKey =
        (event.key === 'z' || event.key === 'Z') &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      if (!isBareZKey) return

      // A layer lies over the board: a dialog, a menu, a list of options,
      // the command palette, the Add Repositories panel, or the sidebar
      // below 768px. The key belongs to that layer (a Select reads a letter
      // as "jump to this option"), and the board behind it must not change.
      // Asked last: it searches the document, and every other key should
      // not pay for that.
      if (isOverlayOpen()) return

      event.preventDefault()
      handleUndo()
    }

    window.addEventListener('keydown', handleKeyDown)
    return (): void => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo])

  return {
    pushCardHistory,
    pushColumnHistory,
  }
}

/**
 * Tells whether two board layouts show every card in the same column and at
 * the same position. Used by {@link useKanbanUndo} to skip an undo that would
 * change nothing.
 *
 * @param current - Positions of the cards on the board now.
 * @param next - Positions the undo would produce.
 * @returns `true` when both hold the same cards at the same places.
 * @example
 * hasSameLayout([{ id: 'a', statusId: 'todo', order: 0 }], [{ id: 'a', statusId: 'done', order: 0 }]) // => false
 */
function hasSameLayout(
  current: CardColumnPosition[],
  next: CardColumnPosition[],
): boolean {
  if (current.length !== next.length) return false

  const currentPositionById = new Map(
    current.map((position) => [position.id, position]),
  )
  return next.every((position) => {
    const currentPosition = currentPositionById.get(position.id)
    return (
      currentPosition !== undefined &&
      currentPosition.statusId === position.statusId &&
      currentPosition.order === position.order
    )
  })
}
