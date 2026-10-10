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
 * const { pushCardHistory, pushColumnHistory } = useKanbanUndo({ dispatch, cards })
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
import type { AppDispatch } from '@/lib/redux/store'
import { reconcileUndoSnapshot } from '@/lib/utils/reconcile-undo-snapshot'
import {
  toColumnPositions,
  type CardColumnPosition,
} from '@/lib/utils/to-column-positions'

interface UseKanbanUndoParams {
  /** Redux dispatch function */
  dispatch: AppDispatch
  /** Cards on the board right now; an undo never touches a card that left it */
  cards: RepoCardForRedux[]
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
 * @param params - Redux dispatch and the board's current cards
 * @returns Push callbacks for DnD handlers to record history
 *
 * @example
 * const { pushCardHistory, pushColumnHistory } = useKanbanUndo({ dispatch, cards })
 * // DnD handlers call pushCardHistory(cards) before mutations
 */
export function useKanbanUndo(
  params: UseKanbanUndoParams,
): UseKanbanUndoReturn {
  const { dispatch, cards } = params

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
      // Non-null: `length > 0` guarantees the last entry exists; runtime
      // `!previousState` was redundant since `columnHistory` only holds
      // `StatusListDomain[]` snapshots pushed by `pushColumnHistory`.
      const previousState = columnHistory[columnHistory.length - 1]!
      dispatch(setStatusLists(previousState))
      setColumnHistory((prev) => prev.slice(0, -1))
      toast.success('Column order restored')

      const updates = previousState.map((s) => ({
        id: s.id,
        gridRow: s.gridRow,
        gridCol: s.gridCol,
      }))
      batchUpdateStatusListPositions(updates).catch((error) => {
        Sentry.captureException(error, {
          tags: { action: 'undoColumnPositions' },
        })
        toast.error('Failed to sync undo to database')
      })
      return
    }

    if (history.length === 0) return
    const previousState = history[history.length - 1]!
    setHistory((prev) => prev.slice(0, -1))

    // The board may have changed since the snapshot (card moved to another
    // board, removed, added): only cards still here go back to their old place
    const cardsAfterUndo = reconcileUndoSnapshot(previousState, cards)
    const positionsAfterUndo = toColumnPositions(cardsAfterUndo)

    // The dragged card has left the board, so nothing here moves back
    if (hasSameLayout(toColumnPositions(cards), positionsAfterUndo)) {
      toast.info('Nothing to undo on this board')
      return
    }

    dispatch(setRepoCards(cardsAfterUndo))
    toast.success('Card operation undone')

    // Positions come from the restored layout, not from each card's `order`
    // field, which drags never update
    batchUpdateRepoCardOrders(positionsAfterUndo).catch((error) => {
      Sentry.captureException(error, {
        tags: { action: 'undoCardPositions' },
      })
      // The write was refused (e.g. the old column was deleted since): go
      // back to the layout the database still holds
      dispatch(setRepoCards(cards))
      toast.error('Failed to sync undo to database')
    })
  }, [history, columnHistory, dispatch, cards])

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
      if (
        (event.key === 'z' || event.key === 'Z') &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault()
        handleUndo()
      }
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
